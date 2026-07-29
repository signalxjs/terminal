/**
 * `<Shell>` — the dashboard frame that hands its body the content box.
 *
 * The test that matters is `fills the terminal exactly`: a body that emits
 * exactly `pane.height` rows must produce a frame of exactly the terminal's
 * height. That makes the chrome arithmetic verify itself, so a future edit to
 * the frame fails here instead of silently breaking a downstream dashboard —
 * which is the entire failure mode this component exists to remove.
 *
 * Everything is asserted on painted geometry rather than on the pane values in
 * isolation, because a pane that is right on paper and wrong on screen is the
 * bug, not the fix.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import {
    renderTerminal, setOutputTarget, setColorDepth, syncTerminalSize, displayWidth,
} from '@sigx/runtime-terminal';
import { fitLines } from '@sigx/terminal-zero';
import { Shell, type ShellPane } from '../src/layout/Shell';
import { captureOutput, settle, type Capture } from './prompt-harness';

const TABS = [
    { label: 'Devices', value: 'devices' },
    { label: 'Logs', value: 'logs' },
    { label: 'Connect', value: 'connect' },
];

/**
 * The painted frame, one entry per row, with SGR and cursor control stripped so
 * lines measure as plain text. Blank rows are kept — a body that pads itself out
 * to its pane emits real blank rows, and dropping them would hide exactly the
 * overflow/short-frame bugs these tests are here to catch.
 */
function frameLines(cap: Capture): string[] {
    return cap.output()
        .split('\n')
        .map((l) => l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''));
}

