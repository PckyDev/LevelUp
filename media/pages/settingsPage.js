import { renderSettingsAction, renderSettingsNote, renderSettingsToggle } from '../modules/renderers.js';

export function renderSettingsPage({ model, isActive }) {
  return `
    <section class="page ${isActive ? 'is-active' : ''}" id="page-settings" role="tabpanel" aria-labelledby="tab-settings">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Effects</h2>
            <p class="panel-copy">Tune how celebration effects behave in the editor.</p>
          </div>
        </div>
        <div class="settings-toggle-list">
          ${renderSettingsToggle({
            id: 'toggle-editor-celebrations',
            title: 'Editor Celebrations',
            description: 'Show confetti bursts in the active editor for level-ups and achievement unlocks.',
            settingKey: 'effects.editorCelebrations',
            checked: Boolean(model.settings.editorCelebrations),
          })}
          ${renderSettingsToggle({
            id: 'toggle-reduced-motion',
            title: 'Reduced Motion',
            description: 'Use shorter, lighter celebration animations with less movement.',
            settingKey: 'effects.reducedMotion',
            checked: Boolean(model.settings.reducedMotion),
          })}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Actions</h2>
            <p class="panel-copy">Run quick extension actions from here.</p>
          </div>
        </div>
        <div class="settings-action-grid">
          ${renderSettingsAction(
            'Quick Summary',
            'Open a short snapshot of your current level, XP, saves, and achievements.',
            'showSummary',
          )}
          ${renderSettingsAction(
            'Reset Progress',
            'Clear XP, streaks, and unlocked achievements for a fresh run.',
            'resetProgress',
            true,
          )}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Storage</h2>
            <p class="panel-copy">How Level Up stores your progress.</p>
          </div>
        </div>
        <div class="settings-note-list">
          ${renderSettingsNote({
            label: 'Saved Automatically',
            value: 'Progress is stored in VS Code global state as you code.',
          })}
          ${renderSettingsNote({
            label: 'Workspace Scope',
            value: 'Your Level Up data follows your VS Code profile, not just this repo.',
          })}
          ${renderSettingsNote({
            label: 'Reset Behavior',
            value: 'Reset removes XP, streaks, tracked languages, and achievements.',
          })}
        </div>
      </section>
    </section>
  `;
}