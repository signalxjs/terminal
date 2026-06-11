import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { signal } from '@sigx/reactivity';
import { renderTerminal, setOutputTarget, dispatchKey } from '@sigx/runtime-terminal';
import { registerFocusable, unregisterFocusable, focusState } from '@sigx/runtime-terminal';
import { TextArea } from '../src/forms/TextArea';
import { captureOutput, settle, press, type, LEFT, UP, ENTER } from './prompt-harness';

describe('TextArea (growing multi-line editor)', () => {
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

    async function mount(opts: { width?: number; maxRows?: number; placeholder?: string } = {}) {
        const cap = captureOutput({ columns: 60, rows: 30 });
        const state = signal({ value: '' });
        const submitted: string[] = [];
        unmount = renderTerminal(
            jsx(TextArea, {
                autofocus: true,
                model: () => state.value,
                onSubmit: (v: string) => submitted.push(v),
                ...opts,
            }),
            { patchConsole: false },
        ).unmount;
        await settle();
        return { cap, state, submitted };
    }

    it('types into the model and renders after the prompt glyph', async () => {
        const { cap, state } = await mount();
        await type('hello');
        expect(state.value).toBe('hello');
        expect(cap.output()).toContain('hello');
        expect(cap.output()).toContain('❯');
    });

    it('inserts mid-text after arrow-left', async () => {
        const { state } = await mount();
        await type('ac');
        await press(LEFT);
        await type('b');
        expect(state.value).toBe('abc');
    });

    it('grows a row when text wraps', async () => {
        const { cap } = await mount({ width: 12 }); // inner width 10
        await type('aaaa');
        cap.clear();
        await type('bbbbbbbbbb'); // total 14 chars → wraps to 2 rows
        const frame = cap.chunks[cap.chunks.length - 1];
        expect(frame.split('\n').length).toBeGreaterThanOrEqual(2);
    });

    it('Enter submits; trailing backslash makes a newline instead', async () => {
        const { state, submitted } = await mount();
        await type('line one\\');
        await press(ENTER);
        expect(submitted).toEqual([]);
        expect(state.value).toBe('line one\n');
        await type('line two');
        await press(ENTER);
        expect(submitted).toEqual(['line one\nline two']);
    });

    it('bare \\n (Ctrl+J) inserts a newline', async () => {
        const { state } = await mount();
        await type('a');
        await press('\n');
        await type('b');
        expect(state.value).toBe('a\nb');
    });

    it('paste chunks insert whole, with CRLF normalized', async () => {
        const { state } = await mount();
        dispatchKey('first\r\nsecond');
        await settle(20);
        expect(state.value).toBe('first\nsecond');
    });

    it('maxRows clamps the frame while the cursor stays visible', async () => {
        const { cap, state } = await mount({ width: 12, maxRows: 2 });
        dispatchKey('1\n2\n3\n4');
        await settle(20);
        expect(state.value).toBe('1\n2\n3\n4');
        const frame = cap.chunks[cap.chunks.length - 1];
        expect(frame).toContain('4'); // cursor row visible
        expect(frame).not.toContain('1\x1B[K'); // earliest row scrolled out

        // Arrow up beyond the window scrolls it.
        cap.clear();
        await press(UP);
        await press(UP);
        await press(UP);
        const after = cap.chunks[cap.chunks.length - 1];
        expect(after).toContain('1');
    });

    it('wide glyphs: cursor inverts the whole glyph and wrap stays intact', async () => {
        const { cap, state } = await mount({ width: 12 });
        await type('漢字');
        await press(LEFT);
        expect(state.value).toBe('漢字');
        const frame = cap.chunks[cap.chunks.length - 1];
        expect(frame).toContain('字'); // glyph present, not split
    });

    it('Tab falls through to focus cycling without inserting', async () => {
        const { state } = await mount();
        registerFocusable('other');
        await type('ab');
        await press('\t');
        expect(state.value).toBe('ab'); // no tab inserted
        expect(focusState.activeId).toBe('other');
        unregisterFocusable('other');
    });
});
