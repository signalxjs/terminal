/**
 * HMR runtime semantics, in-process: registerHMRModule gives component
 * definitions a stable identity; re-defining under the same identity patches
 * every live instance in place (new setup against the existing context) while
 * the terminal mount, the surrounding tree, and state OUTSIDE the edited
 * setup survive.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { component, jsx } from '@sigx/runtime-core';
import { signal } from '@sigx/reactivity';
import { renderTerminal, setOutputTarget, type OutputTarget } from '@sigx/runtime-terminal';
import { clearHMRModule, registerHMRModule } from '../src/hmr';

const flush = () => vi.advanceTimersByTime(20);

function captureOutput(): { output(): string; clear(): void } {
    const chunks: string[] = [];
    const target: OutputTarget = {
        write: (s: string) => { chunks.push(s); },
        columns: 60,
        rows: 20,
        isTTY: true,
    };
    setOutputTarget(target);
    return {
        output: () => chunks.join(''),
        clear: () => { chunks.length = 0; },
    };
}

describe('hmr runtime', () => {
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

    it('patches a live instance when its module redefines the component', () => {
        registerHMRModule('test:patch-live');
        const Label = component(() => () => jsx('text', { children: ['version one'] }));

        const cap = captureOutput();
        unmount = renderTerminal(jsx(Label, {}), { patchConsole: false }).unmount;
        flush();
        expect(cap.output()).toContain('version one');

        // The edited module re-executes: same module id, new definition.
        cap.clear();
        registerHMRModule('test:patch-live');
        component(() => () => jsx('text', { children: ['version two'] }));
        flush();

        const out = cap.output();
        expect(out).toContain('version two');
        // In-place repaint, not a teardown: the cursor is never re-shown.
        expect(out).not.toContain('\x1B[?25h');
    });

    it('keeps state outside the edited component (parent signals) intact', () => {
        registerHMRModule('test:child-mod');
        const Child = component(() => () => jsx('text', { children: ['old child'] }));

        registerHMRModule('test:parent-mod');
        const state = signal({ n: 0 });
        const Parent = component(() => () => jsx('text', {
            children: [jsx(Child, {}), ' n=', String(state.n)],
        }));

        const cap = captureOutput();
        unmount = renderTerminal(jsx(Parent, {}), { patchConsole: false }).unmount;
        flush();
        state.n = 7;
        flush();
        expect(cap.output()).toContain('n=7');

        cap.clear();
        registerHMRModule('test:child-mod');
        component(() => () => jsx('text', { children: ['new child'] }));
        flush();

        const out = cap.output();
        expect(out).toContain('new child');
        expect(out).toContain('n=7');
    });

    it('patches every live instance of the component', () => {
        registerHMRModule('test:multi-mod');
        const Item = component(() => () => jsx('text', { children: ['A'] }));

        const App = component(() => () => jsx('text', {
            children: [jsx(Item, {}), jsx('br', {}), jsx(Item, {})],
        }));

        const cap = captureOutput();
        unmount = renderTerminal(jsx(App, {}), { patchConsole: false }).unmount;
        flush();
        expect(cap.output().split('A').length - 1).toBeGreaterThanOrEqual(2);

        cap.clear();
        registerHMRModule('test:multi-mod');
        component(() => () => jsx('text', { children: ['B'] }));
        flush();

        const out = cap.output();
        expect(out.split('B').length - 1).toBeGreaterThanOrEqual(2);
    });

    it('matches definitions by order within the module', () => {
        registerHMRModule('test:order-mod');
        const First = component(() => () => jsx('text', { children: ['first-v1'] }));
        const Second = component(() => () => jsx('text', { children: ['second-v1'] }));

        const cap = captureOutput();
        unmount = renderTerminal(
            jsx('text', { children: [jsx(First, {}), ' ', jsx(Second, {})] }),
            { patchConsole: false },
        ).unmount;
        flush();
        expect(cap.output()).toContain('first-v1');
        expect(cap.output()).toContain('second-v1');

        cap.clear();
        registerHMRModule('test:order-mod');
        component(() => () => jsx('text', { children: ['first-v2'] }));
        component(() => () => jsx('text', { children: ['second-v2'] }));
        flush();

        const out = cap.output();
        expect(out).toContain('first-v2');
        expect(out).toContain('second-v2');
    });

    it('remounts from a stale factory reference with the NEW setup (tab navigation)', () => {
        // The navigation parent (e.g. a catalog) captured this factory at
        // import time and never sees the re-executed module's new export.
        registerHMRModule('test:stale-mod');
        const Tab = component(() => () => jsx('text', { children: ['tab-v1'] }));
        clearHMRModule('test:stale-mod');

        const cap = captureOutput();
        let handle = renderTerminal(jsx(Tab, {}), { patchConsole: false });
        flush();
        expect(cap.output()).toContain('tab-v1');

        // Edit while mounted: the live instance patches in place...
        cap.clear();
        registerHMRModule('test:stale-mod');
        component(() => () => jsx('text', { children: ['tab-v2'] }));
        clearHMRModule('test:stale-mod');
        flush();
        expect(cap.output()).toContain('tab-v2');

        // ...navigate away (unmount) and back: the remount goes through the
        // STALE factory reference and must still get the new setup.
        handle.unmount();
        const cap2 = captureOutput();
        handle = renderTerminal(jsx(Tab, {}), { patchConsole: false });
        flush();
        expect(cap2.output()).toContain('tab-v2');
        handle.unmount();
        unmount = null;
    });

    it('mounts the NEW setup from a stale factory even when no instance was live at edit time', () => {
        // The user is on tab A and edits tab B's component: nothing to patch
        // at edit time, but mounting B later must use the new code.
        registerHMRModule('test:hidden-mod');
        const Hidden = component(() => () => jsx('text', { children: ['hidden-v1'] }));
        clearHMRModule('test:hidden-mod');

        registerHMRModule('test:hidden-mod');
        component(() => () => jsx('text', { children: ['hidden-v2'] }));
        clearHMRModule('test:hidden-mod');

        const cap = captureOutput();
        unmount = renderTerminal(jsx(Hidden, {}), { patchConsole: false }).unmount;
        flush();
        expect(cap.output()).toContain('hidden-v2');
    });

    it('scopes identities to the module body: definitions after the clear get none', () => {
        registerHMRModule('test:scope-mod');
        const Scoped = component(() => () => jsx('text', { children: ['scoped'] }));
        clearHMRModule('test:scope-mod');

        // A component defined outside any instrumented module (externalized
        // package, runtime callback) must not inherit the last module's id.
        const Stray = component(() => () => jsx('text', { children: ['stray'] }));

        expect((Scoped as any).__hmrId).toBe('test:scope-mod:0');
        expect((Stray as any).__hmrId).toBeUndefined();

        // Clearing under someone else's id must not clobber the active scope.
        registerHMRModule('test:scope-mod2');
        clearHMRModule('test:some-other-mod');
        const StillScoped = component(() => () => jsx('text', { children: ['x'] }));
        expect((StillScoped as any).__hmrId).toBe('test:scope-mod2:0');
        clearHMRModule('test:scope-mod2');
    });

    it('stops tracking unmounted instances', () => {
        registerHMRModule('test:unmount-mod');
        const Gone = component(() => () => jsx('text', { children: ['gone-v1'] }));

        const cap = captureOutput();
        const handle = renderTerminal(jsx(Gone, {}), { patchConsole: false });
        flush();
        handle.unmount();
        setOutputTarget(undefined);

        // Redefining after unmount must not blow up or write anywhere.
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        registerHMRModule('test:unmount-mod');
        component(() => () => jsx('text', { children: ['gone-v2'] }));
        flush();
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });
});
