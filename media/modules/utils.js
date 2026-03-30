export function parseModel(raw) {
  if (!raw) {
    return emptyModel();
  }

  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return emptyModel();
  }
}

export function emptyModel() {
  return {
    hero: {
      title: 'Novice Scribe',
      archetype: 'Fresh Adventurer',
      level: '1',
      xpText: '0 / 0 XP',
      xpRemaining: '0 XP to level 2',
      xpPercent: 0,
    },
    profile: {
      latestAchievement: null,
      traits: [],
    },
    achievements: {
      nextMilestone: 'No achievements available.',
      groups: [],
    },
    stats: {
      overviewCards: [],
      cards: [],
      ledger: [],
      languages: [],
      notes: [],
    },
    settings: {
      editorCelebrations: true,
      reducedMotion: false,
    },
  };
}

export function clamp(value) {
  const safeValue = Number(value);
  if (!Number.isFinite(safeValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, safeValue));
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}