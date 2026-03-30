import { renderTabbar, isKnownTab } from './modules/navigation.js';
import { bindResponsiveTabbar } from './modules/tabbar.js';
import { parseModel } from './modules/utils.js';
import { renderAchievementsPage, renderAchievementDetail } from './pages/achievementsPage.js';
import { renderProfilePage } from './pages/profilePage.js';
import { renderSettingsPage } from './pages/settingsPage.js';
import { renderStatsPage } from './pages/statsPage.js';

const vscode = acquireVsCodeApi();
const root = document.getElementById('app');

if (root instanceof HTMLElement) {
  bootstrap(root);
}

function bootstrap(rootElement) {
  const persistedState = vscode.getState() || {};

  let activeTab = isKnownTab(persistedState.activeTab)
    ? persistedState.activeTab
    : persistedState.activeTab === 'overview'
      ? 'stats'
      : 'profile';
  let model = parseModel(rootElement.dataset.model);
  let selectedAchievementId = null;
  let disposeTabbarObserver = null;

  rootElement.addEventListener('click', handleRootClick);
  window.addEventListener('message', handleWindowMessage);
  window.addEventListener('keydown', handleWindowKeydown);

  render();

  function render() {
    if (disposeTabbarObserver) {
      disposeTabbarObserver();
      disposeTabbarObserver = null;
    }

    rootElement.className = 'shell';
    rootElement.innerHTML = `
      <div class="dashboard">
        ${renderTabbar(activeTab)}

        <main class="pages">
          ${renderProfilePage({ model, isActive: activeTab === 'profile' })}
          ${renderAchievementsPage({ model, isActive: activeTab === 'achievements' })}
          ${renderStatsPage({ model, isActive: activeTab === 'stats' })}
          ${renderSettingsPage({ model, isActive: activeTab === 'settings' })}
        </main>

        ${renderAchievementDetail({
          achievement: findAchievementById(selectedAchievementId),
          group: findAchievementGroupByAchievementId(selectedAchievementId),
        })}
      </div>
    `;

    const tabbar = rootElement.querySelector('.tabbar');
    if (tabbar instanceof HTMLElement) {
      disposeTabbarObserver = bindResponsiveTabbar(tabbar);
    }
      rootElement.addEventListener('click', handleRootClick);
      rootElement.addEventListener('change', handleRootChange);
    vscode.setState({ activeTab });
  }

  function handleWindowMessage(event) {
    const message = event.data;
    if (!message || message.type !== 'snapshot') {
      return;
    }

    model = message.payload;
    if (selectedAchievementId && !findAchievementById(selectedAchievementId)) {
      selectedAchievementId = null;
    }

    render();
  }

  function handleWindowKeydown(event) {
    if (event.key === 'Escape' && selectedAchievementId) {
      selectedAchievementId = null;
      render();
      return;
    }

    if (!selectedAchievementId) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      const previousAchievementId = getAdjacentAchievementId(selectedAchievementId, -1);
      if (previousAchievementId) {
        selectedAchievementId = previousAchievementId;
        render();
      }
      return;
    }

    if (event.key === 'ArrowRight') {
      const nextAchievementId = getAdjacentAchievementId(selectedAchievementId, 1);
      if (nextAchievementId) {
        selectedAchievementId = nextAchievementId;
        render();
      }
    }
  }

  function handleRootClick(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const tabButton = event.target.closest('[data-tab]');
    if (tabButton instanceof HTMLElement) {
      const nextTab = tabButton.getAttribute('data-tab');
      if (!isKnownTab(nextTab)) {
        return;
      }

      activeTab = nextTab;
      if (nextTab !== 'achievements') {
        selectedAchievementId = null;
      }

      render();
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (actionButton instanceof HTMLElement) {
      const action = actionButton.getAttribute('data-action');
      if (action) {
        vscode.postMessage({ type: action });
      }
      return;
    }

    const achievementNavigationButton = event.target.closest('[data-achievement-target-id]');
    if (achievementNavigationButton instanceof HTMLElement) {
      const achievementId = achievementNavigationButton.getAttribute('data-achievement-target-id');
      if (achievementId) {
        selectedAchievementId = achievementId;
        render();
      }
      return;
    }

    const achievementButton = event.target.closest('[data-achievement-id]');
    if (achievementButton instanceof HTMLElement) {
      const achievementId = achievementButton.getAttribute('data-achievement-id');
      if (achievementId) {
        selectedAchievementId = achievementId;
        render();
      }
      return;
    }

    const closeButton = event.target.closest('[data-close-achievement]');
    if (closeButton instanceof HTMLElement) {
      selectedAchievementId = null;
      render();
      return;
    }

    const overlay = event.target.closest('[data-achievement-overlay]');
    if (overlay instanceof HTMLElement && event.target === overlay) {
      selectedAchievementId = null;
      render();
    }
  }

  function handleRootChange(event) {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    const settingKey = event.target.getAttribute('data-setting-key');
    if (!settingKey) {
      return;
    }

    vscode.postMessage({
      type: 'updateSetting',
      key: settingKey,
      value: event.target.checked,
    });
  }

  function findAchievementById(achievementId) {
    if (!achievementId || !model?.achievements?.groups) {
      return null;
    }

    for (const group of model.achievements.groups) {
      const achievement = group.cards.find((entry) => entry.id === achievementId);
      if (achievement) {
        return achievement;
      }
    }

    return null;
  }

  function findAchievementGroupByAchievementId(achievementId) {
    if (!achievementId || !model?.achievements?.groups) {
      return null;
    }

    return model.achievements.groups.find((group) =>
      group.cards.some((achievement) => achievement.id === achievementId),
    ) || null;
  }

  function getAdjacentAchievementId(achievementId, direction) {
    const group = findAchievementGroupByAchievementId(achievementId);
    if (!group) {
      return null;
    }

    const currentIndex = group.cards.findIndex((achievement) => achievement.id === achievementId);
    if (currentIndex === -1) {
      return null;
    }

    const targetAchievement = group.cards[currentIndex + direction];
    return targetAchievement?.id || null;
  }
}