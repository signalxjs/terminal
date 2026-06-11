/**
 * Shared, design-system-neutral utilities for terminal components: the glyph
 * set the SigX-tui spec standardizes on, interaction timings, and re-exports of
 * the renderer's focus + key APIs so skins depend only on `@sigx/terminal-zero`.
 */

// Focus registry + keyboard input (re-exported from the renderer so skin
// components have a single foundation import).
export {
    focusState,
    registerFocusable,
    unregisterFocusable,
    focus,
    focusNext,
    focusPrev,
    onKey,
    setScreenBackground,
    setScreenForeground,
} from '@sigx/runtime-terminal';

// Renderer device APIs the FX / log components build on: depth-aware SGR for
// embedded gradient escapes, static output, and escape-safe measurement.
export {
    hexToSGR,
    resolveFg,
    getColorDepth,
    getOutputTarget,
    writeStatic,
    printStatic,
    displayWidth,
    truncateToWidth,
} from '@sigx/runtime-terminal';

// One-shot mount + key injection — what the imperative prompts layer builds
// on. Re-exported here so skins keep their single foundation import.
export {
    renderTerminal,
    dispatchKey,
    type RenderTerminalOptions,
} from '@sigx/runtime-terminal';

export * from './colorMath';
export * from './ticker';

/**
 * Standard glyphs. All are width-1 in monospace fonts (Braille, geometric,
 * box-drawing) — except the status icons, which some terminals render as 2
 * cells; prefer them only where a trailing column is acceptable.
 */
export const GLYPHS = {
    checkboxOn: '◉',
    checkboxOff: '◯',
    radioOn: '●',
    radioOff: '○',
    cursor: '❯',       // Select / menu pointer
    focusBar: '▌',     // focused-control accent bar
    shadowCell: '▒',   // drop shadow
    barFull: '█',      // progress filled
    barEmpty: '░',     // progress track
    // sub-cell progress edge, thinnest → widest (smooth bar leading edge)
    barEighths: ['▏', '▎', '▍', '▌', '▋', '▊', '▉'] as readonly string[],
    // status icons (may be 2 cells in some terminals)
    check: '✔',
    cross: '✖',
    warn: '⚠',
    info: 'ℹ',
    // spinner animation frames (Braille — always width 1)
    spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as readonly string[],
} as const;

/**
 * Spinner frame sets, selectable via the Spinner `variant` prop. All width-1
 * except `moon` (emoji — 2 cells; use where a wider glyph column is fine).
 */
export const SPINNERS = {
    dots: GLYPHS.spinner,
    line: ['—', '\\', '|', '/'],
    arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
    circle: ['◐', '◓', '◑', '◒'],
    bounce: ['▁', '▃', '▄', '▅', '▆', '▇', '▆', '▅', '▄', '▃'],
    moon: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
} as const satisfies Record<string, readonly string[]>;

export type SpinnerVariant = keyof typeof SPINNERS;

/** Milliseconds a button stays in its visual "pressed" state after activation. */
export const PRESS_MS = 120;

/** Milliseconds to ignore input after mount (debounces the activating Enter). */
export const READY_DELAY_MS = 50;
