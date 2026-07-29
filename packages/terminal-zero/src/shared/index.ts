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
    type KeyLayer,
    type KeyHandler,
} from '@sigx/runtime-terminal';

// Cell measurement + background SGR for components that build their own
// escape strings (text buffers, pixel art).
export {
    charWidth,
    resolveBg,
} from '@sigx/runtime-terminal';

// Reactive terminal size — read it in a render function to re-render on
// resize (getOutputTarget().columns/rows are live but not reactive).
export {
    getTerminalSize,
    syncTerminalSize,
} from '@sigx/runtime-terminal';

export * from './colorMath';
export * from './ticker';
export * from './textBuffer';
export * from './viewStack';
export { generateQR } from './qr';

// The glyph vocabulary and interaction timings. In their own module so the pure
// drawing helpers below can import them without a cycle through this barrel.
export * from './glyphs';

// Data display: cell-aware text fitting, bar/gauge maths, sparklines, table
// layout with a scrolling viewport, and status grids. All pure — the themed
// components in @sigx/terminal-ui are thin wrappers over these.
export * from './cells';
export * from './bars';
export * from './sparkline';
export * from './tableLayout';
export * from './statusGrid';
