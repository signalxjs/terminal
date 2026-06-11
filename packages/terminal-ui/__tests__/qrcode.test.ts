import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget } from '@sigx/runtime-terminal';
import { generateQR } from '@sigx/terminal-zero';
import { QRCode } from '../src/data/QRCode';
import { captureOutput, settle } from './prompt-harness';

describe('QRCode component', () => {
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

    it('renders the encoder output verbatim, uncolored', async () => {
        const url = 'https://sigx.dev';
        const cap = captureOutput({ columns: 80, rows: 40 });
        unmount = renderTerminal(jsx(QRCode, { text: url }), { patchConsole: false }).unmount;
        await settle();

        const expected = generateQR(url).split('\n');
        const out = cap.output();
        for (const line of expected) {
            if (line.trim()) expect(out).toContain(line.trimEnd());
        }
        // Max scanner contrast: the component injects no SGR color codes.
        expect(out).not.toContain('\x1b[3');
        expect(out).not.toContain('\x1b[4');
    });
});
