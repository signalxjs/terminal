import { createRenderer, RendererOptions, setDefaultMount } from '@sigx/runtime-core/internals';
import { VNode } from '@sigx/runtime-core';
import { focusNext, focusPrev } from './focus';
import { getColorCode, getBackgroundColorCode, stripAnsi } from './utils';

// Import type augmentation
import './types.js';

export * from './focus';
export * from './components/Input';
export * from './components/ProgressBar';
export * from './components/Button';
export * from './components/Checkbox';
export * from './components/Select';

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
    if (renderTimer) return;
    renderTimer = setTimeout(() => {
        renderTimer = null;
        flushRender();
    }, 16);
}

function flushRender() {
    if (!rootNode) return;

    // Move cursor to top-left
    process.stdout.write('\x1B[H');

    // Render tree
    const lines = renderNodeToLines(rootNode);
    process.stdout.write(lines.join('\x1B[K\n') + '\x1B[K');

    // Clear rest of screen
    process.stdout.write('\x1B[J');
}


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

    // Simple styling based on props (e.g., color)
    const color = node.props.color;
    const reset = color ? '\x1b[0m' : '';
    const colorCode = getColorCode(color);

    // Render children
    for (const child of node.children) {
        if (child.type === 'text') {
            // Append text to the last line
            lines[lines.length - 1] += colorCode + (child.text || '') + reset;
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
    if (node.tag === 'box' && node.props.border) {
        return drawBox(lines, node.props.border, node.props.borderColor, node.props.backgroundColor, node.props.dropShadow, node.props.label);
    }

    return lines;
}

function drawBox(contentLines: string[], style: string, color?: string, backgroundColor?: string, dropShadow?: boolean, label?: string): string[] {
    const borderChars = getBorderChars(style);
    const colorCode = color ? getColorCode(color) : '';
    const bgCode = backgroundColor ? getBackgroundColorCode(backgroundColor) : '';
    const reset = (color || backgroundColor) ? '\x1b[0m' : '';

    // Calculate width
    const width = contentLines.reduce((max, line) => Math.max(max, stripAnsi(line).length), 0);

    // If there's a label, ensure box is wide enough to accommodate it
    const labelText = label || '';
    const labelLength = stripAnsi(labelText).length;
    const boxInnerWidth = Math.max(width, labelLength + 2);

    // Build top border. If label exists, center it in the top border like a fieldset legend
    let topInner = '';
    if (labelText) {
        const spaceForLabel = boxInnerWidth - labelLength - 2; // remaining space for horiz lines
        const leftH = Math.floor(spaceForLabel / 2);
        const rightH = spaceForLabel - leftH;
        topInner = borderChars.h.repeat(leftH) + ' ' + labelText + ' ' + borderChars.h.repeat(rightH);
    } else {
        topInner = borderChars.h.repeat(boxInnerWidth);
    }

    const top = bgCode + colorCode + borderChars.tl + topInner + borderChars.tr + reset;
    const bottom = bgCode + colorCode + borderChars.bl + borderChars.h.repeat(boxInnerWidth) + borderChars.br + reset;

    const result: string[] = [];
    result.push(top);

    for (const line of contentLines) {
        const visibleLength = stripAnsi(line).length;
        const padding = ' '.repeat(boxInnerWidth - visibleLength);
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

        const lineWithBg = bgCode + line.replace(/\x1b\[0m/g, `\x1b[0m${bgCode}`);

        result.push(bgCode + colorCode + borderChars.v + reset + lineWithBg + bgCode + padding + colorCode + borderChars.v + reset);
    }

    result.push(bottom);

    if (dropShadow) {
        const shadowColor = '\x1b[90m'; // Bright black (gray)
        const resetShadow = '\x1b[0m';
        const shadowChar = '▒';
        const shadowBlock = shadowColor + shadowChar + resetShadow;

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
    // Default single
    return { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
}

function renderNodeToString(node: TerminalNode, depth = 0): string {
    // Deprecated, but kept for compatibility if needed, or just redirect
    return renderNodeToLines(node).join('\n');
}


// --- Public API for mounting ---

type KeyHandler = (key: string) => void;
const keyHandlers = new Set<KeyHandler>();

export function onKey(handler: KeyHandler) {
    keyHandlers.add(handler);
    return () => keyHandlers.delete(handler);
}

function handleInput(key: string) {
    // Ctrl+C to exit
    if (key === '\u0003') {
        process.stdout.write('\x1B[?25h'); // Show cursor
        process.exit();
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
    clearConsole?: boolean;
}

export function renderTerminal(app: any, options: RenderTerminalOptions = {}) {
    rootNode = { type: 'root', props: {}, children: [] };

    // Create a proxy container that looks like a HostElement
    const container = rootNode;

    // Setup input — handle terminals (like Warp) that may not report isTTY correctly
    try {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
    } catch {
        // setRawMode may fail on some terminal emulators — continue without it
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', handleInput);

    // Clear console if requested
    if (options.clearConsole) {
        process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
    }

    // Hide cursor
    process.stdout.write('\x1B[?25l');

    render(app, container);

    // DOM operations during render() will scheduleRender().
    // Let the timer batch the initial render with any onMounted effects.

    return {
        unmount: () => {
            render(null, container);
            // Show cursor
            process.stdout.write('\x1B[?25h');

            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
                process.stdin.pause();
                process.stdin.off('data', handleInput);
            }
        }
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
 * Exit the terminal app cleanly, restoring terminal state.
 */
export function exitTerminal() {
    if (unmountFn) {
        unmountFn();
        unmountFn = null;
    }
    // Show cursor
    process.stdout.write('\x1B[?25h');
    // Clear screen
    process.stdout.write('\x1B[2J\x1B[H');
}

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
    rootNode = { type: 'root', props: {}, children: [] };

    const container = rootNode;

    // Setup input — handle terminals (like Warp) that may not report isTTY correctly
    try {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
    } catch {
        // setRawMode may fail on some terminal emulators — continue without it
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', handleInput);

    // Clear console if requested
    if (options?.clearConsole) {
        process.stdout.write('\x1B[2J\x1B[3J\x1B[H');
    }

    // Hide cursor
    process.stdout.write('\x1B[?25l');

    // Render with app context support
    render(component, container, appContext);

    // DOM operations during render() will scheduleRender().
    // Let the timer batch the initial render with any onMounted effects.

    // Return unmount function
    return () => {
        render(null, container);
        // Show cursor
        process.stdout.write('\x1B[?25h');

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.off('data', handleInput);
        }
    };
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
            border?: 'single' | 'double' | 'rounded' | 'none';
            borderColor?: 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'white' | 'black' | string;
            dropShadow?: boolean;
            label?: string;
            children?: any;
        }

    }
}

