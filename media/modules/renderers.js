import { clamp, escapeHtml } from './utils.js';

export function renderDataCard(card, className) {
  return `
    <article class="${escapeHtml(className)}">
      <span class="card-label">${escapeHtml(card.label)}</span>
      <span class="card-value">${escapeHtml(card.value)}</span>
      <p class="card-hint">${escapeHtml(card.hint)}</p>
    </article>
  `;
}

export function renderTrait(trait) {
  return `
    <article class="trait-row">
      <div class="trait-header">
        <span class="row-title">${escapeHtml(trait.name)}</span>
        <span class="tier-badge">${escapeHtml(trait.tier)}</span>
      </div>
      <div class="meter">
        <div class="meter-fill trait-fill" style="width: ${clamp(trait.value)}%"></div>
      </div>
    </article>
  `;
}

export function renderLanguageChips(languages) {
  if (!Array.isArray(languages) || languages.length === 0) {
    return '<span class="empty-state">No tracked languages yet.</span>';
  }

  return languages
    .map((language) => `<span class="chip">${escapeHtml(language)}</span>`)
    .join('');
}

export function renderInfoRow(note) {
  return `
    <article class="info-row">
      <span class="row-title">${escapeHtml(note.label)}</span>
      <span class="row-value">${escapeHtml(note.value)}</span>
    </article>
  `;
}

export function renderLedgerRow(row) {
  return `
    <article class="ledger-row">
      <div class="ledger-top">
        <span class="row-title">${escapeHtml(row.label)}</span>
        <span class="row-value">${escapeHtml(row.value)}</span>
      </div>
      <p class="panel-copy">${escapeHtml(row.hint)}</p>
    </article>
  `;
}

export function renderSettingsAction(title, description, action, isDanger = false) {
  const dangerClass = isDanger ? ' is-danger' : '';

  return `
    <button class="settings-action-card${dangerClass}" type="button" data-action="${escapeHtml(action)}">
      <span class="settings-action-title">${escapeHtml(title)}</span>
      <span class="settings-action-copy">${escapeHtml(description)}</span>
    </button>
  `;
}

export function renderSettingsNote(note) {
  return `
    <article class="settings-note">
      <span class="settings-note-label">${escapeHtml(note.label)}</span>
      <p class="settings-note-copy">${escapeHtml(note.value)}</p>
    </article>
  `;
}

export function renderSettingsToggle(toggle) {
  const checkedAttribute = toggle.checked ? ' checked' : '';

  return `
    <label class="settings-toggle-card" for="${escapeHtml(toggle.id)}">
      <div class="settings-toggle-copy">
        <span class="settings-toggle-title">${escapeHtml(toggle.title)}</span>
        <span class="settings-toggle-description">${escapeHtml(toggle.description)}</span>
      </div>
      <span class="settings-toggle-control">
        <input
          class="settings-toggle-input"
          id="${escapeHtml(toggle.id)}"
          type="checkbox"
          data-setting-key="${escapeHtml(toggle.settingKey)}"
          ${checkedAttribute}
        />
        <span class="settings-toggle-switch" aria-hidden="true"></span>
      </span>
    </label>
  `;
}