import { createRenderer, RendererOptions, setDefaultMount } from '@sigx/runtime-core/internals';
import { focusNext, focusPrev } from './focus';
import { displayWidth, truncateToWidth } from './utils';
import { resolveFg, resolveBg } from './color';
import { getOutputTarget } from './output';
import { patchConsoleTo, restoreConsole, registerCleanup, unregisterCleanup } from './lifecycle';

// Import type augmentation
import './types.js';

export * from './focus';
export * from './utils';
export * from './color';
export * from './output';

// --- Terminal Node Types ---

export interface TerminalNode {
    type: 'root' | 'element' | 'text' | 'comment';
    tag?: string;
    text?: string;
    props: Record<string, any>;
    children: TerminalNode[];
    parentNode?: TerminalNode | null;
}

// --- Node Operations ---

const nodeOps: RendererOptions<TerminalNode, TerminalNode> = {
    patchProp: (el, key, prev, next) => {
        el.props[key] = next;
        scheduleRender();
    },
    insert: (child, parent, anchor) => {
        child.parentNode = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        if (index > -1) {
            parent.children.splice(index, 0, child);
        } else {
            parent.children.push(child);
        }
        scheduleRender();
    },
    remove: (child) => {
        if (child.parentNode) {
            const index = child.parentNode.children.indexOf(child);
            if (index > -1) {
                child.parentNode.children.splice(index, 1);
            }
            child.parentNode = null;
        }
        scheduleRender();
    },
    createElement: (tag) => {
        return { type: 'element', tag, props: {}, children: [] };
    },
    createText: (text) => {
        return { type: 'text', text, props: {}, children: [] };
    },
    createComment: (text) => {
        return { type: 'comment', text, props: {}, children: [] };
    },
    setText: (node, text) => {
        node.text = text;
        scheduleRender();
    },
    setElementText: (node, text) => {
        node.children = [{ type: 'text', text, props: {}, children: [], parentNode: node }];
        scheduleRender();
    },
    parentNode: (node) => node.parentNode || null,
    nextSibling: (node) => {
        if (!node.parentNode) return null;
        const idx = node.parentNode.children.indexOf(node);
        return node.parentNode.children[idx + 1] || null;
    },
    cloneNode: (node) => {
        // Shallow clone for simplicity in this demo
        return { ...node, children: [] };
    }
};

// --- Renderer Creation ---

const renderer = createRenderer(nodeOps);
export const { render } = renderer;

// --- Terminal Rendering Logic ---

let rootNode: TerminalNode | null = null;
let renderTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRender() {
    // Batch all DOM mutations into a single render frame.
    // The first call sets a timer; subsequent calls within the window are no-ops.
    if (tornDown || renderTimer) return;
    renderTimer = setTimeout(() => {
        renderTimer = null;
        flushRender();
    }, 16);
}

// Optional themed screen canvas. When a background (and/or default foreground)
// is set, every rendered line — and the empty area below — is filled with it so
// themes, especially light ones, render on their own canvas instead of the
// terminal's. Unstyled text inherits the default foreground.
let screenBgColor: string | undefined;
let screenFgColor: string | undefined;

/**
 * Set (or clear) the full-screen background color. Pass a hex / ANSI name (or a
 * token already resolved by the theme layer); pass undefined to use the
 * terminal's own background. Light themes need this to be legible on a dark
 * terminal.
 */
export function setScreenBackground(color?: string): void {
    const next = color || undefined;
    if (next === screenBgColor) return;
    screenBgColor = next;
    scheduleRender(); // repaint without needing a component re-render
}

/**
 * Set (or clear) the default foreground color for the screen — unstyled text
 * inherits it. Usually the theme's `fg`. Pass undefined for the terminal default.
 */
export function setScreenForeground(color?: string): void {
    const next = color || undefined;
    if (next === screenFgColor) return;
    screenFgColor = next;
    scheduleRender();
}

/**
 * How the app paints:
 * - 'inline' (default): a live region at the cursor's position in the normal
 *   screen buffer. Each frame repaints only its own lines (cursor-up + erase),
 *   so the user's scrollback above is never touched and the final frame
 *   persists after unmount. Frames taller than the viewport are clamped to
 *   their bottom rows; lines are truncated to the terminal width so soft
 *   wrapping can't break the cursor arithmetic.
 * - 'fullscreen': the app owns the whole screen. Mount enters the alternate
 *   screen buffer; unmount restores the user's prior terminal contents. The
 *   themed canvas also fills the empty viewport below the content.
 */
