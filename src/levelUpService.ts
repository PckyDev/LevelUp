import * as vscode from 'vscode';

import { loadAchievementDefinitions } from './achievementCatalog';
import {
  AchievementDefinition,
  AchievementMetricType,
  AchievementProgress,
  AchievementRatioTrackingDefinition,
  AchievementThresholdTrackingDefinition,
  AchievementTrackingConditionDefinition,
  AchievementTrackingDefinition,
  ActivityResult,
  LevelProgress,
  LevelUpSnapshot,
  LevelUpState,
} from './types';

const STATE_KEY = 'levelUp.state';
const SAVE_XP = 10;
const PERSIST_DEBOUNCE_MS = 400;
const numberFormatter = new Intl.NumberFormat('en-US');

interface AchievementEvaluation {
  unlocked: boolean;
  progressPercent: number;
  progressText: string;
}

const DEFAULT_STATE: LevelUpState = {
  totalXp: 0,
  totalEdits: 0,
  totalSaves: 0,
  totalTypedCharacters: 0,
  activeDays: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDay: undefined,
  languagesUsed: [],
  unlockedAchievementIds: [],
  lastUnlockedAchievementId: undefined,
};

export class LevelUpService {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly achievements: readonly AchievementDefinition[];
  private readonly dirtyDocumentUris = new Set<string>();
  private readonly state: LevelUpState;
  private persistTimer: NodeJS.Timeout | undefined;

  public readonly onDidChange = this.changeEmitter.event;

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.achievements = loadAchievementDefinitions();
    this.state = this.loadState();
  }

  public getSnapshot(): LevelUpSnapshot {
    const achievements = this.achievements.map((achievement) =>
      toAchievementProgress(achievement, this.state),
    );
    const unlocked = achievements.filter((achievement) => achievement.unlocked);
    const locked = achievements.filter((achievement) => !achievement.unlocked);

    return {
      state: {
        ...this.state,
        languagesUsed: [...this.state.languagesUsed],
        unlockedAchievementIds: [...this.state.unlockedAchievementIds],
      },
      progress: calculateLevelProgress(this.state.totalXp),
      achievements,
      unlockedAchievements: unlocked,
      lockedAchievements: locked,
    };
  }

  public handleTextChange(event: vscode.TextDocumentChangeEvent): ActivityResult | undefined {
    if (!shouldTrackDocument(event.document)) {
      return undefined;
    }

    this.updateDirtyDocumentState(event.document);

    if (
      event.reason === vscode.TextDocumentChangeReason.Undo ||
      event.reason === vscode.TextDocumentChangeReason.Redo
    ) {
      return undefined;
    }

    const reward = calculateEditReward(event.contentChanges);
    if (reward.xp === 0) {
      return undefined;
    }

    this.markActiveToday();
    this.recordLanguage(event.document.languageId);
    this.state.totalEdits += 1;
    this.state.totalTypedCharacters += reward.insertedCharacters;

    return this.applyXp(reward.xp);
  }

  public handleSave(document: vscode.TextDocument): ActivityResult | undefined {
    if (!shouldTrackDocument(document)) {
      return undefined;
    }

    const documentUri = document.uri.toString();
    if (!this.dirtyDocumentUris.delete(documentUri)) {
      return undefined;
    }

    this.markActiveToday();
    this.recordLanguage(document.languageId);
    this.state.totalSaves += 1;

    return this.applyXp(SAVE_XP);
  }

  public handleDocumentClosed(document: vscode.TextDocument): void {
    this.dirtyDocumentUris.delete(document.uri.toString());
  }

  public async resetProgress(): Promise<void> {
    Object.assign(this.state, cloneDefaultState());
    await this.persistNow();
    this.changeEmitter.fire();
  }

  public dispose(): Thenable<void> {
    this.changeEmitter.dispose();
    return this.persistNow();
  }

  private applyXp(xpGained: number): ActivityResult {
    const previousLevel = calculateLevelProgress(this.state.totalXp).level;
    this.state.totalXp += xpGained;
    const currentLevel = calculateLevelProgress(this.state.totalXp).level;
    const newlyUnlockedAchievements = this.unlockAchievements();
    const snapshot = this.getSnapshot();

    this.schedulePersist();
    this.changeEmitter.fire();

    return {
      xpGained,
      previousLevel,
      currentLevel,
      newlyUnlockedAchievements,
      snapshot,
    };
  }

  private unlockAchievements(): AchievementDefinition[] {
    const unlockedIds = new Set(this.state.unlockedAchievementIds);
    const newlyUnlocked: AchievementDefinition[] = [];

    for (const achievement of this.achievements) {
      if (unlockedIds.has(achievement.id)) {
        continue;
      }

      if (isAchievementUnlocked(achievement, this.state)) {
        unlockedIds.add(achievement.id);
        newlyUnlocked.push(toAchievementDefinition(achievement));
      }
    }

    if (newlyUnlocked.length > 0) {
      this.state.unlockedAchievementIds = [...unlockedIds];
      this.state.lastUnlockedAchievementId = newlyUnlocked[newlyUnlocked.length - 1]?.id;
    }

    return newlyUnlocked;
  }

  private markActiveToday(): void {
    const today = getDayKey(new Date());

    if (this.state.lastActiveDay === today) {
      return;
    }

    if (!this.state.lastActiveDay) {
      this.state.currentStreak = 1;
      this.state.activeDays = 1;
      this.state.longestStreak = 1;
      this.state.lastActiveDay = today;
      return;
    }

    const gap = dayDifference(this.state.lastActiveDay, today);
    this.state.currentStreak = gap === 1 ? this.state.currentStreak + 1 : 1;
    this.state.activeDays += 1;
    this.state.longestStreak = Math.max(this.state.longestStreak, this.state.currentStreak);
    this.state.lastActiveDay = today;
  }

  private recordLanguage(languageId: string): void {
    if (!isTrackableLanguage(languageId)) {
      return;
    }

    if (!this.state.languagesUsed.includes(languageId)) {
      this.state.languagesUsed = [...this.state.languagesUsed, languageId].sort();
    }
  }

  private updateDirtyDocumentState(document: vscode.TextDocument): void {
    const documentUri = document.uri.toString();

    if (document.isDirty) {
      this.dirtyDocumentUris.add(documentUri);
    } else {
      this.dirtyDocumentUris.delete(documentUri);
    }
  }

  private loadState(): LevelUpState {
    const storedState = this.context.globalState.get<Partial<LevelUpState>>(STATE_KEY);
    return normalizeState(storedState);
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      void this.persistNow();
    }, PERSIST_DEBOUNCE_MS);
  }

  private persistNow(): Thenable<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = undefined;
    }

    return this.context.globalState.update(STATE_KEY, this.state);
  }
}

