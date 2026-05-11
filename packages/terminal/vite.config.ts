import { defineLibConfig } from '@sigx/vite/lib';

export default defineLibConfig({
    entry: 'src/index.ts',
    external: [/@sigx\/.*/, 'node:process', 'node:readline', 'node:tty'],
    platform: 'node'
});
