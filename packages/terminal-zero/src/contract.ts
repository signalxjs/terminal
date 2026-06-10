/**
 * The shared design-system contract for SignalX terminal UIs.
 *
 * `@sigx/terminal-zero` is the design-system-neutral foundation that skin
 * packages (`@sigx/terminal-ui`, …) build on. This module is the *vocabulary*
 * they agree on — the structural/semantic color tokens every theme authors, and
 * how each token degrades to a 16-color terminal — so switching skins or themes
 * is a token remap, not a component rewrite.
 *
 * Rules of the contract:
 * - Skins author themes against the `Theme` shape; they never redeclare the
 *   token names. Drift fails `pnpm typecheck`.
 * - Hex values are the single source of truth. The renderer
 *   (`@sigx/runtime-terminal`) turns a hex into a truecolor / 256 / 16-color SGR
 *   escape; this contract decides which *token* maps to which 16-color ANSI name
 *   when a hex can't be shown (`FALLBACK_ALIAS`).
 *
 * Token groups (from the SigX-tui design spec):
 * - structure: `bg panel chrome line fg dim faint shadow`
 * - accent:    `accent accentSoft accentText selSoft`
 * - status:    `success warn danger info`
 * - ANSI core: `black red green yellow blue magenta cyan white` (themed, with a
 *   guaranteed 16-color fallback since they ARE ANSI names)
 */
import type { Define } from '@sigx/runtime-core';

export type Mode = 'dark' | 'light';

/** Every token a component may reference. Keep this shape identical across themes. */
export interface Theme {
    name: string;
    mode: Mode;

    // structure
    bg: string;       // canvas / terminal background
    panel: string;    // raised surface
    chrome: string;   // title bars / footers
    line: string;     // idle borders, rules
    fg: string;       // default text
    dim: string;      // muted text
    faint: string;    // faintest text / progress track
    shadow: string;   // drop-shadow tone (▒)

    // accent (focus + selection)
    accent: string;
    accentSoft: string;   // subtle focus tint behind content
    accentText: string;   // text on a solid accent fill
    selSoft: string;      // selected-row tint (Select / Radio)

    // status
    success: string;
    warn: string;
    danger: string;
    info: string;

    // ANSI core (themed); each also has a guaranteed 16-color SGR fallback
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
}

/** A token name (anything in `Theme` except its metadata). */
export type ColorToken = keyof Omit<Theme, 'name' | 'mode'>;

/** A color value: a semantic token (autocompleted) OR a raw `#rrggbb` hex. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/ban-types
export type ColorValue = ColorToken | (string & {});

/** The 8 ANSI core token names — they degrade to themselves in 16-color mode. */
export const ANSI_NAMES: ReadonlySet<string> = new Set([
    'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
]);

/**
 * Which 16-color ANSI name each non-ANSI token degrades to when the terminal
 * can't render truecolor/256. (Design knowledge — lives here, not in the
 * renderer; the renderer only knows hex→SGR device math.)
 */
export const FALLBACK_ALIAS: Record<string, string> = {
    accent: 'cyan', accentSoft: 'black', accentText: 'black', selSoft: 'black',
    success: 'green', warn: 'yellow', danger: 'red', info: 'cyan',
    fg: 'white', dim: 'white', faint: 'white', line: 'white',
    shadow: 'black', bg: 'black', panel: 'black', chrome: 'black',
};

// ---------------------------------------------------------------------------
// Common prop fragments — skin component props intersect these instead of
// redeclaring the conventions. (`variant` is intentionally NOT here — fill style
// is skin chrome and differs per design system.)
// ---------------------------------------------------------------------------

/** Semantic/structural color of the component (`accent`, `danger`, `fg`, …). */
export type WithColor = Define.Prop<'color', ColorValue, false>;

/** Disabled: non-interactive + skin disabled styling. */
export type WithDisabled = Define.Prop<'disabled', boolean, false>;

/** Fieldset-style legend rendered into the top border. */
export type WithLabel = Define.Prop<'label', string, false>;

/** Auto-focus this control on mount. */
export type WithAutofocus = Define.Prop<'autofocus', boolean, false>;
