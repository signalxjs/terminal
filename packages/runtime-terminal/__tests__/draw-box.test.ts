/**
 * `drawBox` — borders, labels and the drop shadow.
 *
 * This is the primitive every panel in the design system is built on, and it
 * had no direct tests at all. The assertions here are geometric: a box is only
 * useful if its edges line up, so each test measures painted cells rather than
 * looking for substrings.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget, setColorDepth, displayWidth } from '../src';
import { captureOutput } from './harness';

const flush = () => vi.advanceTimersByTime(20);

/** Paint a single `<box>` and return its lines, stripped of SGR. */
function paint(props: Record<string, unknown>, content: string[]): string[] {
    const cap = captureOutput({ columns: 200, rows: 40 });
    const children = content.flatMap((line, i) => (
        i > 0 ? [jsx('br', {}), jsx('text', { children: line })]
              : [jsx('text', { children: line })]
    ));
    const handle = renderTerminal(jsx('box', { ...props, children }), { patchConsole: false });
    flush();
    const lines = cap.output()
        .split('\n')
        .map((l) => l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''))
        .filter((l) => l.length > 0);
    handle.unmount();
    return lines;
}

describe('drawBox', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        setColorDepth('none');
    });
    afterEach(() => {
        setColorDepth('truecolor');
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('wraps content in a border two rows and two columns larger', () => {
        const lines = paint({ border: 'rounded' }, ['abcd', 'ef']);
        expect(lines).toHaveLength(4);
        expect(lines[0]).toBe('╭────╮');
        expect(lines[3]).toBe('╰────╯');
        // Short content lines are padded out to the box's interior width.
        expect(lines.every((l) => displayWidth(l) === 6)).toBe(true);
    });

    it('pads content horizontally by padX on each side', () => {
        const lines = paint({ border: 'rounded', padX: 2 }, ['ab']);
        expect(displayWidth(lines[0])).toBe(8); // 2 content + 4 pad + 2 border
        expect(lines[1]).toBe('│  ab  │');
    });

    it('centres a label in the top border like a fieldset legend', () => {
        const lines = paint({ border: 'rounded', label: 'hi' }, ['abcdef']);
        expect(lines[0]).toBe('╭─ hi ─╮');
        expect(displayWidth(lines[0])).toBe(displayWidth(lines[1]));
    });

    it('widens the box when the label is longer than the content', () => {
        const lines = paint({ border: 'rounded', label: 'a long legend' }, ['x']);
        // labelLength + 2 becomes the interior width.
        expect(displayWidth(lines[0])).toBe('a long legend'.length + 4);
        expect(lines.every((l) => displayWidth(l) === displayWidth(lines[0]))).toBe(true);
    });

    it('falls back to single for an unknown style, "bold" included', () => {
        // `bold` used to be an undocumented alias of `thick` — a second name
        // for a style that already had one, which the JSX typing never
        // advertised, so nothing could reach it without a cast. Removed; it now
        // takes the same unknown-style path as any other typo.
        const bold = paint({ border: 'bold' }, ['ab']);
        const single = paint({ border: 'single' }, ['ab']);
        const nonsense = paint({ border: 'wobbly' }, ['ab']);
        expect(bold).toEqual(single);
        expect(nonsense).toEqual(single);
        expect(bold[0]).toBe('┌──┐');
    });

    it('measures in display cells, so a wide glyph does not skew the border', () => {
        const lines = paint({ border: 'rounded' }, ['日本']);
        expect(displayWidth(lines[0])).toBe(6); // 4 cells of content + 2 border
        expect(displayWidth(lines[1])).toBe(6);
    });

    describe('drop shadow', () => {
        it('offsets one column right and one row down', () => {
            const lines = paint({ border: 'rounded', dropShadow: true }, ['abcd']);
            expect(lines).toHaveLength(4); // top, content, bottom, shadow row
            expect(lines[0]).toBe('╭────╮');       // top border carries no shadow
            expect(lines[1].endsWith('▒')).toBe(true);
            expect(lines[2].endsWith('▒')).toBe(true);
            expect(lines[3].startsWith(' ')).toBe(true);
        });

        it('runs the full width of the box under a long label', () => {
            // The shadow row used to be sized from the CONTENT width while every
            // other row used boxInnerWidth, so a label longer than the content
            // left it short — the shadow read as an L missing its corner. Not
            // hypothetical: `Card` forwards `title` to `label`, and `<Shell>`
            // forwards `bodyTitle`, so short content under a descriptive title
            // is the ordinary case.
            const lines = paint(
                { border: 'rounded', dropShadow: true, label: 'a rather long panel title' },
                ['short'],
            );
            const bottom = lines[lines.length - 2];
            const shadow = lines[lines.length - 1];
            expect(displayWidth(shadow)).toBe(displayWidth(bottom));
            // …and it is offset one column right of the box's left edge.
            expect(shadow.indexOf('▒')).toBe(1);
        });

        it('runs the full width when the content is wider than the label', () => {
            const lines = paint(
                { border: 'rounded', dropShadow: true, label: 'hi' },
                ['a much wider content line'],
            );
            const bottom = lines[lines.length - 2];
            const shadow = lines[lines.length - 1];
            expect(displayWidth(shadow)).toBe(displayWidth(bottom));
        });
    });
});
