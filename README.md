# Level Up

Level Up is a VS Code extension that turns day to day coding into a lightweight progression system. As you edit and save files, you earn XP, unlock achievements, build streaks, and level up over time.

## What This MVP Does

- Awards XP for meaningful text edits.
- Awards bonus XP when files are saved.
- Tracks a daily streak and active days.
- Unlocks a large achievement catalog with milestone, ratio, and combo challenges.
- Shows progress in both the status bar and a dedicated RPG-style Level Up sidebar.
- Plays a confetti-style editor celebration when you level up or unlock achievements.
- Splits the dashboard into Profile, Achievements, Stats, and Settings pages.
- Shows achievements as badge-style medals with one visible active tier per group and a larger detail view with tier navigation.
- Persists progress through VS Code global state, so your stats survive restarts.

## How The Extension Is Structured

- `src/extension.ts` wires the VS Code APIs together.
- `data/achievements.json` contains the achievement catalog, including expandable tier series and one-off combo challenges.
- `src/achievementCatalog.ts` validates the catalog and expands tier series into concrete achievements.
- `src/levelUpService.ts` owns XP, levels, achievements, persistence, and activity tracking.
- `src/levelUpDashboardProvider.ts` renders the RPG dashboard webview in the Activity Bar.
- `media/dashboard.js` is the webview entrypoint.
- `media/pages/` contains one file per dashboard page.
- `media/modules/` contains shared dashboard rendering helpers and UI utilities.
- `media/styles/` contains the split dashboard stylesheets.
- `media/level-up.svg` is the custom Activity Bar icon.

If you want to tweak achievements, the fastest place to start is `data/achievements.json`. The catalog supports threshold, ratio, and all-of combo tracking. If you want to tweak XP balance, start in `src/levelUpService.ts`.

Editor celebration settings live under `levelUp.effects.*` in VS Code settings and can also be toggled from the Settings page in the dashboard.

## How To Run It Locally

1. Install dependencies:

	```bash
	npm install
	```

2. Compile the extension:

	```bash
	npm run compile
	```

3. Press `F5` in VS Code.

VS Code will open a second window called the Extension Development Host. That second window runs your extension in isolation.

## How To Use It

1. Open the Extension Development Host.
2. Edit code in tracked files to earn XP.
3. Save files to earn save XP.
4. Click the Level Up icon in the Activity Bar to view your dashboard.
5. Swap between Profile, Achievements, Stats, and Settings in the dashboard tabs.
6. Click an achievement badge to inspect its description, full progress bar, and move left or right through the other tiers in that group.
7. Use the Command Palette for:
	- `Level Up: Show Summary`
	- `Level Up: Open Dashboard`
	- `Level Up: Reset Progress`

## How VS Code Extensions Work, In Plain English

Your extension is a Node.js process that VS Code loads when one of its activation events happens. In this project, activation happens on startup, when the Level Up view opens, or when one of the Level Up commands is run.

Once activated, the extension can subscribe to editor events like file changes and saves. Level Up listens to those events, updates the player state in memory, persists it with VS Code storage, and refreshes the UI.

## Packaging Later

If you want to turn this into an installable `.vsix` later, first change the `publisher` field in `package.json` to your own publisher name. Then package it with a tool like `vsce`.

Example:

```bash
npx @vscode/vsce package
```

## Next Good Improvements

- Add settings so users can tune XP rates and notification volume.
- Add more achievements and a rarity system.
- Add a webview dashboard with charts, badges, and session summaries.
- Add workspace specific quests or team leaderboards.