export type RenderMode = 'inline' | 'fullscreen';

let mode: RenderMode = 'inline';
// stdout is not a TTY (piped, CI): no live region, no escape codes — the final
// frame is emitted once, as plain text, at teardown.
let nonTTY = false;
// Themed canvas gate: in inline mode the full-width background padding would
// look broken as persisted scrollback, so it's off unless opted in.
let canvasEnabled = false;
// Height of the live region currently painted (inline mode).
let prevFrameHeight = 0;
// Set during teardown so the unmount tree mutations can't schedule a repaint
// that would erase the persisted final frame.
let tornDown = false;
let mounted = false;
let lastFrameLines: string[] = [];
// Static lines emitted while in the alt screen; flushed to the normal buffer
// after leaving it.
let pendingStatic: string[] = [];

function flushRender() {
    if (!rootNode || tornDown) return;

    let lines = renderNodeToLines(rootNode);

    if (nonTTY) {
        // Plain text, no canvas backing — written once at teardown.
        lastFrameLines = lines;
        return;
    }

    const target = getOutputTarget();
    const cols = target.columns;
    const bg = canvasEnabled && screenBgColor ? resolveBg(screenBgColor) : '';
    const fg = canvasEnabled && screenFgColor ? resolveFg(screenFgColor) : '';
    const base = bg + fg;

    if (base) {
        // Back each rendered line with the themed canvas: pad to the terminal
        // width, re-asserting the base colors after any inner reset.
        const reset = '\x1b[0m';
        lines = lines.map((line) => {
            const padN = Math.max(0, cols - displayWidth(line));
            const body = line.split(reset).join(reset + base);
            return base + body + base + ' '.repeat(padN) + reset;
        });
    }

    if (mode === 'fullscreen') {
        let out = '\x1B[H';
        if (base) {
            out += lines.join('\n');
            // App owns the screen: fill the empty rows below with the theme bg.
            const rows = target.rows;
            for (let i = lines.length; i < rows; i++) {
                out += '\n' + bg + ' '.repeat(cols) + '\x1b[0m';
            }
        } else {
            out += lines.join('\x1B[K\n') + '\x1B[K';
        }
        target.write(out + '\x1B[J');
        return;
    }

    // Inline: repaint only the live region. Truncate to the terminal width
    // (a soft-wrapped line would desync the cursor-up math) and clamp tall
    // frames to their bottom rows (the active part of a live CLI UI).
    lines = lines.map((l) => truncateToWidth(l, cols));
    const rows = target.rows;
    if (lines.length > rows) lines = lines.slice(-rows);

    let out = '';
    if (prevFrameHeight > 0) {
        out += '\r' + (prevFrameHeight > 1 ? `\x1B[${prevFrameHeight - 1}A` : '');
    }
    // No trailing newline: the cursor rests at the end of the last line, so the
    // next repaint's cursor-up count is exact and [J below never reaches
    // scrollback.
    out += lines.map((l) => l + '\x1B[K').join('\n');
    target.write(out + '\x1B[J');
    prevFrameHeight = lines.length;
}

/**
 * Print permanent output above the live region — the CLI-command side of the
 * framework. In inline mode the live region is erased, the text scrolls into
 * history, and the region repaints below it (one synchronous burst, so the
 * 16ms render batching can't interleave). In fullscreen mode lines are queued
 * and emitted to the normal buffer when the alt screen is left. Outside a
 * mount (or non-TTY) it writes straight through.
 */
export function writeStatic(text: string): void {
    const target = getOutputTarget();
    if (!mounted || nonTTY) {
        target.write(text.endsWith('\n') ? text : text + '\n');
        return;
    }

    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();

    if (mode === 'fullscreen') {
        pendingStatic.push(...lines);
        return;
    }

    if (renderTimer) {
        clearTimeout(renderTimer);
        renderTimer = null;
    }
    let out = '';
    if (prevFrameHeight > 0) {
        out += '\r' + (prevFrameHeight > 1 ? `\x1B[${prevFrameHeight - 1}A` : '');
    }
    out += '\x1B[J'; // erase the live region
    out += lines.map((l) => l + '\x1B[K\n').join('');
    target.write(out);
    prevFrameHeight = 0;
    flushRender(); // repaint the live region below the new static lines
}

