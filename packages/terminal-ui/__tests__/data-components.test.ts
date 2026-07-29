/**
 * The stateless data components.
 *
 * The scaling and layout maths is covered in terminal-zero; these assert the
 * presentation decisions that only exist at this layer — chiefly that colour
 * comes from theme tokens and that `Trend` refuses to decide on its own whether
 * "up" is good news.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget, setColorDepth } from '@sigx/runtime-terminal';
import { resolveColor, hexToSGR } from '@sigx/terminal-zero';
import { Sparkline } from '../src/data/Sparkline';
import { Meter } from '../src/data/Meter';
import { Trend } from '../src/data/Trend';
import { BarChart } from '../src/data/BarChart';
import { DetailList } from '../src/data/DetailList';
import { StatusGrid } from '../src/data/StatusGrid';
import { captureOutput, settle } from './prompt-harness';

/** The SGR a theme token paints as, so assertions survive a theme change. */
const sgr = (token: string) => hexToSGR(resolveColor(token));

describe('data components', () => {
    let unmount: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        setColorDepth('truecolor');
    });
    afterEach(() => {
        unmount?.();
        unmount = null;
        setColorDepth('truecolor');
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    async function render(node: unknown) {
        const cap = captureOutput({ columns: 80, rows: 30 });
        unmount = renderTerminal(node as never, { patchConsole: false }).unmount;
        await settle();
        return cap;
    }

    describe('Sparkline', () => {
        it('draws the series, its label and its current value', async () => {
            const cap = await render(jsx(Sparkline, {
                values: [0, 50, 100],
                width: 3,
                max: 100,
                label: 'req/s',
                value: '100',
            }));
            const out = cap.output();
            expect(out).toContain('▁▅█');
            expect(out).toContain('req/s');
            expect(out).toContain('100');
        });

        it('draws a gap as a mark, never as a baseline value', async () => {
            const cap = await render(jsx(Sparkline, { values: [10, null, 10], width: 3 }));
            expect(cap.output()).toContain('█·█');
        });

        it('colours cells by threshold, so a spike is visible without reading the axis', async () => {
            const cap = await render(jsx(Sparkline, {
                values: [10, 100],
                width: 2,
                max: 100,
                color: 'success',
                thresholds: [{ at: 0.9, color: 'danger' }],
            }));
            const out = cap.output();
            expect(out).toContain(sgr('success'));
            expect(out).toContain(sgr('danger'));
        });

        it('stacks into multiple rows when asked', async () => {
            const cap = await render(jsx(Sparkline, { values: [0, 100], width: 2, max: 100, height: 2 }));
            const out = cap.output();
            expect(out).toContain(' █');
            expect(out).toContain('▁█');
        });

        it('packs two samples per cell in braille', async () => {
            const cap = await render(jsx(Sparkline, {
                values: [100, 100], width: 1, max: 100, variant: 'braille',
            }));
            expect(cap.output()).toContain('⣿');
        });
    });

    describe('Meter', () => {
        it('fills proportionally and keeps a sliver visible', async () => {
            const cap = await render(jsx(Meter, { value: 50, max: 100, width: 10, label: 'cpu', text: '50%' }));
            const out = cap.output();
            expect(out).toContain('█████░░░░░');
            expect(out).toContain('cpu');
            expect(out).toContain('50%');
        });

        it('takes its colour from the threshold it has crossed', async () => {
            const cool = await render(jsx(Meter, {
                value: 10, max: 100, width: 4,
                thresholds: [{ at: 0.8, color: 'warn' }, { at: 0.95, color: 'danger' }],
            }));
            expect(cool.output()).toContain(sgr('accent'));
            unmount?.();

            const hot = await render(jsx(Meter, {
                value: 97, max: 100, width: 4,
                thresholds: [{ at: 0.8, color: 'warn' }, { at: 0.95, color: 'danger' }],
            }));
            expect(hot.output()).toContain(sgr('danger'));
        });
    });

    describe('Trend', () => {
        it('marks direction', async () => {
            expect((await render(jsx(Trend, { current: 5, previous: 3 }))).output()).toContain('▲');
            unmount?.();
            expect((await render(jsx(Trend, { current: 3, previous: 5 }))).output()).toContain('▼');
            unmount?.();
            expect((await render(jsx(Trend, { current: 3, previous: 3 }))).output()).toContain('·');
        });

        it('reports no direction across a gap', async () => {
            // Comparing across a counter reset would show a crash that never
            // happened.
            const cap = await render(jsx(Trend, { current: 5, previous: null }));
            expect(cap.output()).toContain('·');
            expect(cap.output()).not.toContain('▲');
        });

        it('lets the metric decide whether up is bad news', async () => {
            // Rising latency is a problem; rising throughput is not. A component
            // that hardcoded ▲ = warning would be lying about half a dashboard.
            const latency = await render(jsx(Trend, { current: 5, previous: 3, polarity: 'higher-is-worse' }));
            expect(latency.output()).toContain(sgr('warn'));
            unmount?.();

            const throughput = await render(jsx(Trend, { current: 5, previous: 3, polarity: 'higher-is-better' }));
            expect(throughput.output()).toContain(sgr('success'));
            unmount?.();

            const neutral = await render(jsx(Trend, { current: 5, previous: 3, polarity: 'neutral' }));
            expect(neutral.output()).toContain(sgr('dim'));
            expect(neutral.output()).not.toContain(sgr('warn'));
        });
    });

    describe('BarChart', () => {
        it('measures every bar against the one scale it was given', async () => {
            const cap = await render(jsx(BarChart, {
                items: [{ label: 'p50', value: 1 }, { label: 'p99', value: 100 }],
                scale: 100,
                width: 10,
                format: (ms: number) => `${ms}ms`,
            }));
            const out = cap.output();
            // Scaled per row, both would draw as full bars and the comparison
            // the panel exists for would be gone.
            expect(out).toContain('█░░░░░░░░░');
            expect(out).toContain('██████████');
            expect(out).toContain('100ms');
        });

        it('says so when there is no reading, instead of drawing a zero', async () => {
            const cap = await render(jsx(BarChart, {
                items: [{ label: 'turn', value: null }],
                scale: 10,
                emptyText: 'no samples',
            }));
            const out = cap.output();
            expect(out).toContain('no samples');
            expect(out).not.toContain('░░░░');
        });

        it('renders an empty set as a note', async () => {
            const cap = await render(jsx(BarChart, { items: [], scale: 1, emptyText: 'nothing yet' }));
            expect(cap.output()).toContain('nothing yet');
        });
    });

    describe('DetailList', () => {
        it('aligns values into a column', async () => {
            const cap = await render(jsx(DetailList, {
                rows: [
                    { label: 'version', value: '0.9.0' },
                    { label: 'up', value: '3d' },
                ],
            }));
            const lines = cap.output().split('\n').filter((line) => /0\.9\.0|3d/.test(line));
            expect(lines).toHaveLength(2);
            // Both values start at the same column once escapes are stripped.
            const columnOf = (line: string, needle: string) =>
                line.replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '').indexOf(needle);
            expect(columnOf(lines[0]!, '0.9.0')).toBe(columnOf(lines[1]!, '3d'));
        });

        it('tones a value that is out of range', async () => {
            const cap = await render(jsx(DetailList, {
                rows: [{ label: 'errors', value: '17', tone: 'danger' }],
            }));
            expect(cap.output()).toContain(sgr('danger'));
        });
    });

    describe('StatusGrid', () => {
        it('gives each state its own glyph and colour', async () => {
            const cap = await render(jsx(StatusGrid, {
                cells: [
                    { label: 'p0', tone: 'ok' },
                    { label: 'p1', tone: 'danger' },
                    { label: 'p2', tone: 'warn' },
                ],
                perRow: 8,
            }));
            const out = cap.output();
            expect(out).toContain('●');
            expect(out).toContain('○');
            expect(out).toContain('◆');
            expect(out).toContain(sgr('success'));
            expect(out).toContain(sgr('danger'));
        });

        it('wraps into rows of `perRow`', async () => {
            const cap = await render(jsx(StatusGrid, {
                cells: Array.from({ length: 5 }, (_, i) => ({ label: `p${i}`, tone: 'ok' as const })),
                perRow: 2,
                legend: 'shards',
            }));
            const lines = cap.output().split('\n').filter((line) => line.includes('●'));
            expect(lines).toHaveLength(3);
            expect(cap.output()).toContain('shards');
        });

        it('renders an empty set as a note', async () => {
            const cap = await render(jsx(StatusGrid, { cells: [], emptyText: 'no shards' }));
            expect(cap.output()).toContain('no shards');
        });
    });
});
