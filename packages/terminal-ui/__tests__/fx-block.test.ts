import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget, setColorDepth } from '@sigx/runtime-terminal';
import { Gradient } from '../src/fx/Gradient';
import { Shimmer } from '../src/fx/Shimmer';
import { captureOutput, settle } from './prompt-harness';

describe('fx text components are block elements', () => {
    let unmount: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
        setColorDepth('truecolor');
    });
    afterEach(() => {
        unmount?.();
        unmount = null;
        setOutputTarget(undefined);
        setColorDepth('truecolor');
        vi.useRealTimers();
    });

    async function lineOf(cap: ReturnType<typeof captureOutput>, needle: string) {
        // Strip SGR escapes first — per-character gradients split the literal
        // text with color codes.
        const esc = String.fromCharCode(27);
        const strip = (s: string) => s.split(esc).map((part, i) => (i === 0 ? part : part.replace(/^\[[0-9;]*[A-Za-z]/, ''))).join('');
        const lines = cap.output().split('\n').map(strip);
        return lines.findIndex((l) => l.includes(needle));
    }

    it('Shimmer starts on its own line instead of gluing to the previous one', async () => {
        const cap = captureOutput({ columns: 60, rows: 20 });
        unmount = renderTerminal(
            jsx('box', {
                children: [
                    jsx('text', { children: 'input row' }),
                    jsx(Shimmer, { text: 'thinking…' }),
                ],
            }),
            { patchConsole: false },
        ).unmount;
        await settle();

        const inputLine = await lineOf(cap, 'input row');
        const shimmerLine = await lineOf(cap, 'thinking');
        expect(inputLine).toBeGreaterThanOrEqual(0);
        expect(shimmerLine).toBeGreaterThan(inputLine); // different, later line
    });

    it('Gradient starts on its own line at every color depth', async () => {
        for (const depth of ['truecolor', 'ansi16', 'none'] as const) {
            setColorDepth(depth);
            const cap = captureOutput({ columns: 60, rows: 20 });
            unmount = renderTerminal(
                jsx('box', {
                    children: [
                        jsx('text', { children: 'header' }),
                        jsx(Gradient, { text: 'title' }),
                    ],
                }),
                { patchConsole: false },
            ).unmount;
            await settle();

            const headerLine = await lineOf(cap, 'header');
            const titleLine = await lineOf(cap, 'title');
            expect(titleLine, `depth ${depth}`).toBeGreaterThan(headerLine);
            unmount?.();
            unmount = null;
        }
    });
});
