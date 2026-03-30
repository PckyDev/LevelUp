import {
  renderDataCard,
  renderInfoRow,
  renderLanguageChips,
  renderLedgerRow,
} from '../modules/renderers.js';

export function renderStatsPage({ model, isActive }) {
  return `
    <section class="page ${isActive ? 'is-active' : ''}" id="page-stats" role="tabpanel" aria-labelledby="tab-stats">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Overview</h2>
            <p class="panel-copy">A quick read on your current coding run.</p>
          </div>
        </div>
        <div class="summary-grid">
          ${model.stats.overviewCards.map((card) => renderDataCard(card, 'summary-card')).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Key Metrics</h2>
            <p class="panel-copy">The main numbers behind this run.</p>
          </div>
        </div>
        <div class="metric-grid">
          ${model.stats.cards.map((card) => renderDataCard(card, 'metric-card')).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Activity Ledger</h2>
            <p class="panel-copy">Ratios and pacing for how this profile is developing.</p>
          </div>
        </div>
        <div class="ledger-list">
          ${model.stats.ledger.map(renderLedgerRow).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Languages and Activity</h2>
            <p class="panel-copy">Tracked language affinities and streak notes.</p>
          </div>
        </div>
        <div class="chip-row">
          ${renderLanguageChips(model.stats.languages)}
        </div>
        <div class="info-list">
          ${model.stats.notes.map(renderInfoRow).join('')}
        </div>
      </section>
    </section>
  `;
}