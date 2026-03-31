import * as vscode from 'vscode';

import { LevelUpService } from './levelUpService';
import { AchievementProgress, LevelUpSnapshot, LevelUpState } from './types';

interface DashboardValueCard {
  label: string;
  value: string;
  hint: string;
}

interface DashboardTrait {
  name: string;
  value: number;
  tier: string;
}

interface DashboardNote {
  label: string;
  value: string;
}

interface DashboardAchievementCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  groupId: string;
  groupTitle: string;
  tierIndex: number;
  tierCount: number;
  tierLabel: string;
  unlocked: boolean;
  progressPercent: number;
  progressText: string;
}

interface DashboardAchievementGroup {
  id: string;
  title: string;
  cards: DashboardAchievementCard[];
  currentCard: DashboardAchievementCard;
  unlockedCount: number;
  totalCount: number;
}

interface DashboardSettingsModel {
  editorCelebrations: boolean;
  reducedMotion: boolean;
}

interface DashboardModel {
  hero: {
    title: string;
    archetype: string;
    level: string;
    xpText: string;
    xpRemaining: string;
    xpPercent: number;
  };
  profile: {
    latestAchievement: DashboardAchievementCard | null;
    traits: DashboardTrait[];
  };
  achievements: {
    nextMilestone: string;
    groups: DashboardAchievementGroup[];
  };
  stats: {
    overviewCards: DashboardValueCard[];
    cards: DashboardValueCard[];
    ledger: DashboardValueCard[];
    languages: string[];
    notes: DashboardNote[];
  };
  settings: DashboardSettingsModel;
}

const numberFormatter = new Intl.NumberFormat('en-US');

