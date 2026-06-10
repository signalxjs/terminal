import { describe, it, expect, afterEach } from 'vitest';
import { setOutputTarget, type OutputTarget } from '@sigx/runtime-terminal';
import { createLogStore } from '../src/tasks/logStore';

function capture(isTTY: boolean): { chunks: string[]; target: OutputTarget } {
    const chunks: string[] = [];
    const target: OutputTarget = {
        write: (s: string) => { chunks.push(s); },
        columns: 80,
        rows: 24,
        isTTY,
    };
    setOutputTarget(target);
    return { chunks, target };
}

describe('createLogStore', () => {
    afterEach(() => setOutputTarget(undefined));

    it('assembles lines across partial pushes', () => {
        capture(true);
        const store = createLogStore();
        store.push('Installing po');
        store.push('ds (3 of 12)\nDone with');
        store.push(' setup\n');
        expect(store.lines()).toEqual(['Installing pods (3 of 12)', 'Done with setup']);
    });

    it('exposes the live partial as the last entry', () => {
        capture(true);
        const store = createLogStore();
        store.push('complete\nstill stream');
        expect(store.lines()).toEqual(['complete', 'still stream']);
        expect(store.count()).toBe(2);
        store.end();
        expect(store.lines()).toEqual(['complete', 'still stream']);
        store.end(); // idempotent
        expect(store.count()).toBe(2);
    });

    it('resolves \\r with overlay semantics (shorter frame overwrites only its prefix)', () => {
        capture(true);
        const store = createLogStore();
        store.push('12345\r99\n');
        expect(store.lines()).toEqual(['99345']);
        store.push('Downloading 10%\rDownloading 95%\n');
        expect(store.lines()[1]).toBe('Downloading 95%');
    });

    it('applies the \\r overlay to the live partial in tail()', () => {
        capture(true);
        const store = createLogStore();
        store.push('Progress 10%\rProgress 42%');
        expect(store.tail(1)).toEqual(['Progress 42%']);
    });

    it('normalizes CRLF', () => {
        capture(true);
        const store = createLogStore();
        store.push('one\r\ntwo\r\n');
        expect(store.lines()).toEqual(['one', 'two']);
    });

    it('trims to the ring limit', () => {
        capture(true);
        const store = createLogStore({ limit: 3 });
        store.push('1\n2\n3\n4\n5\n');
        expect(store.lines()).toEqual(['3', '4', '5']);
    });

    it('tail returns the last n lines', () => {
        capture(true);
        const store = createLogStore();
        store.push('a\nb\nc\nd\n');
        expect(store.tail(2)).toEqual(['c', 'd']);
        expect(store.tail(0)).toEqual([]);
        expect(store.tail(99)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('clear empties lines and partial', () => {
        capture(true);
        const store = createLogStore();
        store.push('x\npart');
        store.clear();
        expect(store.lines()).toEqual([]);
        expect(store.count()).toBe(0);
    });

    it('defaults passthrough on for non-TTY and streams completed lines', () => {
        const { chunks } = capture(false);
        const store = createLogStore();
        expect(store.passthrough).toBe(true);
        store.push('line one\npartial');
        expect(chunks.join('')).toBe('line one\n');
        store.end();
        expect(chunks.join('')).toBe('line one\npartial\n');
    });

    it('defaults passthrough off on a TTY', () => {
        const { chunks } = capture(true);
        const store = createLogStore();
        expect(store.passthrough).toBe(false);
        store.push('quiet\n');
        expect(chunks.join('')).toBe('');
    });
});