/** Alias for {@link writeStatic}. */
export const printStatic = writeStatic;


/**
 * Check if a node has a box element as an immediate child.
 * This is used to determine if a component wrapper should be treated as a block element.
 */
function hasBoxChild(node: TerminalNode): boolean {
    for (const child of node.children) {
        if (child.tag === 'box') {
            return true;
        }
    }
    return false;
}

export function renderNodeToLines(node: TerminalNode): string[] {
    // if (node.tag === 'box') console.log('Rendering box', node.props);
    if (node.type === 'text') {
        return [node.text || ''];
    }
    if (node.type === 'comment') {
        return [];
    }

    let lines: string[] = [''];

    // Inline styling from props. A box's own backgroundColor is painted by
    // drawBox (with its border); for inline elements like <text> we apply it
    // here so background tints (block cursor, badges, key hints) render.
    const colorCode = resolveFg(node.props.color);
    const bgCode = node.tag === 'box' ? '' : resolveBg(node.props.backgroundColor);
    const prefix = bgCode + colorCode;
    const reset = (colorCode || bgCode) ? '\x1b[0m' : '';

    // Render children
    for (const child of node.children) {
        if (child.type === 'text') {
            // Append text to the last line
            lines[lines.length - 1] += prefix + (child.text || '') + reset;
        } else if (child.tag === 'br') {
            // Start a new line
            lines.push('');
        } else {
            // Recursively render child
            const childLines = renderNodeToLines(child);

            // Check if this child contains a box element (making it a block)
            // A box is always a block element, and component wrappers that contain
            // a box should also be treated as blocks
            const isBlockElement = child.tag === 'box' || hasBoxChild(child);

            if (isBlockElement) {
                // Block element - start on a new line
                if (lines.length === 1 && lines[0] === '') {
                    lines = childLines;
                } else {
                    lines.push(...childLines);
                }
            } else {
                // Inline element (like text wrapper)
                // This is tricky. If child returns multiple lines, it breaks the flow.
                // For now, assume non-box elements are inline-ish or just append.
                if (childLines.length > 0) {
                    // If the child has multiple lines, treat it as a block to avoid
                    // appending a box top border to the end of a text line.
                    if (childLines.length > 1) {
                        if (lines.length === 1 && lines[0] === '') {
                            lines = childLines;
                        } else {
                            lines.push(...childLines);
                        }
                    } else {
                        lines[lines.length - 1] += childLines[0];
                        for (let i = 1; i < childLines.length; i++) {
                            lines.push(childLines[i]);
                        }
                    }
                }
            }
        }
    }

    // Apply box borders if needed
    if (node.tag === 'box' && node.props.border && node.props.border !== 'none') {
        return drawBox(lines, {
            style: node.props.border,
            color: node.props.borderColor,
            backgroundColor: node.props.backgroundColor,
            dropShadow: node.props.dropShadow,
            shadowColor: node.props.shadowColor,
            label: node.props.label,
            labelColor: node.props.labelColor,
            padX: node.props.padX,
        });
    }

    return lines;
}

interface DrawBoxOptions {
    style: string;
    color?: string;
    backgroundColor?: string;
    dropShadow?: boolean;
    shadowColor?: string;
    label?: string;
    labelColor?: string;
    padX?: number;
}

