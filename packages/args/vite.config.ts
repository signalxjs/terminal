import { defineLibConfig } from '@sigx/vite/lib';

// Platform-neutral: argv parsing has no Node dependency — the only `process`
// touchpoint (in run.ts) is guarded, with no `node:` imports anywhere.
export default defineLibConfig({
    entry: {
        index: 'src/index.ts'
    },
    external: [/@sigx\/.*/],
    platform: 'neutral'
});
