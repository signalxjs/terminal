import { defineLibConfig } from '@sigx/vite/lib';

// Headless foundation: subpath entries mirror the package `exports` map so
// consumers can `import { ... } from '@sigx/terminal-zero/theme'` and tree-shake.
export default defineLibConfig({
    entry: {
        'index': 'src/index.ts',
        'contract': 'src/contract.ts',
        'theme/index': 'src/theme/index.ts',
        'shared/index': 'src/shared/index.ts',
        'layout/index': 'src/layout/index.ts',
        'prompts/index': 'src/prompts/index.ts'
    },
    external: [/@sigx\/.*/, /^node:/],
    platform: 'node',
    jsx: true
});