function cloneDefaultState(): LevelUpState {
  return {
    ...DEFAULT_STATE,
    languagesUsed: [],
    unlockedAchievementIds: [],
  };
}

function normalizeState(state: Partial<LevelUpState> | undefined): LevelUpState {
  if (!state) {
    return cloneDefaultState();
  }

  return {
    totalXp: safeNumber(state.totalXp),
    totalEdits: safeNumber(state.totalEdits),
    totalSaves: safeNumber(state.totalSaves),
    totalTypedCharacters: safeNumber(state.totalTypedCharacters),
    activeDays: safeNumber(state.activeDays),
    currentStreak: safeNumber(state.currentStreak),
    longestStreak: safeNumber(state.longestStreak),
    lastActiveDay: typeof state.lastActiveDay === 'string' ? state.lastActiveDay : undefined,
    languagesUsed: uniqueSortedStrings(state.languagesUsed),
    unlockedAchievementIds: uniqueOrderedStrings(state.unlockedAchievementIds),
    lastUnlockedAchievementId:
      typeof state.lastUnlockedAchievementId === 'string' ? state.lastUnlockedAchievementId : undefined,
  };
}

function safeNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function uniqueSortedStrings(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry) => typeof entry === 'string'))].sort();
}

function uniqueOrderedStrings(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((entry) => typeof entry === 'string'))];
}

function shouldTrackDocument(document: vscode.TextDocument): boolean {
  return document.uri.scheme === 'file' || document.uri.scheme === 'untitled';
}

function isTrackableLanguage(languageId: string): boolean {
  return languageId !== 'plaintext' && languageId !== 'log';
}

function calculateEditReward(
  changes: readonly vscode.TextDocumentContentChangeEvent[],
): { xp: number; insertedCharacters: number } {
  let insertedCharacters = 0;
  let touchedCharacters = 0;

  for (const change of changes) {
    insertedCharacters += change.text.length;
    touchedCharacters += change.text.length + change.rangeLength;
  }

  if (touchedCharacters < 3) {
    return { xp: 0, insertedCharacters };
  }

  const xp = Math.max(1, Math.min(20, Math.ceil(touchedCharacters / 18)));
  return { xp, insertedCharacters };
}

function getDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayDifference(previousDay: string, currentDay: string): number {
  const previous = dayKeyToUtc(previousDay);
  const current = dayKeyToUtc(currentDay);
  return Math.round((current - previous) / 86_400_000);
}

function dayKeyToUtc(dayKey: string): number {
  const [year, month, day] = dayKey.split('-').map((part) => Number.parseInt(part, 10));
  return Date.UTC(year, month - 1, day);
}

function toAchievementDefinition(achievement: AchievementDefinition): AchievementDefinition {
  return {
    ...achievement,
    group: {
      ...achievement.group,
    },
    tracking: cloneTrackingDefinition(achievement.tracking),
  };
}

function toAchievementProgress(
  achievement: AchievementDefinition,
  state: LevelUpState,
): AchievementProgress {
  const evaluation = evaluateAchievementTracking(achievement.tracking, state);

  return {
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    icon: achievement.icon,
    group: {
      ...achievement.group,
    },
    tracking: cloneTrackingDefinition(achievement.tracking),
    unlocked: evaluation.unlocked,
    progressPercent: evaluation.progressPercent,
    progressText: evaluation.progressText,
  };
}

function isAchievementUnlocked(achievement: AchievementDefinition, state: LevelUpState): boolean {
  return evaluateAchievementTracking(achievement.tracking, state).unlocked;
}

