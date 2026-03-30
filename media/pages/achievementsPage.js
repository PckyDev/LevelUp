import { getAchievementBadgeIcon } from '../modules/icons.js';
import { renderMeter } from '../modules/renderers.js';
import { escapeHtml } from '../modules/utils.js';

export function renderAchievementsPage({ model, isActive }) {
  const groups = Array.isArray(model?.achievements?.groups) ? model.achievements.groups : [];

  return `
    <section class="page ${isActive ? 'is-active' : ''}" id="page-achievements" role="tabpanel" aria-labelledby="tab-achievements">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Next Milestone</h2>
            <p class="panel-copy">Your next unlock target.</p>
          </div>
        </div>
        <div class="callout">${escapeHtml(model.achievements.nextMilestone)}</div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Achievement Gallery</h2>
            <p class="panel-copy">Each group shows the current tier you are pushing toward. Open one to browse the full chain.</p>
          </div>
        </div>
        <div class="achievement-grid">
          ${groups.map(renderAchievementBadge).join('')}
        </div>
      </section>
    </section>
  `;
}

export function renderAchievementDetail({ achievement, group }) {
  if (!achievement || !group) {
    return '';
  }

  const unlockedClass = achievement.unlocked ? ' is-unlocked' : '';
  const statusClass = achievement.unlocked ? 'achievement-status is-unlocked' : 'achievement-status';
  const statusLabel = achievement.unlocked ? 'Achieved' : 'In progress';
  const previousAchievement = getAdjacentAchievement(group, achievement.id, -1);
  const nextAchievement = getAdjacentAchievement(group, achievement.id, 1);

  return `
    <div class="achievement-dialog-backdrop" data-achievement-overlay>
      <section class="achievement-dialog panel" role="dialog" aria-modal="true" aria-labelledby="achievement-detail-title">
        <button class="dialog-close" type="button" aria-label="Close achievement details" data-close-achievement>
          <span aria-hidden="true">×</span>
        </button>

        <div class="achievement-dialog-hero">
          <div class="achievement-dialog-medal-row">
            ${renderAchievementNavButton('Previous tier', previousAchievement, 'left')}

            <div class="achievement-dialog-medal${unlockedClass}">
              <div class="achievement-dialog-medal-inner">${getAchievementBadgeIcon(achievement.icon)}</div>
            </div>

            ${renderAchievementNavButton('Next tier', nextAchievement, 'right')}
          </div>

          <div class="achievement-dialog-copy">
            <p class="section-label">${escapeHtml(group.totalCount > 1 ? 'Achievement Series' : 'Achievement')}</p>
            <h3 class="achievement-dialog-title" id="achievement-detail-title">${escapeHtml(achievement.title)}</h3>
            ${renderAchievementSeriesMeta(group, achievement)}
            <span class="${statusClass}">${escapeHtml(statusLabel)}</span>
            <p class="achievement-copy">${escapeHtml(achievement.description)}</p>
          </div>
        </div>

        <div class="achievement-detail-progress">
          <div class="progress-header">
            <div>
              <p class="section-label">Progress</p>
              <div class="progress-title">${escapeHtml(achievement.progressText)}</div>
            </div>
          </div>
          ${renderMeter(achievement.progressPercent, 'achievement-fill', `${achievement.title} progress`)}
          <p class="progress-caption">${escapeHtml(
            achievement.unlocked
              ? 'This achievement has been unlocked.'
              : 'Keep working toward this unlock.',
          )}</p>
        </div>
      </section>
    </div>
  `;
}

function renderAchievementBadge(group) {
  const achievement = group.currentCard;
  const unlockedClass = achievement.unlocked ? ' is-unlocked' : '';
  const badgeTitle = group.totalCount > 1 ? group.title : achievement.title;

  return `
    <button
      class="achievement-badge${unlockedClass}"
      type="button"
      data-achievement-id="${escapeHtml(achievement.id)}"
      aria-haspopup="dialog"
      aria-label="${escapeHtml(achievement.title)}"
    >
      <span class="achievement-medal${unlockedClass}">
        <span class="achievement-medal-inner">${getAchievementBadgeIcon(achievement.icon)}</span>
        <span class="achievement-medal-shine"></span>
      </span>
      <span class="achievement-badge-title">${escapeHtml(badgeTitle)}</span>
      <span class="achievement-badge-tier">${escapeHtml(getAchievementBadgeTierText(group, achievement))}</span>
      <span class="achievement-badge-progress">${escapeHtml(achievement.progressText)}</span>
    </button>
  `;
}

function renderAchievementDialogNavigation(group, achievement, previousAchievement, nextAchievement) {
  if (group.totalCount <= 1) {
    return '';
  }

  return `
    <div class="achievement-dialog-nav">
      ${renderAchievementNavButton('Previous tier', previousAchievement, '‹')}
      <div class="achievement-dialog-nav-copy">
        <span class="achievement-nav-title">${escapeHtml(group.title)}</span>
        <span class="achievement-nav-subtitle">${escapeHtml(getTierPositionText(group, achievement))}</span>
      </div>
      ${renderAchievementNavButton('Next tier', nextAchievement, '›')}
    </div>
  `;
}

function renderAchievementNavButton(label, targetAchievement, chevron) {
  const targetAttribute = targetAchievement
    ? ` data-achievement-target-id="${escapeHtml(targetAchievement.id)}"`
    : ' disabled';

  return `
    <button class="achievement-nav-button" type="button" aria-label="${escapeHtml(label)}"${targetAttribute}>
      <span class="achievement-nav-button-icon" aria-hidden="true">${renderAchievementChevronIcon(chevron)}</span>
    </button>
  `;
}

function renderAchievementSeriesMeta(group, achievement) {
  if (group.totalCount <= 1) {
    return '';
  }

  return `
    <p class="achievement-series-meta">${escapeHtml(`${group.title} · ${getTierPositionText(group, achievement)}`)}</p>
  `;
}

function getAchievementBadgeTierText(group, achievement) {
  if (group.totalCount <= 1) {
    return achievement.unlocked ? 'Completed challenge' : 'Challenge in progress';
  }

  return `${getTierPositionText(group, achievement)} · ${group.unlockedCount}/${group.totalCount} unlocked`;
}

function getTierPositionText(group, achievement) {
  return `Tier ${achievement.tierLabel} of ${group.totalCount}`;
}

function getAdjacentAchievement(group, achievementId, direction) {
  const currentIndex = group.cards.findIndex((entry) => entry.id === achievementId);
  if (currentIndex === -1) {
    return null;
  }

  return group.cards[currentIndex + direction] || null;
}

function renderAchievementChevronIcon(direction) {
  const path = direction === 'left'
    ? '<path d="M14.5 5.5L9 11L14.5 16.5"></path>'
    : '<path d="M9.5 5.5L15 11L9.5 16.5"></path>';

  return `
    <svg viewBox="0 0 24 24" focusable="false">
      ${path}
    </svg>
  `;
}