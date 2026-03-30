import * as vscode from 'vscode';

type CelebrationKind = 'achievement' | 'level';

interface CelebrationConfig {
  pieceCount: number;
  durationMs: number;
  maxStartLines: number;
  fallDistanceEm: number;
  driftEm: number;
  spinTurns: number;
  scaleMin: number;
  scaleMax: number;
}

interface CelebrationPiece {
  anchor: vscode.Range;
  icon: vscode.Uri;
  baseXEm: number;
  baseYEm: number;
  driftXEm: number;
  fallDistanceEm: number;
  rotationDeg: number;
  spinDeg: number;
  scale: number;
}

interface RunningAnimation {
  timer: ReturnType<typeof setTimeout> | undefined;
  pieces: CelebrationPiece[];
  startedAt: number;
  durationMs: number;
}

const FRAME_MS = 50;
const COLOR_PALETTES: Record<CelebrationKind, readonly string[]> = {
  achievement: ['#f59e0b', '#f97316', '#38bdf8', '#22c55e', '#f43f5e', '#fde047'],
  level: ['#fff0a9', '#f59e0b', '#eab308', '#5eead4', '#60a5fa', '#f472b6'],
};

const SHAPES = [
  '<rect x="2" y="2" width="8" height="8" rx="1.6" transform="rotate(12 6 6)" />',
  '<circle cx="6" cy="6" r="4" />',
  '<path d="M6 1.5L10.5 10.5H1.5Z" />',
  '<rect x="3.25" y="1.5" width="5.5" height="9" rx="1.2" transform="rotate(-24 6 6)" />',
];

