import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setOutputTarget } from '@sigx/runtime-terminal';
import {
    text, password, select, multiselect, confirm, isCancel, CANCEL, intro, outro, cancel as cancelLine,
    __setInteractiveOverride,
} from '../src/prompts';
import { captureOutput, settle, press, type, ESC, CTRL_C, ENTER, DOWN } from './prompt-harness';

describe('imperative prompts', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __setInteractiveOverride(true);
    });
    afterEach(() => {
        __setInteractiveOverride(undefined);
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('text: types, submits, erases the UI, and leaves a ◇ summary', async () => {
        const cap = captureOutput();
        const p = text({ message: 'Project name' });
        await settle();
        expect(cap.output()).toContain('◆');
        expect(cap.output()).toContain('Project name');

        await type('my-app');
        cap.clear();
        await press(ENTER);

        const result = await p;
        expect(result).toBe('my-app');
        const out = cap.output();
        expect(out).toContain('\x1B[J');       // region erased
        expect(out).toContain('◇');
        expect(out).toContain('Project name');
        expect(out).toContain('my-app');
    });

    it('text: validate rejects, shows the error, then accepts a fix', async () => {
        const cap = captureOutput();
        const p = text({
            message: 'Name',
            validate: (v) => (v.length >= 3 ? undefined : 'too short'),
        });
        await settle();

        await type('ab');
        await press(ENTER);
        expect(cap.output()).toContain('too short');
        expect(cap.output()).toContain('▲');

        await type('c');
        await press(ENTER);
        expect(await p).toBe('abc');
    });

    it('password: renders and summarizes the mask, never the value', async () => {
        const cap = captureOutput();
        const p = password({ message: 'Token' });
        await settle();
        await type('hunter2');
        await press(ENTER);

        expect(await p).toBe('hunter2');
        expect(cap.output()).not.toContain('hunter2');
        expect(cap.output()).toContain('•••••••');
    });

    it('Esc cancels with the CANCEL symbol and a ■ summary', async () => {
        const cap = captureOutput();
        const p = text({ message: 'Anything' });
        await settle();
        cap.clear();
        await press(ESC);

        const result = await p;
        expect(isCancel(result)).toBe(true);
        expect(result).toBe(CANCEL);
        expect(cap.output()).toContain('■');
        expect(cap.output()).toContain('cancelled');
    });

    it('Ctrl+C cancels instead of exiting (exitOnCtrlC plumbing end-to-end)', async () => {
        captureOutput();
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        const p = select({ message: 'Pick', options: [{ value: 'a' }, { value: 'b' }] });
        await settle();
        await press(CTRL_C);

        expect(isCancel(await p)).toBe(true);
        expect(exitSpy).not.toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it('select: arrows move, Enter resolves the value; summary shows the label', async () => {
        const cap = captureOutput();
        const p = select({
            message: 'Project type',
            options: [
                { value: 'basic', label: 'Basic SPA' },
                { value: 'lynx', label: 'Lynx', description: 'native mobile' },
            ],
        });
        await settle();
        await press(DOWN);
        expect(cap.output()).toContain('native mobile'); // cursor row shows description
        await press(ENTER);

        expect(await p).toBe('lynx');
        expect(cap.output()).toContain('Lynx');
    });

    it('select: initialValue places the cursor', async () => {
        captureOutput();
        const p = select({
            message: 'Type',
            options: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
            initialValue: 'c',
        });
        await settle();
        await press(ENTER);
        expect(await p).toBe('c');
    });

    it('multiselect: space toggles, a toggles all, required blocks empty', async () => {
        const cap = captureOutput();
        const p = multiselect({
            message: 'Features',
            options: [{ value: 'eslint' }, { value: 'vitest' }, { value: 'router' }],
            required: true,
        });
        await settle();

        await press(ENTER); // empty + required → blocked
        expect(cap.output()).toContain('select at least one');

        await press(' ');           // check eslint
        await press(DOWN);
        await press(' ');           // check vitest
        await press(ENTER);

        expect(await p).toEqual(['eslint', 'vitest']);
        expect(cap.output()).toContain('eslint, vitest');
    });

    it('multiselect: a selects all, a again clears', async () => {
        captureOutput();
        const p = multiselect({
            message: 'Features',
            options: [{ value: 'x' }, { value: 'y' }],
        });
        await settle();
        await press('a');
        await press('a');
        await press('a'); // all again
        await press(ENTER);
        expect(await p).toEqual(['x', 'y']);
    });

    it('confirm: y answers immediately; arrows + Enter pick No', async () => {
        captureOutput();
        const p1 = confirm({ message: 'Initialize git?' });
        await settle();
        await press('y');
        expect(await p1).toBe(true);

        const cap = captureOutput();
        const p2 = confirm({ message: 'Overwrite?' });
        await settle();
        await press(ESC + '[C'); // right → toggles to No
        await press(ENTER);
        expect(await p2).toBe(false);
        expect(cap.output()).toContain('No');
    });

    it('serializes concurrent prompts (second waits for the first)', async () => {
        const cap = captureOutput();
        const p1 = text({ message: 'First' });
        const p2 = text({ message: 'Second' });
        await settle();
        expect(cap.output()).toContain('First');
        expect(cap.output()).not.toContain('Second');

        await type('one');
        await press(ENTER);
        expect(await p1).toBe('one');

        await settle();
        expect(cap.output()).toContain('Second');
        await type('two');
        await press(ENTER);
        expect(await p2).toBe('two');
    });

    it('statics print framing lines', async () => {
        const cap = captureOutput();
        intro('create sigx app');
        outro('all done');
        cancelLine('Cancelled.');
        const out = cap.output();
        expect(out).toContain('┌');
        expect(out).toContain('create sigx app');
        expect(out).toContain('└');
        expect(out).toContain('all done');
        expect(out).toContain('■');
    });
});

describe('imperative prompts: non-interactive fallback', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __setInteractiveOverride(false);
    });
    afterEach(() => {
        __setInteractiveOverride(undefined);
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('returns initial values and prints summaries', async () => {
        const cap = captureOutput({ isTTY: false });
        expect(await text({ message: 'Name', initialValue: 'fallback-app' })).toBe('fallback-app');
        expect(await select({ message: 'Type', options: [{ value: 'a' }], initialValue: 'a' })).toBe('a');
        expect(await multiselect({ message: 'Feats', options: [{ value: 'x' }], initialValues: ['x'] })).toEqual(['x']);
        expect(await confirm({ message: 'Git?', initialValue: true })).toBe(true);

        const out = cap.output();
        expect(out).toContain('fallback-app');
        expect(out).toContain('Git?');
    });

    it('rejects with a flags hint when no initial value exists', async () => {
        captureOutput({ isTTY: false });
        await expect(text({ message: 'Name' })).rejects.toThrow(/interactive terminal/);
    });
});
