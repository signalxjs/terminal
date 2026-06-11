import { defineLibConfig } from '@sigx/vite/lib';

export default defineLibConfig({
    entry: {
        index: 'src/index.ts',
        hmr: 'src/hmr.ts',
        cli: 'src/cli.ts',
    },
    external: [/@sigx\/.*/, /^node:/, 'vite'],
    platform: 'node',
});
