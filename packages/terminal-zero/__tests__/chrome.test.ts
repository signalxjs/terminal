/**
 * Frame arithmetic.
 *
 * `boxChrome` exists to replace hardcoded constants (`- 4`, `rows - 12`) whose
 * only proof was that they happened to look right, so the assertions here are
 * against `drawBox`'s actual behaviour in `@sigx/runtime-terminal`: a border is
 * one row and one column on each side, `padX` widens both sides, and a drop
 * shadow costs a column on every row plus one row underneath.
 *
 * The `renders` test at the bottom is the one that keeps this honest — it draws
 * a real box and measures it, so a change to `drawBox` fails here rather than
 * silently shifting every consumer's layout.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import {
    displayWidth, renderTerminal, setOutputTarget, setColorDepth, type OutputTarget,
} from '@sigx/runtime-terminal';
import { boxChrome, fitLines } from '../src/shared/chrome';

describe('boxChrome', () => {
    it('costs nothing for a bare box', () => {
        expect(boxChrome()).toEqual({ rows: 0, cols: 0 });
        expect(boxChrome({})).toEqual({ rows: 0, cols: 0 });
        expect(boxChrome({ border: false })).toEqual({ rows: 0, cols: 0 });
    });

    it('charges nothing for border="none", which draws nothing', () => {
        // Callers forward a variable border style straight through, so the
        // string the renderer treats as "no border" has to cost nothing here
        // too — it is truthy, and charging for it would be a silent column off.
        expect(boxChrome({ border: 'none' })).toEqual({ rows: 0, cols: 0 });
        // Every style costs the same, `'bold'` included — the renderer treats
        // it as an alias of `'thick'` (index.ts:603), so it has to be accepted
        // here or a caller forwarding the prop needs a cast.
        for (const border of ['single', 'double', 'rounded', 'thick', 'bold'] as const) {
            expect(boxChrome({ border })).toEqual({ rows: 2, cols: 2 });
        }
    });

    it('charges a border two rows and two columns', () => {
        expect(boxChrome({ border: true })).toEqual({ rows: 2, cols: 2 });
    });

    it('charges padX to both sides, and no rows — there is no padY', () => {
        expect(boxChrome({ border: true, padX: 1 })).toEqual({ rows: 2, cols: 4 });
        expect(boxChrome({ border: true, padX: 3 })).toEqual({ rows: 2, cols: 8 });
    });

    it('charges a drop shadow one row and one column', () => {
        expect(boxChrome({ border: true, dropShadow: true })).toEqual({ rows: 3, cols: 3 });
    });

    it('charges nothing for padX or dropShadow without a border', () => {
        // Both are `drawBox` options and `drawBox` only runs when a border is
        // drawn, so on a bare `<box>` they are inert. Charging for them would
        // report space that nothing spent — and a caller subtracting it would
        // under-size its content by three columns for no reason.
        expect(boxChrome({ padX: 3, dropShadow: true })).toEqual({ rows: 0, cols: 0 });
        expect(boxChrome({ border: 'none', padX: 3, dropShadow: true })).toEqual({ rows: 0, cols: 0 });
    });

    it('adds up for the panel recipe the library actually draws', () => {
        // `Card` / the <Shell> body: rounded border + padX={1} + dropShadow.
        expect(boxChrome({ border: true, padX: 1, dropShadow: true }))
            .toEqual({ rows: 3, cols: 5 });
        // The same panel without a shadow — LogView's viewport, whose
        // hand-rolled constant is the `- 4` this replaces.
        expect(boxChrome({ border: true, padX: 1 })).toEqual({ rows: 2, cols: 4 });
    });

    it('floors a fractional padX, because the renderer does', () => {
        // `drawBox` pads with `' '.repeat(padX)`, and `repeat` truncates — so
        // charging 3 columns for `padX={1.5}` would report the box a column
        // wider than anything actually drew.
        expect(boxChrome({ border: true, padX: 1.5 })).toEqual({ rows: 2, cols: 4 });
        expect(boxChrome({ border: true, padX: 0.9 })).toEqual({ rows: 2, cols: 2 });
    });

    it('collapses a negative padX back to a plain border', () => {
        expect(boxChrome({ border: true, padX: -2 })).toEqual(boxChrome({ border: true }));
    });
});

describe('fitLines', () => {
    const box = { width: 6, height: 3 };

    it('pads every line to the full width', () => {
        expect(fitLines(['ab', 'cde'], box)).toEqual(['ab    ', 'cde   ', '      ']);
    });

    it('pads the list out to the full height', () => {
        expect(fitLines([], box)).toEqual(['      ', '      ', '      ']);
    });

    it('clips to the height, keeping the first lines', () => {
        // A caller wanting the tail slices before calling — documented, because
        // guessing would make a log viewer and a table disagree.
        expect(fitLines(['1', '2', '3', '4', '5'], box))
            .toEqual(['1     ', '2     ', '3     ', ]);
    });

    it('marks truncation rather than cutting silently', () => {
        expect(fitLines(['abcdefghij'], { width: 6, height: 1 })).toEqual(['abcde…']);
    });

    it('measures in display cells, not characters', () => {
        // Two CJK ideographs are four columns, so only one space is left.
        const [line] = fitLines(['日本'], { width: 5, height: 1 });
        expect(displayWidth(line)).toBe(5);
    });

    it('honours alignment', () => {
        expect(fitLines(['ab'], { width: 6, height: 1 }, 'right')).toEqual(['    ab']);
        expect(fitLines(['ab'], { width: 6, height: 1 }, 'center')).toEqual(['  ab  ']);
    });

    it('produces an empty frame for a degenerate box', () => {
        expect(fitLines(['x'], { width: 0, height: 0 })).toEqual([]);
        expect(fitLines(['x'], { width: -1, height: -1 })).toEqual([]);
    });

    it('always produces exactly height lines of exactly width cells', () => {
        // The invariant every consumer relies on to hold a stable frame.
        const lines = fitLines(['short', 'a much longer line than fits', '日本語'], box);
        expect(lines).toHaveLength(box.height);
        for (const line of lines) expect(displayWidth(line)).toBe(box.width);
    });
});

/**
 * The constants above are only worth having if they match what the renderer
 * actually paints. These draw a real `<box>` around content of a known size and
 * measure the result, so a change to `drawBox` fails here rather than silently
 * shifting the layout of everything that subtracts `boxChrome`.
 */