export class LevelUpDashboardProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly service: LevelUpService,
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview, this.service.getSnapshot());
    webviewView.webview.onDidReceiveMessage((message: { type?: string; key?: string; value?: boolean }) => {
      switch (message.type) {
        case 'showSummary':
          void vscode.commands.executeCommand('levelUp.showSummary');
          break;
        case 'resetProgress':
          void vscode.commands.executeCommand('levelUp.resetProgress');
          break;
        case 'updateSetting':
          void this.updateSetting(message.key, message.value);
          break;
        default:
          break;
      }
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.refresh();
      }
    });
    this.refresh();
  }

  public refresh(): void {
    if (!this.view) {
      return;
    }

    void this.view.webview.postMessage({
      type: 'snapshot',
      payload: buildDashboardModel(this.service.getSnapshot()),
    });
  }

  private async updateSetting(key: string | undefined, value: boolean | undefined): Promise<void> {
    if (typeof key !== 'string' || typeof value !== 'boolean') {
      return;
    }

    const config = vscode.workspace.getConfiguration('levelUp');

    switch (key) {
      case 'effects.editorCelebrations':
      case 'effects.reducedMotion':
        await config.update(key, value, vscode.ConfigurationTarget.Global);
        this.refresh();
        break;
      default:
        break;
    }
  }

  private getHtml(webview: vscode.Webview, snapshot: LevelUpSnapshot): string {
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard.js'));
    const model = encodeURIComponent(serializeModel(buildDashboardModel(snapshot)));
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Level Up Dashboard</title>
  </head>
  <body>
    <div id="app" data-model="${model}"></div>
    <script type="module" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function buildDashboardModel(snapshot: LevelUpSnapshot): DashboardModel {
  const { progress, state, achievements, unlockedAchievements } = snapshot;
  const levelTitle = getLevelTitle(progress.level);
  const archetype = getArchetype(state);
  const buildStyle = getBuildStyle(state);
  const nextAchievement = achievements.find((achievement) => !achievement.unlocked);
  const xpRemaining = Math.max(0, progress.xpForNextLevel - progress.currentLevelXp);
  const achievementGroups = buildAchievementGroups(achievements);
  const latestAchievement = getLatestUnlockedAchievement(snapshot);
  const overviewCards: DashboardValueCard[] = [
    {
      label: 'Rank',
      value: levelTitle,
      hint: `Level ${progress.level} adventurer`,
    },
    {
      label: 'Archetype',
      value: archetype,
      hint: buildStyle,
    },
    {
      label: 'Build Style',
      value: buildStyle,
      hint: `${state.languagesUsed.length} tracked language(s)`,
    },
    {
      label: 'Next Quest',
      value: nextAchievement ? nextAchievement.title : 'Codex complete',
      hint: nextAchievement ? nextAchievement.progressText : 'Every achievement is unlocked.',
    },
  ];

  return {
    hero: {
      title: levelTitle,
      archetype,
      level: `${progress.level}`,
      xpText: `${formatNumber(progress.currentLevelXp)} / ${formatNumber(progress.xpForNextLevel)} XP`,
      xpRemaining: `${formatNumber(xpRemaining)} XP to level ${progress.level + 1}`,
      xpPercent: getProgressPercent(progress.currentLevelXp, progress.xpForNextLevel),
    },
    profile: {
      latestAchievement: latestAchievement ? toDashboardAchievement(latestAchievement) : null,
      traits: [
        createTrait('Discipline', calculateDiscipline(state)),
        createTrait('Craft', calculateCraft(state)),
        createTrait('Versatility', calculateVersatility(state)),
        createTrait('Endurance', calculateEndurance(state)),
      ],
    },
    achievements: {
      nextMilestone: nextAchievement
        ? `${nextAchievement.title} - ${nextAchievement.progressText}`
        : 'All achievements unlocked.',
      groups: achievementGroups,
    },
    stats: {
      overviewCards,
      cards: [
        {
          label: 'Lifetime XP',
          value: formatNumber(state.totalXp),
          hint: 'All earned experience',
        },
        {
          label: 'Meaningful Edits',
          value: formatNumber(state.totalEdits),
          hint: 'Edits that granted XP',
        },
        {
          label: 'Saves',
          value: formatNumber(state.totalSaves),
          hint: 'Save bonuses claimed',
        },
        {
          label: 'Typed Characters',
          value: formatNumber(state.totalTypedCharacters),
          hint: 'Tracked keystroke volume',
        },
        {
          label: 'Active Days',
          value: formatNumber(state.activeDays),
          hint: 'Days with coding activity',
        },
        {
          label: 'Languages',
          value: formatNumber(state.languagesUsed.length),
          hint: getLanguageSummary(state),
        },
      ],
      ledger: [
        {
          label: 'XP per Edit',
          value: formatDecimal(divide(state.totalXp, state.totalEdits)),
          hint: 'Average XP earned per meaningful edit',
        },
        {
          label: 'Save Ratio',
          value: `${formatNumber(Math.round(divide(state.totalSaves, state.totalEdits) * 100))}%`,
          hint: 'Saves relative to meaningful edits',
        },
        {
          label: 'Versatility',
          value: getVersatilityLabel(state),
          hint: `${state.languagesUsed.length} language affinity tracked`,
        },
        {
          label: 'Next Level Push',
          value: `${formatNumber(xpRemaining)} XP`,
          hint: `Target: level ${progress.level + 1}`,
        },
        {
          label: 'Achievement Pace',
          value:
            unlockedAchievements.length === 0
              ? 'No unlocks yet'
              : `${formatDecimal(divide(state.totalXp, unlockedAchievements.length))} XP/unlock`,
          hint: 'Average effort per unlocked achievement',
        },
      ],
      languages: [...state.languagesUsed],
      notes: [
        {
          label: 'Language Affinity',
          value: getLanguageSummary(state),
        },
        {
          label: 'Current Streak',
          value: `${state.currentStreak} day(s)`,
        },
        {
          label: 'Best Streak',
          value: `${state.longestStreak} day(s)`,
        },
        {
          label: 'Active Days',
          value: formatNumber(state.activeDays),
        },
      ],
    },
    settings: getDashboardSettings(),
  };
}

function getDashboardSettings(): DashboardSettingsModel {
  const config = vscode.workspace.getConfiguration('levelUp');

  return {
    editorCelebrations: config.get<boolean>('effects.editorCelebrations', true),
    reducedMotion: config.get<boolean>('effects.reducedMotion', false),
  };
}

function getLatestUnlockedAchievement(snapshot: LevelUpSnapshot): AchievementProgress | undefined {
  const directMatch = snapshot.state.lastUnlockedAchievementId
    ? snapshot.achievements.find(
        (achievement) =>
          achievement.id === snapshot.state.lastUnlockedAchievementId && achievement.unlocked,
      )
    : undefined;

  if (directMatch) {
    return directMatch;
  }

  const fallbackId = snapshot.state.unlockedAchievementIds.at(-1);
  if (fallbackId) {
    const fallbackMatch = snapshot.achievements.find(
      (achievement) => achievement.id === fallbackId && achievement.unlocked,
    );

    if (fallbackMatch) {
      return fallbackMatch;
    }
  }

  return snapshot.unlockedAchievements.at(-1);
}

function createTrait(name: string, value: number): DashboardTrait {
  return {
    name,
    value,
    tier: getTraitTier(value),
  };
}

function toDashboardAchievement(achievement: AchievementProgress): DashboardAchievementCard {
  return {
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    icon: achievement.icon,
    groupId: achievement.group.id,
    groupTitle: achievement.group.title,
    tierIndex: achievement.group.tierIndex,
    tierCount: achievement.group.tierCount,
    tierLabel: achievement.group.tierLabel ?? `${achievement.group.tierIndex + 1}`,
    unlocked: achievement.unlocked,
    progressPercent: achievement.progressPercent,
    progressText: achievement.progressText,
  };
}

function buildAchievementGroups(
  achievements: AchievementProgress[],
): DashboardAchievementGroup[] {
  const groups = new Map<string, DashboardAchievementGroup>();

  for (const achievement of achievements) {
    const card = toDashboardAchievement(achievement);
    const existingGroup = groups.get(card.groupId);

    if (existingGroup) {
      existingGroup.cards.push(card);
      existingGroup.unlockedCount += card.unlocked ? 1 : 0;
      continue;
    }

    groups.set(card.groupId, {
      id: card.groupId,
      title: card.groupTitle,
      cards: [card],
      currentCard: card,
      unlockedCount: card.unlocked ? 1 : 0,
      totalCount: 0,
    });
  }

  return Array.from(groups.values()).map((group) => {
    group.cards.sort((left, right) => left.tierIndex - right.tierIndex);
    group.totalCount = group.cards.length;
    group.currentCard = getVisibleAchievementCard(group.cards);
    return group;
  });
}

function getVisibleAchievementCard(cards: DashboardAchievementCard[]): DashboardAchievementCard {
  const nextLockedCard = cards.find((card) => !card.unlocked);
  return nextLockedCard ?? cards[cards.length - 1];
}

function calculateDiscipline(state: LevelUpState): number {
  const saveRatio = divide(state.totalSaves, state.totalEdits);

  return averagePercent(
    getProgressPercent(state.totalSaves, 40),
    getProgressPercent(state.currentStreak, 10),
    getProgressPercent(saveRatio, 0.35),
  );
}

function calculateCraft(state: LevelUpState): number {
  return averagePercent(
    getProgressPercent(state.totalEdits, 120),
    getProgressPercent(state.totalTypedCharacters, 5000),
    getProgressPercent(state.totalXp, 1200),
  );
}

function calculateVersatility(state: LevelUpState): number {
  return roundPercent((1 - Math.exp(-state.languagesUsed.length / 2.2)) * 100);
}

function calculateEndurance(state: LevelUpState): number {
  return averagePercent(
    getProgressPercent(state.activeDays, 20),
    getProgressPercent(state.longestStreak, 10),
    getProgressPercent(state.currentStreak, 7),
  );
}

function getTraitTier(value: number): string {
  if (value >= 90) {
    return 'Legendary';
  }

  if (value >= 70) {
    return 'Elite';
  }

  if (value >= 45) {
    return 'Steady';
  }

  if (value >= 20) {
    return 'Emerging';
  }

  return 'Dormant';
}

function getLevelTitle(level: number): string {
  if (level >= 12) {
    return 'Mythic Architect';
  }

  if (level >= 9) {
    return 'Refactor Warden';
  }

  if (level >= 6) {
    return 'Syntax Knight';
  }

  if (level >= 4) {
    return 'Questing Engineer';
  }

  if (level >= 2) {
    return 'Apprentice Ranger';
  }

  return 'Novice Scribe';
}

function getArchetype(state: LevelUpState): string {
  if (state.languagesUsed.length >= 5) {
    return 'Polyglot Vanguard';
  }

  if (state.currentStreak >= 7) {
    return 'Iron-Willed Builder';
  }

  if (state.totalTypedCharacters >= 4000) {
    return 'Keyboard Duelist';
  }

  if (state.totalSaves >= 20) {
    return 'Refactor Sentinel';
  }

  if (state.totalEdits >= 50) {
    return 'Questing Engineer';
  }

  return 'Fresh Adventurer';
}

function getBuildStyle(state: LevelUpState): string {
  if (state.languagesUsed.length >= 4) {
    return 'Polyglot path';
  }

  if (state.totalSaves >= Math.max(12, Math.round(state.totalEdits * 0.45))) {
    return 'Steady refiner';
  }

  if (state.totalTypedCharacters >= 2500) {
    return 'High-volume striker';
  }

  if (state.currentStreak >= 5) {
    return 'Streak guardian';
  }

  if (state.totalEdits >= 60) {
    return 'Patch duelist';
  }

  return 'Fresh recruit';
}

function getVersatilityLabel(state: LevelUpState): string {
  if (state.languagesUsed.length >= 5) {
    return 'Guild explorer';
  }

  if (state.languagesUsed.length >= 3) {
    return 'Broad toolkit';
  }

  if (state.languagesUsed.length >= 2) {
    return 'Dual discipline';
  }

  if (state.languagesUsed.length === 1) {
    return 'Focused specialist';
  }

  return 'Unclaimed';
}

function getLanguageSummary(state: LevelUpState): string {
  if (state.languagesUsed.length === 0) {
    return 'No tracked languages yet';
  }

  if (state.languagesUsed.length <= 3) {
    return state.languagesUsed.join(', ');
  }

  return `${state.languagesUsed.length} language paths unlocked`;
}

function getProgressPercent(current: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return roundPercent((current / total) * 100);
}

function averagePercent(...values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return roundPercent(sum / values.length);
}

function roundPercent(value: number): number {
  return clamp(Math.round(value * 10) / 10, 0, 100);
}

function formatNumber(value: number): string {
  return numberFormatter.format(Math.max(0, Math.round(value)));
}

function formatDecimal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0.0';
  }

  return value.toFixed(1);
}

function divide(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function serializeModel(model: DashboardModel): string {
  return JSON.stringify(model)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}