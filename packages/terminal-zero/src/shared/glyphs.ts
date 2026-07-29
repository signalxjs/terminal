/**
 * The glyph vocabulary the SigX-tui spec standardizes on, plus the interaction
 * timings every keyboard-driven component shares.
 *
 * Lives in its own module rather than in `shared/index.ts` so the pure drawing
 * helpers next door (`bars`, `sparkline`, `statusGrid`) can import it without
 * going through the barrel — which would make them circular with it.
 */

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
    // vertical fill ramp, shortest → tallest (sparkline / column chart levels).
    // NOT `barEighths`, which grows horizontally.
    blocksVertical: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as readonly string[],
    // data markers
    gap: '·',          // "no reading" — deliberately not a baseline value
    up: '▲',
    down: '▼',
    diamond: '◆',
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
