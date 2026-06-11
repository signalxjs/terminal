import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget, setColorDepth, renderNodeToLines, type OutputTarget } from '@sigx/runtime-terminal';
import { Text, Heading } from '../src/layout/Text';
import { Col } from '../src/layout/Col';

function capture(): { chunks: string[]; output(): string } {
    const chunks: string[] = [];
    const target: OutputTarget = {
        write: (s: string) => { chunks.push(s); },
        columns: 60,
        rows: 20,
        isTTY: true,
    };
    setOutputTarget(target);
    const strip = (s: string) => s.split('\x1b[?2026h').join('').split('\x1b[?2026l').join('');
    return { chunks, output: () => strip(chunks.join('')) };
}

const flush = () => vi.advanceTimersByTime(20);

describe('Text / Heading primitives', () => {
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

    it('resolves color tokens through the active theme', () => {
        const cap = capture();
        unmount = renderTerminal(
            jsx('box', { children: jsx(Text, { color: 'success', children: 'ok' }) }),
            { patchConsole: false },
        ).unmount;
        flush();
        // neutral theme success = #5faf5f → truecolor SGR
        expect(cap.output()).toContain('\x1b[38;2;');
        expect(cap.output()).toContain('ok');
    });

    it('is INLINE: two Texts compose on one line', () => {
        const cap = capture();
        unmount = renderTerminal(
            jsx('box', {
                children: [
                    jsx(Text, { color: 'dim', children: 'count: ' }),
                    jsx(Text, { color: 'accent', bold: true, children: '42' }),
                ],
            }),
            { patchConsole: false },
        ).unmount;
        flush();
        const line = cap.output().split('\n').find((l) => l.includes('count'));
        expect(line).toBeDefined();
        expect(line).toContain('42'); // same line
        expect(line).toContain('\x1b[1m'); // bold flag passed through
    });

    it('renders plain at depth none', () => {
        setColorDepth('none');
        const cap = capture();
        unmount = renderTerminal(
            jsx('box', { children: jsx(Text, { color: 'danger', bold: true, underline: true, children: 'plain' }) }),
            { patchConsole: false },
        ).unmount;
        flush();
        expect(cap.output()).toContain('plain');
        expect(cap.output()).not.toContain('\x1b[1m');
        expect(cap.output()).not.toContain('\x1b[38;');
    });

    it('Heading is a block: bold, on its own line', () => {
        const cap = capture();
        unmount = renderTerminal(
            jsx('box', {
                children: [
                    jsx('text', { children: 'before' }),
                    jsx(Heading, { children: 'Section' }),
                ],
            }),
            { patchConsole: false },
        ).unmount;
        flush();
        const out = cap.output();
        const beforeLine = out.split('\n').findIndex((l) => l.includes('before'));
        const headingLine = out.split('\n').findIndex((l) => l.includes('Section'));
        expect(headingLine).toBeGreaterThan(beforeLine);
        expect(out).toContain('\x1b[1m');
    });
});

describe('Col gap + Row align aliases', () => {
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

    it('Col gap inserts blank rows between children, not around them', () => {
        const cap = capture();
        unmount = renderTerminal(
            jsx(Col, {
                gap: 1,
                children: [
                    jsx('box', { children: jsx('text', { children: 'one' }) }),
                    jsx('box', { children: jsx('text', { children: 'two' }) }),
                ],
            }),
            { patchConsole: false },
        ).unmount;
        flush();
        const lines = cap.output().split('\n').map((l) => l.replace(/\x1B\[[0-9;?]*[A-Za-z]/g, ''));
        const one = lines.findIndex((l) => l.includes('one'));
        const two = lines.findIndex((l) => l.includes('two'));
        expect(two - one).toBe(2); // exactly one blank row between
        expect(lines[one - 1] ?? '').not.toContain('one'); // nothing inserted before
    });

    it('Row align aliases: top===start, bottom===end', () => {
        const mk = (align: string) => {
            const tall = { type: 'element' as const, tag: 'box', props: {}, children: [
                { type: 'element' as const, tag: 'text', props: {}, children: [{ type: 'text' as const, text: 'a', props: {}, children: [] }] },
                { type: 'element' as const, tag: 'br', props: {}, children: [] },
                { type: 'element' as const, tag: 'text', props: {}, children: [{ type: 'text' as const, text: 'b', props: {}, children: [] }] },
            ] };
            const short = { type: 'element' as const, tag: 'text', props: {}, children: [{ type: 'text' as const, text: 'x', props: {}, children: [] }] };
            return renderNodeToLines({ type: 'element', tag: 'row', props: { align }, children: [tall as never, short as never] });
        };
        expect(mk('top')).toEqual(mk('start'));
        expect(mk('bottom')).toEqual(mk('end'));
        expect(mk('start')).not.toEqual(mk('end'));
    });
});