function drawBox(contentLines: string[], opts: DrawBoxOptions): string[] {
    const { style, color, backgroundColor, dropShadow, shadowColor, label } = opts;
    const padX = Math.max(0, opts.padX ?? 0);
    const borderChars = getBorderChars(style);
    const colorCode = resolveFg(color);
    // Label gets its own color so a legend stays readable even when the border
    // is the dim idle `line` color. Falls back to the border color.
    const labelCode = opts.labelColor ? resolveFg(opts.labelColor) : colorCode;
    const bgCode = resolveBg(backgroundColor);
    const reset = (colorCode || bgCode) ? '\x1b[0m' : '';
    const pad = ' '.repeat(padX);

    // Horizontal padding widens every content line symmetrically inside the border.
    const lines = padX > 0 ? contentLines.map((l) => pad + l + pad) : contentLines;

    // Calculate width using display cells (NOT .length — wide glyphs are 2 cells)
    const width = lines.reduce((max, line) => Math.max(max, displayWidth(line)), 0);

    // If there's a label, ensure box is wide enough to accommodate it
    const labelText = label || '';
    const labelLength = displayWidth(labelText);
    const boxInnerWidth = Math.max(width, labelLength + 2);

    // Build top border. If label exists, center it in the top border like a
    // fieldset legend, coloring just the label text with labelCode (the
    // surrounding border keeps colorCode; bg persists, so no mid-line reset).
    let top: string;
    if (labelText) {
        const spaceForLabel = boxInnerWidth - labelLength - 2; // remaining space for horiz lines
        const leftH = Math.floor(spaceForLabel / 2);
        const rightH = spaceForLabel - leftH;
        top = bgCode + colorCode + borderChars.tl + borderChars.h.repeat(leftH)
            + ' ' + labelCode + labelText + colorCode + ' '
            + borderChars.h.repeat(rightH) + borderChars.tr + reset;
    } else {
        top = bgCode + colorCode + borderChars.tl + borderChars.h.repeat(boxInnerWidth) + borderChars.tr + reset;
    }
    const bottom = bgCode + colorCode + borderChars.bl + borderChars.h.repeat(boxInnerWidth) + borderChars.br + reset;

    const result: string[] = [];
    result.push(top);

    for (const line of lines) {
        const visibleLength = displayWidth(line);
        const padding = ' '.repeat(Math.max(0, boxInnerWidth - visibleLength));
        // We need to apply background to the content line as well, but be careful not to double apply if it already has it?
        // Actually, the content might have its own colors.
        // But the padding needs the background color.
        // And the border needs the background color.

        // If we wrap the whole line in bgCode, it should work, provided we reset at the end.
        // But `line` might have resets in it.
        // A simple approach: apply bgCode to the border chars and the padding.
        // For the content, if it doesn't have bg, we might want to apply it.
        // But `line` is already a string with ANSI codes.

        // Let's try wrapping the whole thing.
        // Note: `line` comes from `renderNodeToLines`, which might have resets.
        // If `line` has `\x1b[0m`, it will reset the background too.
        // So we might need to replace `\x1b[0m` with `\x1b[0m` + bgCode + colorCode?
        // That's getting complicated.

        // For now, let's just apply bg to borders and padding.
        // And maybe prepend bgCode to the line?

        // If we just prepend bgCode to `line`, and `line` has a reset, the rest of the line will lose the bg.
        // So we should replace resets in `line` with `reset + bgCode + colorCode` (if we want to maintain the box style).
        // But `colorCode` is for the border. The content might have its own text color.

        // Let's assume content handles its own text color, but we want to enforce background.
        // We can replace `\x1b[0m` with `\x1b[0m${bgCode}`.

        const lineWithBg = bgCode + line.split('\x1b[0m').join(`\x1b[0m${bgCode}`);

        result.push(bgCode + colorCode + borderChars.v + reset + lineWithBg + bgCode + padding + colorCode + borderChars.v + reset);
    }

    result.push(bottom);

    if (dropShadow) {
        const shadowCode = resolveFg(shadowColor) || '\x1b[90m'; // themed, default bright black
        const resetShadow = '\x1b[0m';
        const shadowChar = '▒';
        const shadowBlock = shadowCode + shadowChar + resetShadow;

        // Apply to lines 1 to end (skipping top line 0)
        for (let i = 1; i < result.length; i++) {
            result[i] += shadowBlock;
        }

        // Add bottom shadow line
        // Width is boxWidth (width + 2)
        const bottomShadow = ' ' + shadowBlock.repeat(width + 2);
        result.push(bottomShadow);
    }

    return result;
}

