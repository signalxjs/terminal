import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget } from '@sigx/runtime-terminal';
import { LogView } from '../src/tasks/LogView';
import { createLogStore } from '../src/tasks/logStore';
import { captureOutput, settle, press, UP, DOWN } from './prompt-harness';

const PGUP = '\x1b[5~';
const PGDN = '\x1b[6~';
const HOME = '\x1b[H';
const END = '\x1b[F';

function feed(n: number, from = 1) {
    // Explicit passthrough:false — the store is created before captureOutput
    // installs the fake TTY, and the non-TTY default would printStatic every
    // pushed line straight through the live region.
    const store = createLogStore({ passthrough: false });
    for (let i = from; i < from + n; i++) store.push(`line ${i}\n`);
    return store;
}

describe('LogView (scrollable log viewer)', () => {
    let unmount: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        unmount?.();
        unmount = null;
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    async function mount(store: ReturnType<typeof createLogStore>, height = 4) {
        const cap = captureOutput({ columns: 60, rows: 30 });
        unmount = renderTerminal(
            jsx(LogView, { store, height, autofocus: true }),
            { patchConsole: false },
        ).unmount;
        await settle();
        return cap;
    }

    it('follows the tail by default', async () => {
        const store = feed(20);
        const cap = await mount(store);
        const out = cap.output();
        expect(out).toContain('line 20');
        expect(out).toContain('line 17');
        expect(out).toContain('following');
        expect(out).toContain('17–20/20');
    });

    it('scrolling up shows older lines and pauses follow', async () => {
        const store = feed(20);
        const cap = await mount(store);
        cap.clear();
        await press(UP);
        const out = cap.output();
        expect(out).toContain('line 16');
        expect(out).not.toContain('line 20');
        expect(out).toContain('paused');
    });

    it('keeps the paused window pinned to the same content while the stream grows', async () => {
        const store = feed(20);
        const cap = await mount(store);
        cap.clear();
        await press(PGUP); // window now 13–16
        expect(cap.output()).toContain('line 13');

        for (let i = 21; i <= 30; i++) store.push(`line ${i}\n`);
        cap.clear();
        await settle(); // reactive repaint from the store growth
        const after = cap.output();
        expect(after).toContain('line 13');     // same content
        expect(after).toContain('line 16');
        expect(after).not.toContain('line 30'); // tail not shown
        expect(after).toContain('/30');         // but the total updated
    });

    it('PgUp pages and clamps at the top', async () => {
        const store = feed(10);
        const cap = await mount(store, 4);
        await press(PGUP);
        cap.clear();
        await press(PGUP); // already clamped at the top after two pages
        expect(cap.output()).toContain('line 1');
        expect(cap.output()).toContain('1–4/10');
    });

    it('Home jumps to the oldest, End re-follows (both escape variants)', async () => {
        const store = feed(30);
        const cap = await mount(store);
        await press(HOME);
        expect(cap.output()).toContain('line 1');

        cap.clear();
        await press(END);
        expect(cap.output()).toContain('line 30');
        expect(cap.output()).toContain('following');

        cap.clear();
        await press('\x1b[1~'); // Home variant
        expect(cap.output()).toContain('line 1');
        cap.clear();
        await press('\x1b[4~'); // End variant
        expect(cap.output()).toContain('following');
    });

    it('scrolling back down to the bottom re-engages follow', async () => {
        const store = feed(10);
        const cap = await mount(store, 4);
        await press(UP);
        expect(cap.output()).toContain('paused');
        cap.clear();
        await press(DOWN);
        expect(cap.output()).toContain('following');
        cap.clear();
        store.push('line 11\n');
        await settle(); // reactive repaint from the push
        expect(cap.output()).toContain('line 11'); // tail moves again
    });

    it('f toggles follow both ways', async () => {
        const store = feed(10);
        const cap = await mount(store, 4);
        await press('f');
        expect(cap.output()).toContain('paused');
        cap.clear();
        await press('f');
        expect(cap.output()).toContain('following');
    });

    it('fills the configured width regardless of content length', async () => {
        const store = feed(3); // short lines like "line 1"
        const cap = await mount(store, 4); // fake terminal: 60 cols → default width 56
        const lines = cap.output().split('\n');
        const top = lines.find((l) => l.includes('╭'));
        const interior = lines.filter((l) => l.includes('│'));
        expect(top).toBeDefined();
        // The border spans the full default width (columns - 4), not the content.
        expect(top!.indexOf('╮') - top!.indexOf('╭')).toBe(55);
        for (const row of interior) {
            expect(row.indexOf('│', row.indexOf('│') + 1)).toBeGreaterThan(50);
        }
    });

    it('renders a stable frame height with fewer lines than the viewport', async () => {
        const store = feed(2);
        const cap = await mount(store, 6);
        // Count interior rows between the top and bottom border lines.
        const frame = cap.output().split('\n').filter((l) => l.includes('│'));
        expect(frame.length).toBeGreaterThanOrEqual(6);
        expect(cap.output()).toContain('1–2/2');
    });

    it('PgDn moves back toward the tail', async () => {
        const store = feed(20);
        const cap = await mount(store, 4);
        await press(PGUP);
        await press(PGUP);
        cap.clear();
        await press(PGDN);
        expect(cap.output()).toContain('paused');
        cap.clear();
        await press(PGDN);
        expect(cap.output()).toContain('following');
    });
});
