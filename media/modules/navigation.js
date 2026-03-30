import { getTabIcon } from './icons.js';
import { escapeHtml } from './utils.js';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
];

export function isKnownTab(value) {
  return TABS.some((tab) => tab.id === value);
}

export function renderTabbar(activeTab) {
  return `
    <nav class="panel tabbar" style="--tab-count: ${TABS.length}" role="tablist" aria-label="Dashboard pages">
      ${TABS.map((tab) => renderTab(tab, activeTab)).join('')}
    </nav>
  `;
}

function renderTab(tab, activeTab) {
  const isActive = activeTab === tab.id;

  return `
    <button
      id="tab-${escapeHtml(tab.id)}"
      class="tab-button ${isActive ? 'is-active' : ''}"
      data-tab="${escapeHtml(tab.id)}"
      role="tab"
      aria-selected="${isActive}"
      aria-controls="page-${escapeHtml(tab.id)}"
      aria-label="${escapeHtml(tab.label)}"
      title="${escapeHtml(tab.label)}"
    >
      <span class="tab-button-inner">
        <span class="tab-icon" aria-hidden="true">${getTabIcon(tab.id)}</span>
        <span class="tab-label">${escapeHtml(tab.label)}</span>
      </span>
    </button>
  `;
}