function getBorderChars(style: string) {
    if (style === 'double') {
        return { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' };
    }
    if (style === 'rounded') {
        return { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' };
    }
    if (style === 'thick' || style === 'bold') {
        return { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' };
    }
    // Default single
    return { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
}

// --- Public API for mounting ---

type KeyHandler = (key: string) => void;
const keyHandlers = new Set<KeyHandler>();

export function onKey(handler: KeyHandler) {
    keyHandlers.add(handler);
    return () => keyHandlers.delete(handler);
}

function handleInput(key: string) {
    // Ctrl+C — raw mode swallows SIGINT, so it arrives here as \u0003. Full
    // teardown (persist the inline frame / leave the alt screen / restore raw
    // mode and cursor), then exit with the conventional SIGINT code.
    if (key === '\u0003') {
        exitTerminal();
        process.exit(130);
    }

    // Tab navigation
    if (key === '\t') {
        focusNext();
        return;
    }
    // Shift+Tab (often \x1b[Z)
    if (key === '\x1b[Z') {
        focusPrev();
        return;
    }

    for (const handler of keyHandlers) {
        handler(key);
    }
}

export interface RenderTerminalOptions {
    /** How the app paints; see {@link RenderMode}. Default 'inline'. */
    mode?: RenderMode;
    /** Legacy alias for `mode: 'fullscreen'`. */
    fullscreen?: boolean;
    /**
     * Clear the screen on mount. Only meaningful in fullscreen mode (the alt
     * screen already starts blank on most emulators); inline mode never clears.
     */
    clearConsole?: boolean;
    /**
     * Route console.log/info/warn/error/debug through {@link writeStatic} while
     * mounted, so stray logs become permanent output above the live region
     * instead of corrupting it. Default: on for inline TTY mounts.
     */
    patchConsole?: boolean;
    /**
     * Themed screen canvas (theme bg/fg backing every line). Default: on in
     * fullscreen, off in inline — full-width background padding looks broken
     * once the final frame persists into scrollback.
     */
    canvas?: boolean;
}

let stdinActive = false;
let consoleRestore: (() => void) | null = null;
// Guards the escape-code restore so a signal/exit hook firing after a clean
// teardown (or vice versa) writes it exactly once.
let restored = false;

/**
 * Restore the terminal to a sane state. Synchronous and idempotent: this is
 * the path shared by clean unmount, Ctrl+C, SIGINT/SIGTERM, uncaughtException
 * and process 'exit', so it must never schedule work.
 */
function restoreTerminalState(): void {
    if (restored) return;
    restored = true;
    const target = getOutputTarget();
    if (stdinActive) {
        try {
            process.stdin.setRawMode(false);
        } catch { /* mirror of the setup guard */ }
    }
    if (nonTTY) {
        // The one and only paint: the final frame, as plain text.
        if (lastFrameLines.length) {
            target.write(lastFrameLines.join('\n') + '\n');
        }
    } else if (mode === 'fullscreen') {
        // Leave the alt screen (restores the user's prior contents), then emit
        // any static output queued while it was active.
        target.write('\x1b[0m\x1B[?25h\x1B[?1049l');
        if (pendingStatic.length) {
            target.write(pendingStatic.join('\n') + '\n');
            pendingStatic = [];
        }
    } else {
        // Inline: drop the cursor below the live region — the final frame
        // persists in scrollback.
        target.write('\n\x1b[0m\x1B[?25h');
    }
}

function setupTerminal(options: RenderTerminalOptions = {}): TerminalNode {
    rootNode = { type: 'root', props: {}, children: [] };
    mode = options.mode ?? (options.fullscreen ? 'fullscreen' : 'inline');
    const target = getOutputTarget();
    nonTTY = !target.isTTY;
    canvasEnabled = options.canvas ?? mode === 'fullscreen';
    prevFrameHeight = 0;
    tornDown = false;
    restored = false;
    mounted = true;
    lastFrameLines = [];
    pendingStatic = [];

    // Interactive stdin only. Unconditionally resuming a piped stdin would
    // keep the process alive (and feed pipe data to the key handler).
    stdinActive = false;
    if (process.stdin.isTTY) {
        try {
            process.stdin.setRawMode(true);
        } catch {
            // setRawMode may fail on some terminal emulators — continue without it
        }
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', handleInput);
        stdinActive = true;
    }

    if (!nonTTY) {
        if (mode === 'fullscreen') {
            // Alt screen: the user's screen and scrollback come back intact on
            // exit. Never \x1B[3J here — the alt buffer has no scrollback, and
            // it would wipe the user's real one on some emulators.
            target.write('\x1B[?1049h\x1B[H' + (options.clearConsole ? '\x1B[2J' : ''));
        }
        target.write('\x1B[?25l'); // hide cursor
        process.stdout.on('resize', handleResize);
    }

    if (options.patchConsole ?? (mode === 'inline' && !nonTTY)) {
        consoleRestore = patchConsoleTo(writeStatic);
    }
    registerCleanup(restoreTerminalState);
    return rootNode;
}

function teardownTerminal(container: TerminalNode): void {
    if (tornDown) return;
    // The persisted frame must reflect final state: flush any batched
    // mutations before anything is torn down.
    if (renderTimer) {
        clearTimeout(renderTimer);
        renderTimer = null;
        flushRender();
    }
    // From here on, renders are silenced — the unmount mutations below must
    // not repaint (they would erase the persisted frame).
    tornDown = true;
    mounted = false;
    render(null, container);

    restoreTerminalState();

    if (stdinActive) {
        process.stdin.pause();
        process.stdin.off('data', handleInput);
        stdinActive = false;
    }
    if (!nonTTY) {
        process.stdout.off('resize', handleResize);
    }
    if (consoleRestore) {
        consoleRestore();
        consoleRestore = null;
    }
    unregisterCleanup();
}

function handleResize(): void {
    if (tornDown) return;
    if (mode === 'fullscreen') {
        // Safe in the alt buffer (no scrollback). Inline just repaints: the
        // next flush re-truncates/re-clamps to the new size. (Known artifact,
        // same as Ink: shrinking the width rewraps already-painted lines
        // before our repaint, which can leave a stale fragment.)
        getOutputTarget().write('\x1B[2J\x1B[H');
    }
    scheduleRender();
}

export function renderTerminal(app: any, options: RenderTerminalOptions = {}) {
    const container = setupTerminal(options);

    render(app, container);

    // DOM operations during render() will scheduleRender().
    // Let the timer batch the initial render with any onMounted effects.

    return {
        unmount: () => teardownTerminal(container),
    };
}

let unmountFn: (() => void) | null = null;

/**
 * Helper function to mount the terminal for CLI apps.
 * Returns a mount target that can be passed to defineApp().mount().
 * 
 * @example
 * ```tsx
 * defineApp(MyApp).mount(mountTerminal());
 * ```
 */
export function mountTerminal(options: RenderTerminalOptions = { clearConsole: true }) {
    return {
        mount: terminalMount,
        options,
        onMount: (unmount: () => void) => {
            unmountFn = unmount;
        }
    };
}

/**
 * Exit the terminal app cleanly, restoring terminal state. In inline mode the
 * final frame persists in scrollback; in fullscreen mode the alt screen is
 * left and the user's prior terminal contents come back.
 */
export function exitTerminal() {
    if (unmountFn) {
        unmountFn();
        unmountFn = null;
    } else if (rootNode && !tornDown) {
        teardownTerminal(rootNode);
    }
    // Drop any themed canvas so the next mount starts from the terminal's own colors.
    screenBgColor = undefined;
    screenFgColor = undefined;
}

/**
 * Route console methods through {@link writeStatic} (inline TTY mounts do
 * this automatically; see RenderTerminalOptions.patchConsole). Returns a
 * restore function.
 */
export function patchConsole(): () => void {
    return patchConsoleTo(writeStatic);
}
export { restoreConsole };

/**
 * Mount function for Terminal environments.
 * Use this with defineApp().mount() to render to the terminal.
 * 
 * @example
 * ```tsx
 * import { defineApp } from '@sigx/runtime-core';
 * import { terminalMount } from '@sigx/runtime-terminal';
 * 
 * const app = defineApp(<Counter />);
 * app.use(loggingPlugin)
 *    .mount({ clearConsole: true }, terminalMount);
 * ```
 */
export const terminalMount = (component: any, options: RenderTerminalOptions, appContext?: any): (() => void) => {
    const container = setupTerminal(options);

    // Render with app context support
    render(component, container, appContext);

    // DOM operations during render() will scheduleRender().
    // Let the timer batch the initial render with any onMounted effects.

    return () => teardownTerminal(container);
};

// Set terminalMount as the default mount function for this platform
setDefaultMount(terminalMount);

declare global {
    namespace JSX {
        interface IntrinsicElements {
            box: TerminalAttributes;
            text: TerminalAttributes;
            br: TerminalAttributes;
        }

        interface TerminalAttributes {
            color?: 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'white' | 'black' | string;
            backgroundColor?: 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'white' | 'black' | string;
            border?: 'single' | 'double' | 'rounded' | 'thick' | 'none';
            borderColor?: 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'white' | 'black' | string;
            dropShadow?: boolean;
            shadowColor?: string;
            padX?: number;
            label?: string;
            labelColor?: string;
            children?: any;
        }

    }
}