function evaluateAchievementTracking(
  tracking: AchievementTrackingDefinition,
  state: LevelUpState,
): AchievementEvaluation {
  switch (tracking.mode) {
    case 'threshold':
      return evaluateThresholdTracking(tracking, state);
    case 'ratio':
      return evaluateRatioTracking(tracking, state);
    case 'allOf':
      return evaluateAllOfTracking(tracking, state);
  }
}

function evaluateThresholdTracking(
  tracking: AchievementThresholdTrackingDefinition,
  state: LevelUpState,
): AchievementEvaluation {
  const current = getAchievementMetricValue(tracking.metric, state);
  return createValueEvaluation(current, tracking.target, tracking.unit, tracking.precision);
}

function evaluateRatioTracking(
  tracking: AchievementRatioTrackingDefinition,
  state: LevelUpState,
): AchievementEvaluation {
  const numerator = getAchievementMetricValue(tracking.numerator, state);
  const denominator = getAchievementMetricValue(tracking.denominator, state);
  const minimumDenominator = tracking.minDenominator ?? 1;

  const current = denominator >= minimumDenominator && denominator > 0
    ? (numerator / denominator) * (tracking.multiplier ?? 1)
    : 0;

  return createValueEvaluation(current, tracking.target, tracking.unit, tracking.precision);
}

function evaluateAllOfTracking(
  tracking: Extract<AchievementTrackingDefinition, { mode: 'allOf' }>,
  state: LevelUpState,
): AchievementEvaluation {
  const conditionEvaluations = tracking.conditions.map((condition) =>
    evaluateAchievementCondition(condition, state),
  );
  const completedConditions = conditionEvaluations.filter((evaluation) => evaluation.unlocked).length;
  const totalConditions = Math.max(1, conditionEvaluations.length);
  const averageProgress = conditionEvaluations.reduce(
    (sum, evaluation) => sum + evaluation.progressPercent,
    0,
  ) / totalConditions;

  return {
    unlocked: completedConditions === totalConditions,
    progressPercent: roundPercent(averageProgress),
    progressText: `${completedConditions}/${totalConditions} ${tracking.label ?? 'goals'} met`,
  };
}

function evaluateAchievementCondition(
  condition: AchievementTrackingConditionDefinition,
  state: LevelUpState,
): AchievementEvaluation {
  switch (condition.mode) {
    case 'threshold':
      return evaluateThresholdTracking(condition, state);
    case 'ratio':
      return evaluateRatioTracking(condition, state);
  }
}

function createValueEvaluation(
  current: number,
  target: number,
  unit: string,
  precision = 0,
): AchievementEvaluation {
  const normalizedCurrent = Math.max(0, current);
  const normalizedTarget = Math.max(target, Number.EPSILON);
  const unlocked = normalizedCurrent >= target;
  const displayCurrent = unlocked ? target : Math.min(normalizedCurrent, target);

  return {
    unlocked,
    progressPercent: unlocked
      ? 100
      : roundPercent((normalizedCurrent / normalizedTarget) * 100),
    progressText: `${formatTrackedValue(displayCurrent, precision)}/${formatTrackedValue(target, precision)} ${unit}`,
  };
}

function getAchievementMetricValue(metric: AchievementMetricType, state: LevelUpState): number {
  switch (metric) {
    case 'activeDays':
      return state.activeDays;
    case 'currentStreak':
      return state.currentStreak;
    case 'languagesUsed':
      return state.languagesUsed.length;
    case 'level':
      return calculateLevelProgress(state.totalXp).level;
    case 'longestStreak':
      return state.longestStreak;
    case 'totalEdits':
      return state.totalEdits;
    case 'totalSaves':
      return state.totalSaves;
    case 'totalTypedCharacters':
      return state.totalTypedCharacters;
    case 'totalXp':
      return state.totalXp;
  }
}

function cloneTrackingDefinition(
  tracking: AchievementTrackingDefinition,
): AchievementTrackingDefinition {
  switch (tracking.mode) {
    case 'threshold':
      return { ...tracking };
    case 'ratio':
      return { ...tracking };
    case 'allOf':
      return {
        ...tracking,
        conditions: tracking.conditions.map((condition) => ({ ...condition })),
      };
  }
}

function formatTrackedValue(value: number, precision = 0): string {
  if (precision > 0) {
    return Math.max(0, value).toLocaleString('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }

  return numberFormatter.format(Math.max(0, Math.round(value)));
}

export function calculateLevelProgress(totalXp: number): LevelProgress {
  let level = 1;
  let remainingXp = Math.max(0, totalXp);
  let xpForNextLevel = getXpRequiredForLevel(level);

  while (remainingXp >= xpForNextLevel) {
    remainingXp -= xpForNextLevel;
    level += 1;
    xpForNextLevel = getXpRequiredForLevel(level);
  }

  return {
    level,
    currentLevelXp: remainingXp,
    xpForNextLevel,
  };
}

function getXpRequiredForLevel(level: number): number {
  return 120 + (level - 1) * 60;
}

function roundPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}