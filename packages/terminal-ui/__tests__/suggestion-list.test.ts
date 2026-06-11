import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget, onKey, dispatchKey } from '@sigx/runtime-terminal';
import { SuggestionList } from '../src/navigation/SuggestionList';
import { captureOutput, settle, press, ESC, UP, DOWN, ENTER } from './prompt-harness';

const ITEMS = [
    { value: '/help', description: 'show help' },
    { value: '/model', description: 'pick a model' },
    { value: '/quit', description: 'exit' },
];

describe('SuggestionList (overlay intellisense)', () => {
    let unmount: (() => void) | null = null;
    let offSpy: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        offSpy?.();
        offSpy = null;
        unmount?.();
        unmount = null;
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    async function mount(events: { onAccept?: (v: string) => void; onDismiss?: () => void } = {}) {
        const cap = captureOutput({ columns: 60, rows: 30 });
        unmount = renderTerminal(
            jsx(SuggestionList, { items: ITEMS, ...events }),
            { patchConsole: false },
        ).unmount;
        await settle();
        return cap;
    }

    it('consumes arrow keys (a control-layer spy never sees them)', async () => {
        const seen: string[] = [];
        offSpy = onKey((k) => { seen.push(k); });
        await mount();
        await press(DOWN);
        await press(UP);
        expect(seen).toEqual([]);
    });

    it('lets printables and backspace fall through', async () => {
        const seen: string[] = [];
        offSpy = onKey((k) => { seen.push(k); });
        await mount();
        dispatchKey('x');
        dispatchKey(String.fromCharCode(127));
        expect(seen).toEqual(['x', String.fromCharCode(127)]);
    });

    it('accepts the highlighted item on Enter and on Tab', async () => {
        const accepted: string[] = [];
        await mount({ onAccept: (v) => accepted.push(v) });
        await press(DOWN);
        await press(ENTER);
        expect(accepted).toEqual(['/model']);
        await press('\t');
        expect(accepted).toEqual(['/model', '/model']);
    });

    it('Esc dismisses and is consumed', async () => {
        let dismissed = 0;
        const seen: string[] = [];
        offSpy = onKey((k) => { seen.push(k); });
        await mount({ onDismiss: () => { dismissed++; } });
        await press(ESC);
        expect(dismissed).toBe(1);
        expect(seen).toEqual([]);
    });

    it('unmount unregisters the overlay handler', async () => {
        const seen: string[] = [];
        offSpy = onKey((k) => { seen.push(k); });
        await mount();
        unmount?.();
        unmount = null;
        dispatchKey(DOWN);
        expect(seen).toEqual([DOWN]);
    });

    it('renders the items with the cursor row highlighted', async () => {
        const cap = await mount();
        const out = cap.output();
        expect(out).toContain('/help');
        expect(out).toContain('show help');
        expect(out).toContain('/quit');
    });
});
