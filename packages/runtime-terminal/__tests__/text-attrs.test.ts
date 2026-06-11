import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget, setColorDepth } from '../src';
import { captureOutput } from './harness';

const flush = () => vi.advanceTimersByTime(20);

function mountText(props: Record<string, unknown>, content = 'styled') {
    return renderTerminal(
        jsx('box', { children: jsx('text', { ...props, children: content }) }),
        { patchConsole: false },
    );
}

describe('text style attributes', () => {
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

    it('emits SGR codes for each flag, closed by a reset', () => {
        const cap = captureOutput();
        unmount = mountText({ bold: true, italic: true, underline: true }).unmount;
        flush();
        const out = cap.output();
        expect(out).toContain('\x1b[1m');
        expect(out).toContain('\x1b[3m');
        expect(out).toContain('\x1b[4m');
        expect(out.indexOf('styled')).toBeGreaterThan(out.indexOf('\x1b[1m'));
        expect(out.indexOf('\x1b[0m')).toBeGreaterThan(out.indexOf('styled'));
    });

    it('composes attributes with color (attrs first)', () => {
        const cap = captureOutput();
        unmount = mountText({ bold: true, color: '#ff0000' }).unmount;
        flush();
        const out = cap.output();
        const bold = out.indexOf('\x1b[1m');
        const red = out.indexOf('\x1b[38;2;255;0;0m');
        expect(bold).toBeGreaterThan(-1);
        expect(red).toBeGreaterThan(bold);
    });

    it('covers inverse, faint, and lineThrough', () => {
        const cap = captureOutput();
        unmount = mountText({ inverse: true, faint: true, lineThrough: true }).unmount;
        flush();
        const out = cap.output();
        expect(out).toContain('\x1b[7m');
        expect(out).toContain('\x1b[2m');
        expect(out).toContain('\x1b[9m');
    });

    it('emits nothing at color depth none (piped output stays escape-free)', () => {
        setColorDepth('none');
        const cap = captureOutput();
        unmount = mountText({ bold: true, underline: true, inverse: true }).unmount;
        flush();
        const out = cap.output();
        expect(out).toContain('styled');
        expect(out).not.toContain('\x1b[1m');
        expect(out).not.toContain('\x1b[4m');
        expect(out).not.toContain('\x1b[7m');
    });
});
