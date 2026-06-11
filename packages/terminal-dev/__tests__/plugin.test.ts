/**
 * The dev plugin's transform: component modules get identity registration and
 * a self-accept; mount modules register but never self-accept (re-executing
 * them would double-mount); everything else passes through untouched.
 */
import { describe, it, expect } from 'vitest';
import { terminalDevPlugin } from '../src/plugin';

function makePlugin(command: 'serve' | 'build' = 'serve') {
    const plugin = terminalDevPlugin();
    (plugin.config as any)({}, { command, mode: 'development' });
    return plugin;
}

function transform(plugin: ReturnType<typeof terminalDevPlugin>, code: string, id: string) {
    return (plugin.transform as any)(code, id) as { code: string } | null;
}

const COMPONENT_MODULE = `
import { component } from '@sigx/runtime-core';
export const Label = component(() => () => <text>hi</text>);
`;

const MOUNT_MODULE = `
import { defineApp, component, terminalMount } from '@sigx/terminal';
const App = component(() => () => <text>hi</text>);
defineApp(<App />).mount({ mode: 'inline' }, terminalMount);
`;

describe('terminalDevPlugin transform', () => {
    it('injects identity registration and self-accept into component modules', () => {
        const result = transform(makePlugin(), COMPONENT_MODULE, '/app/src/Label.tsx');
        expect(result).not.toBeNull();
        expect(result!.code).toContain(`__sigxRegisterHMRModule('/app/src/Label.tsx')`);
        expect(result!.code).toContain('import.meta.hot.accept()');
        expect(result!.code).toContain(COMPONENT_MODULE);
        // The definition scope closes after the module body, before accept.
        const clearAt = result!.code.indexOf(`__sigxClearHMRModule('/app/src/Label.tsx')`);
        expect(clearAt).toBeGreaterThan(result!.code.indexOf('component('));
        expect(clearAt).toBeLessThan(result!.code.indexOf('import.meta.hot.accept()'));
    });

    it('registers mount modules without a self-accept', () => {
        const result = transform(makePlugin(), MOUNT_MODULE, '/app/src/main.tsx');
        expect(result).not.toBeNull();
        expect(result!.code).toContain(`__sigxRegisterHMRModule('/app/src/main.tsx')`);
        expect(result!.code).toContain(`__sigxClearHMRModule('/app/src/main.tsx')`);
        expect(result!.code).not.toContain('import.meta.hot.accept()');
    });

    it('normalizes windows paths in the module id', () => {
        const result = transform(makePlugin(), COMPONENT_MODULE, 'C:\\app\\src\\Label.tsx');
        expect(result!.code).toContain(`__sigxRegisterHMRModule('C:/app/src/Label.tsx')`);
    });

    it('injects absolute runtime paths as /@fs/ specifiers, bare specifiers as-is', () => {
        const winPlugin = terminalDevPlugin({ hmrRuntime: 'C:\\pkg\\dist\\hmr.js' });
        (winPlugin.config as any)({}, { command: 'serve', mode: 'development' });
        expect(transform(winPlugin, COMPONENT_MODULE, '/app/src/Label.tsx')!.code)
            .toContain(`from '/@fs/C:/pkg/dist/hmr.js'`);

        const posixPlugin = terminalDevPlugin({ hmrRuntime: '/pkg/dist/hmr.js' });
        (posixPlugin.config as any)({}, { command: 'serve', mode: 'development' });
        expect(transform(posixPlugin, COMPONENT_MODULE, '/app/src/Label.tsx')!.code)
            .toContain(`from '/@fs/pkg/dist/hmr.js'`);

        const barePlugin = terminalDevPlugin({ hmrRuntime: '@sigx/terminal-dev/hmr' });
        (barePlugin.config as any)({}, { command: 'serve', mode: 'development' });
        expect(transform(barePlugin, COMPONENT_MODULE, '/app/src/Label.tsx')!.code)
            .toContain(`from '@sigx/terminal-dev/hmr'`);
    });

    it('leaves modules without components untouched', () => {
        expect(transform(makePlugin(), `export const n = 1;`, '/app/src/util.ts')).toBeNull();
    });

    it('skips node_modules and dist files', () => {
        expect(transform(makePlugin(), COMPONENT_MODULE, '/app/node_modules/x/index.ts')).toBeNull();
        expect(transform(makePlugin(), COMPONENT_MODULE, '/app/dist/Label.js')).toBeNull();
    });

    it('skips non-script files', () => {
        expect(transform(makePlugin(), COMPONENT_MODULE, '/app/src/notes.md')).toBeNull();
    });

    it('does nothing in build mode', () => {
        expect(transform(makePlugin('build'), COMPONENT_MODULE, '/app/src/Label.tsx')).toBeNull();
    });

    it('externalizes the sigx packages for SSR in serve mode', () => {
        const plugin = terminalDevPlugin({ external: ['extra-pkg'] });
        const config = (plugin.config as any)({}, { command: 'serve', mode: 'development' });
        expect(config.ssr.external).toContain('@sigx/runtime-terminal');
        expect(config.ssr.external).toContain('@sigx/reactivity');
        expect(config.ssr.external).toContain('extra-pkg');
    });
});
