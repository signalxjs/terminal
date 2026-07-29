/**
 * The static `Table` grid.
 *
 * It shipped sizing its columns with `String.length`, which is a full column of
 * drift per wide glyph — so a table containing CJK or emoji came out ragged.
 * The first test here is that bug; the rest guard the ordinary behaviour, which
 * had no tests at all.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget, displayWidth } from '@sigx/runtime-terminal';
import { Table } from '../src/data/Table';
import { captureOutput, settle } from './prompt-harness';

/** Rendered lines with escapes stripped, blank lines dropped. */
function lines(output: string): string[] {
    return output
        .split('\n')
        .map((line) => line.replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '').trimEnd())
        .filter((line) => line.length > 0);
}

/**
 * The display column each line's column separator sits in. Measured in cells,
 * not characters, so a wide glyph before it counts twice.
 */
function separatorColumns(output: string): number[] {
    return lines(output)
        .filter((line) => line.includes('│'))
        .map((line) => displayWidth(line.slice(0, line.indexOf('│'))));
}

describe('Table', () => {
    let unmount: (() => void) | null = null;

    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
        unmount?.();
        unmount = null;
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    async function mount(props: Record<string, unknown>) {
        const cap = captureOutput({ columns: 80, rows: 30 });
        unmount = renderTerminal(jsx(Table, props as never), { patchConsole: false }).unmount;
        await settle();
        return cap;
    }

    it('renders a header, a rule and the rows', async () => {
        const cap = await mount({
            columns: ['Package', 'Layer'],
            rows: [['terminal-ui', 'skin'], ['terminal-zero', 'foundation']],
        });
        const out = cap.output();
        expect(out).toContain('Package');
        expect(out).toContain('terminal-zero');
        expect(out).toContain('foundation');
        expect(out).toContain('─');
        expect(out).toContain('│');
    });

    it('sizes columns to the widest cell', async () => {
        const cap = await mount({
            columns: ['A', 'B'],
            rows: [['wide-value', 'x']],
        });
        // Every line puts its separator in the same column — the only thing
        // "aligned" can mean once trailing padding has been trimmed off.
        expect(new Set(separatorColumns(cap.output()))).toHaveLength(1);
    });

    it('keeps columns aligned when a cell contains wide glyphs', async () => {
        // '日本語' is six columns, not three. Sized with String.length the
        // column comes out three cells short, and the separator on that row
        // drifts three columns right of the header's.
        const cap = await mount({
            columns: ['Name', 'Qty'],
            rows: [['日本語', '1'], ['ab', '2']],
        });
        expect(new Set(separatorColumns(cap.output()))).toHaveLength(1);
    });

    it('tolerates ragged rows and missing rows', async () => {
        const cap = await mount({ columns: ['A', 'B'], rows: [['only']] });
        expect(cap.output()).toContain('only');
        unmount?.();

        const empty = await mount({ columns: ['A', 'B'] });
        expect(empty.output()).toContain('A');
        expect(empty.output()).toContain('B');
    });
});