describe('boxChrome agrees with what drawBox paints', () => {
    let unmount: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        setColorDepth('none'); // no SGR, so displayWidth measures plain text
    });
    afterEach(() => {
        unmount?.();
        unmount = null;
        setColorDepth('truecolor');
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    /** Paint one `<box>` wrapping `content` and return its rendered lines. */
    function paint(props: Record<string, unknown>, content: string[]): string[] {
        const chunks: string[] = [];
        const target: OutputTarget = {
            write: (s: string) => { chunks.push(s); },
            columns: 200,
            rows: 40,
            isTTY: true,
        };
        setOutputTarget(target);
        const children = content.flatMap((line, i) => (
            i > 0 ? [jsx('br', {}), jsx('text', { children: line })]
                  : [jsx('text', { children: line })]
        ));
        unmount = renderTerminal(jsx('box', { ...props, children }), { patchConsole: false }).unmount;
        vi.advanceTimersByTime(20);
        return chunks.join('')
            .split('\x1b[?2026h').join('')
            .split('\x1b[?2026l').join('')
            .split('\n')
            .map((l) => l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''))
            .filter((l) => l.trim().length > 0);
    }

    const CONTENT = ['abcd', 'efgh']; // 2 rows of 4 cells

    for (const opts of [
        { border: true },
        { border: true, padX: 1 },
        { border: true, padX: 2, dropShadow: true },
        { border: true, dropShadow: true },
        { border: true, padX: 1.5 }, // the renderer truncates; so must we
    ]) {
        it(`matches ${JSON.stringify(opts)}`, () => {
            const chrome = boxChrome(opts);
            const lines = paint(
                { border: 'rounded', padX: opts.padX, dropShadow: opts.dropShadow },
                CONTENT,
            );
            expect(lines.length - CONTENT.length).toBe(chrome.rows);
            const painted = Math.max(...lines.map((l) => displayWidth(l)));
            expect(painted - 4).toBe(chrome.cols);
        });
    }

    it('charges nothing for a borderless box, whatever else is set on it', () => {
        // The case the unit tests can only assert by assumption: `padX` and
        // `dropShadow` are `drawBox` options, and a bare `<box>` never reaches
        // `drawBox`, so the renderer ignores them entirely.
        const lines = paint({ padX: 3, dropShadow: true }, CONTENT);
        expect(lines).toHaveLength(CONTENT.length);
        expect(Math.max(...lines.map((l) => displayWidth(l)))).toBe(4);
        expect(boxChrome({ padX: 3, dropShadow: true })).toEqual({ rows: 0, cols: 0 });
    });
});
