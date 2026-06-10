/**
 * The theme engine — the semantic half of the token pipeline.
 *
 * Owns the theme registry, the active-theme signal, and `resolveColor()`, which
 * turns a token into a concrete color string the renderer can paint:
 *   - truecolor / 256-color terminals → the theme's hex (renderer quantizes 256)
 *   - 16-color terminals → the `FALLBACK_ALIAS` ANSI name
 * It reads the renderer's detected color depth (`getColorDepth`) but never emits
 * SGR itself — that's the renderer's device half. Reads of the active-theme and
 * color-depth signals are reactive, so `setTheme()` / `setColorDepth()` repaint
 * any component that resolved a token during render.
 */
import { signal, effect, type EffectRunner } from '@sigx/reactivity';
import { getColorDepth, setScreenBackground, setScreenForeground } from '@sigx/runtime-terminal';
import { ANSI_NAMES, FALLBACK_ALIAS, type Theme } from '../contract';

const themes: Record<string, Theme> = {};

// Reactive active-theme id. Empty until the first theme registers.
const themeState = signal({ active: '' });

/**
 * A minimal neutral theme so the foundation is usable standalone, before any
 * design-system skin registers its palettes. Skins (e.g. @sigx/terminal-ui)
 * register richer themes and switch the default.
 */
const neutral: Theme = {
    name: 'Neutral', mode: 'dark',
    bg: '#000000', panel: '#0a0a0a', chrome: '#000000', line: '#3a3a3a',
    fg: '#d0d0d0', dim: '#808080', faint: '#4a4a4a', shadow: '#000000',
    accent: '#5fafff', accentSoft: '#1c2733', accentText: '#000000', selSoft: '#1a1f26',
    success: '#5faf5f', warn: '#d7af5f', danger: '#d75f5f', info: '#5fafd7',
    black: '#000000', red: '#d75f5f', green: '#5faf5f', yellow: '#d7af5f',
    blue: '#5fafff', magenta: '#af5fd7', cyan: '#5fd7d7', white: '#d0d0d0',
};

/** Register (or replace) a theme. The first registered theme becomes active. */
export function registerTheme(id: string, theme: Theme): void {
    themes[id] = theme;
    if (!themeState.active) themeState.active = id;
}

registerTheme('neutral', neutral);

/** Switch the active theme. Throws on an unknown id. */
export function setTheme(id: string): void {
    if (!themes[id]) throw new Error(`Unknown theme: ${id}`);
    themeState.active = id;
}

/** The active theme id (reactive). */
export function getTheme(): string {
    return themeState.active;
}

/** The active theme object (reactive). */
export function getActiveTheme(): Theme {
    return themes[themeState.active] ?? neutral;
}

/** Whether a theme id is registered. */
export function hasTheme(id: string): boolean {
    return !!themes[id];
}

/** All registered theme ids. */
export function listThemes(): string[] {
    return Object.keys(themes);
}

/**
 * Resolve a token (or raw `#hex`) to a concrete color string for the renderer.
 * Reactive: re-reads the active theme + color depth on every call.
 */
export function resolveColor(token: string | undefined): string {
    if (!token) return '';
    if (token[0] === '#') return token;            // raw hex passes through
    const theme = getActiveTheme();                 // tracks active-theme signal
    const depth = getColorDepth();                  // tracks color-depth signal

    if (depth === 'ansi16') {
        // Degrade to a 16-color ANSI name the renderer paints by name.
        if (ANSI_NAMES.has(token)) return token;
        return FALLBACK_ALIAS[token] ?? 'white';
    }

    // truecolor / 256 / none: hand the renderer the theme hex (it quantizes/skips).
    const hex = (theme as unknown as Record<string, string>)[token];
    return hex ?? token;
}

// ---------------------------------------------------------------------------
// Theme canvas — auto-paint the renderer's screen background + default
// foreground from the active theme (the "app-level" canvas, à la Textual). The
// renderer owns the device fill; this is the reactive binding that drives it.
// ---------------------------------------------------------------------------

let canvasEffect: EffectRunner | null = null;

/**
 * Bind the renderer's screen canvas (background + default foreground) to the
 * active theme. Reactive: it re-applies whenever the theme or color depth
 * changes. Idempotent — calling it again returns the same stop function.
 *
 * Design-system packages call this on import so apps get a legible themed canvas
 * automatically (especially light themes on a dark terminal). Returns a function
 * that stops the binding (see also `disableThemeCanvas`).
 */
export function applyThemeCanvas(): () => void {
    if (!canvasEffect) {
        canvasEffect = effect(() => {
            setScreenBackground(resolveColor('bg'));
            setScreenForeground(resolveColor('fg'));
        });
    }
    return disableThemeCanvas;
}

/**
 * Stop the theme→canvas binding and clear the canvas, so the terminal's own
 * background shows through (for transparent / inline apps that don't want a
 * themed canvas).
 */
export function disableThemeCanvas(): void {
    if (canvasEffect) {
        canvasEffect.stop?.();
        canvasEffect = null;
    }
    setScreenBackground(undefined);
    setScreenForeground(undefined);
}