export class CelebrationEffectManager implements vscode.Disposable {
  private readonly decorationType: vscode.TextEditorDecorationType;
  private readonly activeAnimations = new Map<vscode.TextEditor, RunningAnimation>();
  private readonly iconsByKind: Record<CelebrationKind, vscode.Uri[]>;
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(private readonly context: vscode.ExtensionContext) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      after: {
        margin: '0',
      },
    });

    this.iconsByKind = {
      achievement: this.buildIcons(COLOR_PALETTES.achievement),
      level: this.buildIcons(COLOR_PALETTES.level),
    };

    this.disposables.push(
      this.decorationType,
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        this.cleanupInvisibleEditors(editors);
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('levelUp.effects.reducedMotion')) {
          this.clearActiveAnimations();
        }
        if (event.affectsConfiguration('levelUp.effects.editorCelebrations')) {
          const enabled = this.getSettings().enabled;
          if (!enabled) {
            this.clearActiveAnimations();
          }
        }
      }),
    );
  }

  public celebrate(editor: vscode.TextEditor | undefined, kind: CelebrationKind): void {
    if (!editor) {
      return;
    }

    const settings = this.getSettings();
    if (!settings.enabled) {
      return;
    }

    const config = this.getCelebrationConfig(kind, settings.reducedMotion);
    const pieces = this.createPieces(editor, kind, config);

    if (pieces.length === 0) {
      return;
    }

    this.stopAnimation(editor);

    const animation: RunningAnimation = {
      timer: undefined,
      pieces,
      startedAt: Date.now(),
      durationMs: config.durationMs,
    };

    this.activeAnimations.set(editor, animation);
    this.renderAnimationFrame(editor, animation);
  }

  public dispose(): void {
    for (const editor of this.activeAnimations.keys()) {
      this.stopAnimation(editor);
    }

    this.activeAnimations.clear();
    vscode.Disposable.from(...this.disposables).dispose();
  }

  private renderAnimationFrame(editor: vscode.TextEditor, animation: RunningAnimation): void {
    const elapsed = Date.now() - animation.startedAt;
    const progress = Math.max(0, Math.min(1, elapsed / animation.durationMs));

    if (progress >= 1) {
      this.stopAnimation(editor);
      return;
    }

    const decorations = animation.pieces.map((piece) => {
      const x = piece.baseXEm + piece.driftXEm * progress;
      const y = piece.baseYEm + piece.fallDistanceEm * progress * progress;
      const rotation = piece.rotationDeg + piece.spinDeg * progress;
      const opacity = 1 - progress;

      return {
        range: piece.anchor,
        renderOptions: {
          after: {
            contentIconPath: piece.icon,
            height: `${piece.scale.toFixed(3)}em`,
            width: '0',
            textDecoration: `none; position:absolute; display:inline-block; line-height:0; pointer-events:none; opacity:${opacity.toFixed(3)}; transform: translate(${x.toFixed(3)}em, ${y.toFixed(3)}em) rotate(${rotation.toFixed(1)}deg); transform-origin:center; z-index:1000;`,
          },
        },
      } satisfies vscode.DecorationOptions;
    });

    editor.setDecorations(this.decorationType, decorations);

    animation.timer = setTimeout(() => {
      if (!this.activeAnimations.has(editor)) {
        return;
      }

      this.renderAnimationFrame(editor, animation);
    }, FRAME_MS);
  }

  private createPieces(
    editor: vscode.TextEditor,
    kind: CelebrationKind,
    config: CelebrationConfig,
  ): CelebrationPiece[] {
    const icons = this.iconsByKind[kind];
    const visibleRange = editor.visibleRanges[0];
    const selection = editor.selection.active;
    const firstVisibleLine = visibleRange?.start.line ?? selection.line;
    const lastVisibleLine = visibleRange?.end.line ?? selection.line;
    const startLineLimit = Math.min(lastVisibleLine, firstVisibleLine + config.maxStartLines);
    const linesAvailable = Math.max(1, startLineLimit - firstVisibleLine + 1);
    const pieces: CelebrationPiece[] = [];

    for (let index = 0; index < config.pieceCount; index += 1) {
      const line = clamp(
        firstVisibleLine + Math.floor(Math.random() * linesAvailable),
        0,
        editor.document.lineCount - 1,
      );
      const lineText = editor.document.lineAt(line).text;
      const maxCharacter = Math.min(lineText.length, 80);
      const character = Math.floor(Math.random() * (maxCharacter + 1));

      pieces.push({
        anchor: new vscode.Range(line, character, line, character),
        icon: icons[index % icons.length],
        baseXEm: randomBetween(-0.75, 0.75),
        baseYEm: randomBetween(-0.2, 0.6),
        driftXEm: randomBetween(-config.driftEm, config.driftEm),
        fallDistanceEm: randomBetween(config.fallDistanceEm * 0.65, config.fallDistanceEm),
        rotationDeg: randomBetween(0, 360),
        spinDeg: randomBetween(-config.spinTurns * 360, config.spinTurns * 360),
        scale: randomBetween(config.scaleMin, config.scaleMax),
      });
    }

    return pieces;
  }

  private buildIcons(colors: readonly string[]): vscode.Uri[] {
    return colors.flatMap((color) =>
      SHAPES.map((shape) => {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12">
  <g fill="${color}">${shape}</g>
</svg>`;

        return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      }),
    );
  }

  private getCelebrationConfig(kind: CelebrationKind, reducedMotion: boolean): CelebrationConfig {
    if (kind === 'level') {
      return reducedMotion
        ? {
            pieceCount: 14,
            durationMs: 500,
            maxStartLines: 3,
            fallDistanceEm: 6,
            driftEm: 1.2,
            spinTurns: 0.25,
            scaleMin: 0.75,
            scaleMax: 1,
          }
        : {
            pieceCount: 28,
            durationMs: 1100,
            maxStartLines: 5,
            fallDistanceEm: 12,
            driftEm: 2.8,
            spinTurns: 1.2,
            scaleMin: 0.85,
            scaleMax: 1.25,
          };
    }

    return reducedMotion
      ? {
          pieceCount: 10,
          durationMs: 420,
          maxStartLines: 2,
          fallDistanceEm: 4.5,
          driftEm: 0.9,
          spinTurns: 0.2,
          scaleMin: 0.7,
          scaleMax: 0.95,
        }
      : {
          pieceCount: 18,
          durationMs: 750,
          maxStartLines: 4,
          fallDistanceEm: 9,
          driftEm: 1.8,
          spinTurns: 0.8,
          scaleMin: 0.75,
          scaleMax: 1.1,
        };
  }

  private getSettings(): { enabled: boolean; reducedMotion: boolean } {
    const config = vscode.workspace.getConfiguration('levelUp');

    return {
      enabled: config.get<boolean>('effects.editorCelebrations', true),
      reducedMotion: config.get<boolean>('effects.reducedMotion', false),
    };
  }

  private stopAnimation(editor: vscode.TextEditor): void {
    const animation = this.activeAnimations.get(editor);
    if (animation?.timer) {
      clearTimeout(animation.timer);
    }

    editor.setDecorations(this.decorationType, []);
    this.activeAnimations.delete(editor);
  }

  private cleanupInvisibleEditors(visibleEditors: readonly vscode.TextEditor[]): void {
    const visibleSet = new Set(visibleEditors);

    for (const editor of this.activeAnimations.keys()) {
      if (!visibleSet.has(editor)) {
        this.stopAnimation(editor);
      }
    }
  }

  private clearActiveAnimations(): void {
    for (const editor of this.activeAnimations.keys()) {
      this.stopAnimation(editor);
    }
  }
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}