import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderNodeToLines, renderTerminal, setOutputTarget, displayWidth, type TerminalNode } from '../src';
import { captureOutput, linesApp } from './harness';

// Tiny node builders — renderNodeToLines is pure, no mount needed.
function el(tag: string, props: Record<string, unknown> = {}, children: TerminalNode[] = []): TerminalNode {
    return { type: 'element', tag, props, children };
}
function t(text: string): TerminalNode {
    return { type: 'text', text, props: {}, children: [] };
}
function textEl(text: string): TerminalNode {
    return el('text', {}, [t(text)]);
}
function boxWith(lines: string[], props: Record<string, unknown> = {}): TerminalNode {
    const children: TerminalNode[] = [];
    lines.forEach((line, i) => {
        if (i > 0) children.push(el('br'));
        children.push(textEl(line));
    });
    return el('box', props, children);
}

describe('<row> rendering', () => {
    it('merges two bordered boxes side by side with aligned borders', () => {
        const row = el('row', {}, [
            boxWith(['aa'], { border: 'single' }),
            boxWith(['bbb'], { border: 'single' }),
        ]);
        const lines = renderNodeToLines(row);
        expect(lines).toEqual([
            '┌──┐  ┌───┐',
            '│aa│  │bbb│',
            '└──┘  └───┘',
        ]);
    });

    it('pads shorter columns: top (default), bottom, center', () => {
        const tall = boxWith(['1', '2', '3']);
        const short = boxWith(['x']);

        const top = renderNodeToLines(el('row', {}, [tall, short]));
        expect(top).toEqual(['1  x', '2', '3']);

        const bottom = renderNodeToLines(el('row', { align: 'bottom' }, [tall, short]));
        expect(bottom).toEqual(['1', '2', '3  x']);

        const center = renderNodeToLines(el('row', { align: 'center' }, [tall, short]));
        expect(center).toEqual(['1', '2  x', '3']);
    });

    it('pads wide-glyph columns by display cells, not UTF-16 length', () => {
        const row = el('row', {}, [
            boxWith(['漢字', 'ab']),   // 漢字 = 4 cells, 2 code units
            boxWith(['ok', 'ok']),
        ]);
        const lines = renderNodeToLines(row);
        // Column 2 must start at the same display cell on every line.
        const starts = lines.map((l) => displayWidth(l.slice(0, l.indexOf('ok'))));
        expect(starts[0]).toBe(starts[1]);
        expect(lines[1]).toBe('ab    ok');
    });

    it('reset-terminates colored cells so SGR cannot bleed into the next column', () => {
        const row = el('row', {}, [
            boxWith(['\x1b[31mred']),  // un-terminated SGR in column 1
            boxWith(['plain']),
        ]);
        const [line] = renderNodeToLines(row);
        const resetIdx = line.indexOf('\x1b[0m');
        const plainIdx = line.indexOf('plain');
        expect(resetIdx).toBeGreaterThan(-1);
        expect(resetIdx).toBeLessThan(plainIdx);
        // Nothing re-opens red before column 2.
        expect(line.slice(resetIdx, plainIdx)).not.toContain('\x1b[31m');
    });

    it('honors gap, including 0', () => {
        const mk = (gap: number) => renderNodeToLines(el('row', { gap }, [boxWith(['a']), boxWith(['b'])]))[0];
        expect(mk(0)).toBe('ab');
        expect(mk(2)).toBe('a  b');
        expect(mk(5)).toBe('a     b');
    });

    it('a row inside a bordered box gets a correctly sized border', () => {
        const outer = el('box', { border: 'single' }, [
            el('row', {}, [boxWith(['aa']), boxWith(['bb'])]),
        ]);
        const lines = renderNodeToLines(outer);
        const width = displayWidth(lines[0]);
        for (const line of lines) {
            expect(displayWidth(line)).toBe(width);
            expect(line.startsWith('│') || line.startsWith('┌') || line.startsWith('└')).toBe(true);
        }
        expect(lines[1]).toContain('aa  bb');
    });

    it('treats bare text nodes as single-line columns', () => {
        const row = el('row', {}, [t('label:'), boxWith(['value'])]);
        expect(renderNodeToLines(row)[0]).toBe('label:  value');
    });

    it('renders an empty row as one blank line', () => {
        expect(renderNodeToLines(el('row', {}))).toEqual(['']);
    });

    it('nests rows inside rows', () => {
        const inner = el('row', { gap: 1 }, [t('a'), t('b')]);
        const outer = el('row', {}, [inner, t('c')]);
        expect(renderNodeToLines(outer)[0]).toBe('a b  c');
    });

    it('a component wrapper containing a row is treated as a block', () => {
        // Wrapper element (no tag match) whose child is a row: must start on
        // its own line instead of being appended inline.
        const wrapper = el('wrapper', {}, [el('row', {}, [t('col')])]);
        const parent = el('box', {}, [textEl('before'), wrapper]);
        const lines = renderNodeToLines(parent);
        expect(lines).toEqual(['before', 'col']);
    });
});

describe('fullscreen width truncation (regression for wide rows)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('truncates over-wide lines in fullscreen mode so frames cannot shear', () => {
        const cap = captureOutput({ columns: 10 });
        const app = linesApp(['x'.repeat(40)]);
        const handle = renderTerminal(app.vnode, { mode: 'fullscreen', patchConsole: false });
        vi.advanceTimersByTime(20);

        expect(cap.output()).toContain('x'.repeat(10));
        expect(cap.output()).not.toContain('x'.repeat(11));
        handle.unmount();
    });
});
