import { describe, it, expect, afterEach } from 'vitest';
import { setColorDepth, setOutputTarget } from '@sigx/runtime-terminal';
import { CANCEL, isCancel } from '../src/prompts/cancel';
import { isEnter, isEsc, isBackspace, isPrintable, isUp } from '../src/prompts/keys';
import { summaryLine } from '../src/prompts/runPrompt';

const ESC = String.fromCharCode(27);

describe('prompt engine (headless, lives in terminal-zero)', () => {
    afterEach(() => {
        setOutputTarget(undefined);
        setColorDepth('truecolor');
    });

    it('CANCEL uses Symbol.for so duplicated module instances agree', () => {
        expect(CANCEL).toBe(Symbol.for('sigx.prompt.cancel'));
        expect(isCancel(CANCEL)).toBe(true);
        expect(isCancel('nope')).toBe(false);
    });

    it('the ui re-export agrees with the engine across module instances', async () => {
        // ui resolves zero via dist while this test imports src — two module
        // instances. Symbol.for makes CANCEL identical anyway, and isCancel
        // must recognize it regardless of which instance produced it.
        const ui = await import('../../terminal-ui/src/prompts/index');
        expect(ui.CANCEL).toBe(CANCEL);
        expect(ui.isCancel(CANCEL)).toBe(true);
        expect(isCancel(ui.CANCEL)).toBe(true);
    });

    it('key predicates distinguish Esc from escape sequences', () => {
        expect(isEsc(ESC)).toBe(true);
        expect(isEsc(ESC + '[A')).toBe(false);
        expect(isUp(ESC + '[A')).toBe(true);
        expect(isEnter('\r')).toBe(true);
        expect(isEnter('\n')).toBe(true);
        expect(isBackspace(String.fromCharCode(127))).toBe(true);
        expect(isBackspace(String.fromCharCode(8))).toBe(true);
        expect(isPrintable('x')).toBe(true);
        expect(isPrintable(ESC)).toBe(false);
    });

    it('summaryLine shapes ◇ done and ■ cancelled lines (plain at depth none)', () => {
        setColorDepth('none');
        expect(summaryLine('done', 'Name', 'my-app')).toBe('◇ Name · my-app');
        expect(summaryLine('done', 'Name')).toBe('◇ Name');
        expect(summaryLine('cancel', 'Name')).toBe('■ Name · cancelled');
    });
});
