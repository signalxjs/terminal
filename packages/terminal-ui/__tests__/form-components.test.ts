import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { signal } from '@sigx/reactivity';
import { renderTerminal, setOutputTarget } from '@sigx/runtime-terminal';
import { MultiSelect } from '../src/forms/MultiSelect';
import { Confirm } from '../src/forms/Confirm';
import { KeyHints } from '../src/navigation/KeyHints';
import { captureOutput, settle, press, DOWN } from './prompt-harness';

describe('MultiSelect / Confirm / KeyHints components', () => {
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

    it('MultiSelect toggles via space and submits the checked values', async () => {
        captureOutput();
        const state = signal({ picked: [] as string[] });
        const submitted: string[][] = [];
        unmount = renderTerminal(
            jsx(MultiSelect, {
                options: [
                    { label: 'ESLint', value: 'eslint' },
                    { label: 'Vitest', value: 'vitest' },
                ],
                autofocus: true,
                model: () => state.picked,
                onSubmit: (v: string[]) => submitted.push(v),
            }),
            { patchConsole: false },
        ).unmount;
        await settle();

        await press(' ');     // check eslint
        await press(DOWN);
        await press(' ');     // check vitest
        expect(state.picked).toEqual(['eslint', 'vitest']);

        await press('\r');
        expect(submitted).toEqual([[ 'eslint', 'vitest' ]]);
    });

    it('MultiSelect a toggles all; required blocks an empty submit', async () => {
        const cap = captureOutput();
        const state = signal({ picked: [] as string[] });
        const submitted: string[][] = [];
        unmount = renderTerminal(
            jsx(MultiSelect, {
                options: [{ label: 'X', value: 'x' }, { label: 'Y', value: 'y' }],
                autofocus: true,
                required: true,
                model: () => state.picked,
                onSubmit: (v: string[]) => submitted.push(v),
            }),
            { patchConsole: false },
        ).unmount;
        await settle();

        await press('\r'); // empty + required
        expect(submitted).toEqual([]);
        expect(cap.output()).toContain('select at least one');

        await press('a');
        expect(state.picked).toEqual(['x', 'y']);
        await press('\r');
        expect(submitted).toEqual([[ 'x', 'y' ]]);
    });

    it('Confirm answers y/n immediately and toggles with arrows', async () => {
        captureOutput();
        const state = signal({ ok: true });
        const submitted: boolean[] = [];
        unmount = renderTerminal(
            jsx(Confirm, {
                label: 'Continue?',
                autofocus: true,
                model: () => state.ok,
                onSubmit: (v: boolean) => submitted.push(v),
            }),
            { patchConsole: false },
        ).unmount;
        await settle();

        await press('n');
        expect(submitted).toEqual([false]);
        expect(state.ok).toBe(false);

        await press('\x1b[D'); // left → toggles back to true
        expect(state.ok).toBe(true);
        await press('\r');
        expect(submitted).toEqual([false, true]);
    });

    it('KeyHints renders keys, labels, and separators on one line', async () => {
        const cap = captureOutput();
        unmount = renderTerminal(
            jsx(KeyHints, {
                hints: [
                    { key: 'r', label: 'reload' },
                    { key: 'q', label: 'quit' },
                ],
            }),
            { patchConsole: false },
        ).unmount;
        await settle();

        const out = cap.output();
        const row = out.split('\n').find((l) => l.includes('reload'));
        expect(row).toBeDefined();
        expect(row).toContain('r');
        expect(row).toContain('reload');
        expect(row).toContain('·');
        expect(row).toContain('q');
        expect(row).toContain('quit');
    });
});
