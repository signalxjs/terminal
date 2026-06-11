import { defineLibConfig } from '@sigx/vite/lib';

// Design-system skin: subpath entries mirror the package `exports` map for
// tree-shaking (e.g. `import { Button } from '@sigx/terminal-ui/buttons'`).
export default defineLibConfig({
    entry: {
        'index': 'src/index.ts',
        'theme/index': 'src/theme/index.ts',
        'buttons/index': 'src/buttons/index.ts',
        'forms/index': 'src/forms/index.ts',
        'feedback/index': 'src/feedback/index.ts',
        'navigation/index': 'src/navigation/index.ts',
        'layout/index': 'src/layout/index.ts',
        'data/index': 'src/data/index.ts',
        'fx/index': 'src/fx/index.ts',
        'tasks/index': 'src/tasks/index.ts',
        'prompts/index': 'src/prompts/index.ts'
    },
    external: [/@sigx\/.*/, /^node:/],
    platform: 'node',
    jsx: true
});