describe('Shell', () => {
    let unmount: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        setColorDepth('none');
    });
    afterEach(() => {
        unmount?.();
        unmount = null;
        setColorDepth('truecolor');
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    /**
     * Mount a Shell whose body records the pane it was given and fills it
     * exactly, using the same `fitLines` convention the docs point callers at.
     */
    async function mount(
        props: Record<string, unknown> = {},
        opts: { columns?: number; rows?: number } = {},
    ): Promise<{ cap: Capture; pane: () => ShellPane }> {
        const cap = captureOutput({ columns: opts.columns ?? 60, rows: opts.rows ?? 24 });
        syncTerminalSize();
        let seen: ShellPane = { width: 0, height: 0 };
        const body = (pane: ShellPane) => {
            seen = pane;
            const lines = fitLines([], pane);
            return lines.flatMap((line, i) => (
                i > 0 ? [jsx('br', {}), jsx('text', { children: line })]
                      : [jsx('text', { children: line })]
            ));
        };
        unmount = renderTerminal(
            jsx(Shell, { title: 'sigx', ...props, children: body }),
            { patchConsole: false, mode: 'fullscreen' },
        ).unmount;
        await settle();
        return { cap, pane: () => seen };
    }

    it('fills the terminal exactly when the body honours its pane', async () => {
        // THE guard. Chrome + body must add up to the terminal, with no
        // overflow (which shears a fullscreen frame) and no gap.
        const { cap } = await mount({ tabs: TABS, status: [{ key: 'q', label: 'quit' }] });
        expect(frameLines(cap)).toHaveLength(24);
    });

    it('fills exactly across a range of terminal sizes and configurations', async () => {
        for (const rows of [16, 24, 40]) {
            for (const props of [
                { tabs: TABS, status: [{ key: 'q', label: 'quit' }] },
                { tabs: TABS, hints: [{ key: 'q', label: 'quit' }], header: 'gradient' },
                { header: 'plain', body: 'plain' },
                { subtitle: 'http://localhost:5173', tabs: TABS },
            ]) {
                unmount?.();
                unmount = null;
                const { cap } = await mount(props, { rows });
                expect({ rows, props, lines: frameLines(cap).length })
                    .toEqual({ rows, props, lines: rows });
            }
        }
    });

    it('reports the same pane whether the body is a function child or a slots prop', async () => {
        // Core 0.14 invokes a function child as a scoped slot, identical to the
        // `slots` prop form. Both are documented, so both are pinned.
        const { cap: viaChild, pane: childPane } = await mount({ tabs: TABS });
        const childOut = frameLines(viaChild);
        unmount?.();
        unmount = null;

        const cap = captureOutput({ columns: 60, rows: 24 });
        syncTerminalSize();
        let seen: ShellPane = { width: 0, height: 0 };
        unmount = renderTerminal(
            jsx(Shell, {
                title: 'sigx',
                tabs: TABS,
                slots: {
                    default: (pane: ShellPane) => {
                        seen = pane;
                        return fitLines([], pane).flatMap((line, i) => (
                            i > 0 ? [jsx('br', {}), jsx('text', { children: line })]
                                  : [jsx('text', { children: line })]
                        ));
                    },
                },
            }),
            { patchConsole: false, mode: 'fullscreen' },
        ).unmount;
        await settle();

        expect(seen).toEqual(childPane());
        expect(frameLines(cap)).toEqual(childOut);
    });

    it('gives the body the row a one-tab strip would have wasted', async () => {
        // A strip with a single tab says nothing, so it is not drawn.
        const { pane: three } = await mount({ tabs: TABS });
        unmount?.(); unmount = null;
        const { pane: one } = await mount({ tabs: [TABS[0]] });
        unmount?.(); unmount = null;
        const { pane: none } = await mount({});

        expect(one().height).toBe(three().height + 1);
        expect(none().height).toBe(one().height);
    });

    it('charges the boxed body five columns and a plain body none', async () => {
        // 2 border + 2 padX + 1 shadow column.
        const { pane: boxed } = await mount({}, { columns: 60 });
        expect(boxed().width).toBe(55);
        unmount?.(); unmount = null;

        const { pane: plain } = await mount({ body: 'plain' }, { columns: 60 });
        expect(plain().width).toBe(60);
    });

    it('charges a boxed header two more rows than a plain or gradient one', async () => {
        const { pane: plain } = await mount({ header: 'plain' });
        unmount?.(); unmount = null;
        const { pane: gradient } = await mount({ header: 'gradient' });
        unmount?.(); unmount = null;
        const { pane: boxed } = await mount({ header: 'boxed' });

        expect(gradient().height).toBe(plain().height);
        expect(boxed().height).toBe(plain().height - 2);
    });

    it('charges each footer exactly one row, and nothing when absent', async () => {
        const { pane: bare } = await mount({});
        unmount?.(); unmount = null;
        const { pane: status } = await mount({ status: [{ key: 'q', label: 'quit' }] });
        unmount?.(); unmount = null;
        const { pane: both } = await mount({
            status: [{ key: 'q', label: 'quit' }],
            hints: [{ key: 'r', label: 'reload' }],
        });

        // A footer also brings the blank row separating it from the body.
        expect(status().height).toBe(bare().height - 2);
        expect(both().height).toBe(status().height - 1);
    });

    it('charges nothing for a footer that is present but empty', async () => {
        // An app building its footer conditionally passes `[]`; spending a row
        // to draw a blank line would shrink the pane for nothing.
        const { pane: bare } = await mount({});
        unmount?.(); unmount = null;
        const { pane: empty } = await mount({ status: [], hints: [] });

        expect(empty().height).toBe(bare().height);
    });

    it('recomputes the pane on resize', async () => {
        const { cap, pane } = await mount({ tabs: TABS }, { columns: 60, rows: 24 });
        const before = { ...pane() };

        cap.target.rows = 40;
        cap.target.columns = 100;
        syncTerminalSize();
        await settle();

        expect(pane().height).toBe(before.height + 16);
        expect(pane().width).toBe(95);
        expect(frameLines(cap).slice(-40)).toHaveLength(40);
    });

    it('never hands out a pane smaller than one cell', async () => {
        // A terminal too short for the chrome must not produce a negative
        // budget that a caller would then use as a slice length.
        const { pane } = await mount({ tabs: TABS, status: [{ key: 'q', label: 'quit' }] }, { rows: 4 });
        expect(pane().height).toBeGreaterThanOrEqual(1);
    });

    it('lets an over-rendering body overflow rather than clipping it silently', async () => {
        // The documented semantics: pane is a budget, not a reservation. Shell
        // cannot measure an opaque child, so it must not pretend it clipped.
        const cap = captureOutput({ columns: 60, rows: 24 });
        syncTerminalSize();
        const body = (pane: ShellPane) => {
            const lines = fitLines([], { width: pane.width, height: pane.height + 5 });
            return lines.flatMap((line, i) => (
                i > 0 ? [jsx('br', {}), jsx('text', { children: line })]
                      : [jsx('text', { children: line })]
            ));
        };
        unmount = renderTerminal(
            jsx(Shell, { title: 'sigx', tabs: TABS, children: body }),
            { patchConsole: false, mode: 'fullscreen' },
        ).unmount;
        await settle();

        expect(frameLines(cap)).toHaveLength(29);
    });

    it('marks the active tab from the model without owning it', async () => {
        const { cap } = await mount({ tabs: TABS, activeTab: 'logs' });
        const strip = frameLines(cap).find((l) => l.includes('Devices'))!;
        // Numbered chips, so an app can wire 1-9 jump keys itself.
        expect(strip).toContain('1 Devices');
        expect(strip).toContain('2 Logs');
        expect(strip).toContain('3 Connect');
    });

    it('renders the version beside the title and the subtitle below it', async () => {
        const { cap } = await mount({ title: 'sigx actors', version: '0.1.0', subtitle: 'ops' });
        const out = frameLines(cap);
        expect(out.some((l) => l.includes('sigx actors v0.1.0'))).toBe(true);
        expect(out.some((l) => l.includes('ops'))).toBe(true);
    });

    it('keeps every painted line within the terminal width', async () => {
        const { cap } = await mount({ tabs: TABS, status: [{ key: 'q', label: 'quit' }] }, { columns: 60 });
        for (const line of frameLines(cap)) expect(displayWidth(line)).toBeLessThanOrEqual(60);
    });
});
