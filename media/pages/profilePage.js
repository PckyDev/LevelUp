import { getLevelBadgeClass } from '../modules/levelBadge.js';
import { getAchievementBadgeIcon } from '../modules/icons.js';
import {
  renderTrait,
} from '../modules/renderers.js';
import { clamp, escapeHtml } from '../modules/utils.js';

export function renderProfilePage({ model, isActive }) {
  return `
    <section class="page ${isActive ? 'is-active' : ''}" id="page-profile" role="tabpanel" aria-labelledby="tab-profile">
      ${renderHeroPanel(model.hero)}

      ${renderLatestAchievementPanel(model.profile.latestAchievement)}

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Traits</h2>
            <p class="panel-copy">Derived from how you code, save, and keep momentum.</p>
          </div>
        </div>
        <div class="trait-list">
          ${model.profile.traits.map(renderTrait).join('')}
        </div>
      </section>
    </section>
  `;
}

function renderHeroPanel(hero) {
  return `
    <header class="panel hero">
      <div class="hero-top">
        <div class="hero-identity">
          <div class="portrait ${getLevelBadgeClass(hero.level)}" aria-label="Current level ${escapeHtml(hero.level)}">
            <span class="portrait-shine" aria-hidden="true"></span>
            <span class="portrait-prefix">LVL</span>
            <span class="portrait-level">${escapeHtml(hero.level)}</span>
          </div>
          <div class="hero-copy">
            <h1 class="hero-title">${escapeHtml(hero.title)}</h1>
            <div class="hero-meta">
              <span>${escapeHtml(hero.archetype)}</span>
            </div>
          </div>
        </div>
      </div>

      <section class="progress-block">
        <div class="progress-header">
          <div>
            <p class="section-label">Current Progress</p>
            <div class="progress-title">${escapeHtml(hero.xpRemaining)}</div>
          </div>
          <div class="progress-value">${escapeHtml(hero.xpText)}</div>
        </div>
        <div class="meter">
          <div class="meter-fill progress-fill" style="width: ${clamp(hero.xpPercent)}%"></div>
        </div>
        <p class="progress-caption">Keep coding to push this run to the next level.</p>
      </section>
    </header>
  `;
}

function renderLatestAchievementPanel(achievement) {
  if (!achievement) {
    return '';
  }

  const seriesText = achievement.tierCount > 1
    ? `${achievement.groupTitle} · Tier ${achievement.tierLabel} of ${achievement.tierCount}`
    : 'Most recently unlocked';

  return `
    <section class="panel latest-achievement-panel">
      <div class="latest-achievement-medal is-unlocked">
        <div class="latest-achievement-medal-inner">${getAchievementBadgeIcon(achievement.icon)}</div>
      </div>
      <div class="latest-achievement-copy">
        <p class="section-label">Latest Achievement</p>
        <h2 class="panel-title">${escapeHtml(achievement.title)}</h2>
        <p class="latest-achievement-meta">${escapeHtml(seriesText)}</p>
        <p class="panel-copy">${escapeHtml(achievement.description)}</p>
      </div>
    </section>
  `;
}