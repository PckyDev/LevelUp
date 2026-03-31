import * as vscode from 'vscode';

import { CelebrationEffectManager } from './celebrationEffectManager';
import { LevelUpDashboardProvider } from './levelUpDashboardProvider';
import { LevelUpService } from './levelUpService';
import { ActivityResult, LevelUpSnapshot } from './types';

let service: LevelUpService | undefined;

export function activate(context: vscode.ExtensionContext): void {
  service = new LevelUpService(context);

  const dashboardProvider = new LevelUpDashboardProvider(context.extensionUri, service);
  const celebrationEffects = new CelebrationEffectManager(context);

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.name = 'Level Up';
  statusBar.command = 'levelUp.openDashboard';

  const refreshUi = (): void => {
    if (!service) {
      return;
    }

    dashboardProvider.refresh();
    updateStatusBar(statusBar, service.getSnapshot());
  };

  refreshUi();
  statusBar.show();

  service.onDidChange(refreshUi, undefined, context.subscriptions);

  context.subscriptions.push(
    statusBar,
    celebrationEffects,
    vscode.window.registerWebviewViewProvider('levelUp.dashboard', dashboardProvider),
    vscode.commands.registerCommand('levelUp.openDashboard', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.levelUp');
    }),
    vscode.commands.registerCommand('levelUp.showSummary', () => {
      if (!service) {
        return;
      }

      showSummary(service.getSnapshot());
    }),
    vscode.commands.registerCommand('levelUp.resetProgress', async () => {
      if (!service) {
        return;
      }

      const confirmation = await vscode.window.showWarningMessage(
        'Reset all Level Up XP, streaks, and achievements?',
        { modal: true },
        'Reset Progress',
      );

      if (confirmation !== 'Reset Progress') {
        return;
      }

      await service.resetProgress();
      void vscode.window.showInformationMessage('Level Up progress reset.');
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const result = service?.handleTextChange(event);
      if (result) {
        celebrate(result, celebrationEffects, findEditorForDocument(event.document));
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      const result = service?.handleSave(document);
      if (result) {
        celebrate(result, celebrationEffects, findEditorForDocument(document));
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      service?.handleDocumentClosed(document);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('levelUp.effects')) {
        dashboardProvider.refresh();
      }
    }),
  );
}

export function deactivate(): Thenable<void> | undefined {
  return service?.dispose();
}

function updateStatusBar(statusBar: vscode.StatusBarItem, snapshot: LevelUpSnapshot): void {
  const { progress, state, unlockedAchievements } = snapshot;
  statusBar.text = `$(rocket) Lv ${progress.level} ${progress.currentLevelXp}/${progress.xpForNextLevel} XP`;

  const tooltip = new vscode.MarkdownString();
  tooltip.appendMarkdown('**Level Up**\n\n');
  tooltip.appendMarkdown(`Level: ${progress.level}\n\n`);
  tooltip.appendMarkdown(`Lifetime XP: ${state.totalXp}\n\n`);
  tooltip.appendMarkdown(`Current streak: ${state.currentStreak} day(s)\n\n`);
  tooltip.appendMarkdown(`Achievements: ${unlockedAchievements.length} unlocked\n\n`);
  tooltip.appendMarkdown('Click to open the Level Up dashboard.');
  statusBar.tooltip = tooltip;
}

function showSummary(snapshot: LevelUpSnapshot): void {
  const { progress, state, unlockedAchievements, lockedAchievements } = snapshot;
  const totalAchievements = unlockedAchievements.length + lockedAchievements.length;

  void vscode.window.showInformationMessage(
    `Level ${progress.level} | ${progress.currentLevelXp}/${progress.xpForNextLevel} XP | ${state.totalSaves} saves | ${unlockedAchievements.length}/${totalAchievements} achievements unlocked. Open the Level Up view in the Activity Bar for details.`,
  );
}

function celebrate(
  result: ActivityResult,
  effects: CelebrationEffectManager,
  editor: vscode.TextEditor | undefined,
): void {
  if (result.currentLevel > result.previousLevel) {
    effects.celebrate(editor, 'level');
  } else if (result.newlyUnlockedAchievements.length > 0) {
    effects.celebrate(editor, 'achievement');
  }

  if (result.currentLevel > result.previousLevel) {
    void vscode.window.showInformationMessage(
      `Level Up reached level ${result.currentLevel}! +${result.xpGained} XP`,
    );
  }

  for (const achievement of result.newlyUnlockedAchievements) {
    void vscode.window.showInformationMessage(
      `Achievement unlocked: ${achievement.title} - ${achievement.description}`,
    );
  }
}

function findEditorForDocument(document: vscode.TextDocument): vscode.TextEditor | undefined {
  return vscode.window.visibleTextEditors.find(
    (editor) => editor.document.uri.toString() === document.uri.toString(),
  );
}