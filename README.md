# Level Up

Level Up is a VS Code extension that turns everyday coding into a lightweight progression system. As you work, you earn XP for meaningful edits, get bonus XP on saves, unlock achievements, build streaks, and level up over time.

It is designed to make normal coding feel a little more rewarding without getting in the way of the editor.

## Features

- Earn XP from real coding activity.
- Get bonus XP when you save files.
- Level up as your total progress grows.
- Track streaks, active days, typed characters, and language usage.
- Unlock a 100-achievement catalog with milestone, ratio, and combo challenges.
- See progress in the status bar and in a dedicated Level Up sidebar.
- Browse a full dashboard with Profile, Achievements, Stats, and Settings pages.
- View achievements as medal-style badges with tier navigation.
- Trigger editor celebrations for level-ups and achievement unlocks.
- Keep progress between sessions with persistent local storage.

## How It Works

1. Open a project and start coding.
2. Meaningful edits award XP in the background.
3. Saving files adds bonus XP.
4. As your totals grow, Level Up updates your level, streaks, traits, and achievements.
5. Open the Level Up icon in the Activity Bar to see your full dashboard.

## Dashboard

- Profile shows your current level, XP progress, coding archetype, latest achievement, and trait summary.
- Achievements shows your current visible medal for each achievement line, along with a detail view for inspecting tiers.
- Stats shows overview cards, activity metrics, XP totals, and language usage.
- Settings gives you quick actions plus effect toggles for editor celebrations and reduced motion.

## Commands

- `Level Up: Open Dashboard`
- `Level Up: Show Summary`
- `Level Up: Reset Progress`

## Settings

- `levelUp.effects.editorCelebrations` enables or disables in-editor celebration bursts.
- `levelUp.effects.reducedMotion` switches celebrations to a shorter, lighter animation style.

These settings are available both in VS Code Settings and inside the Level Up dashboard.

## Progress And Storage

- Level Up stores progress in VS Code global state.
- Your XP, level, achievements, and streak data persist across restarts.
- No external account, online service, or backend is required.

## Running From Source

If you are trying the repository directly instead of installing from the Marketplace, use the standard VS Code extension workflow:

1. Install dependencies.

	```bash
	npm install
	```

2. Compile the extension.

	```bash
	npm run compile
	```

3. Press `F5` in VS Code.

VS Code will open an Extension Development Host window with Level Up loaded.

## Packaging

To build an installable `.vsix` package:

```bash
npm run package
```