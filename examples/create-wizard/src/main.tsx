/** @jsxImportSource @sigx/runtime-core */
// The imperative prompt kit, end to end — a `sigx create`-style wizard:
//
//     node --import tsx src/main.tsx          # interactive: type, arrow, space, enter
//     node --import tsx src/main.tsx | cat    # non-TTY: every prompt falls back to its
//                                             # initial value and prints the transcript
//
// Esc or Ctrl+C at any prompt cancels gracefully (■ line, exit 130). Answered
// prompts collapse into permanent ◇ lines — the finished wizard reads as a
// tidy transcript in scrollback.
import {
    intro, outro, note, cancel, isCancel,
    text, select, multiselect, confirm, spinner,
} from '@sigx/terminal';

function bail(): never {
    cancel('Cancelled — nothing was created.');
    process.exit(130);
}

const name = 'create-wizard demo';

async function main() {
    intro(name);

    const projectName = await text({
        message: 'Project name',
        placeholder: 'my-sigx-app',
        initialValue: 'my-sigx-app',
        validate: (v) => (/^[a-z0-9-]+$/.test(v) ? undefined : 'lowercase letters, digits, and dashes only'),
    });
    if (isCancel(projectName)) bail();

    const projectType = await select({
        message: 'Project type',
        initialValue: 'basic',
        options: [
            { value: 'basic', label: 'Basic SPA', description: 'single-page web app' },
            { value: 'ssr', label: 'SSR', description: 'server-side rendering with Express' },
            { value: 'ssg', label: 'SSG', description: 'static site, file routing, MDX' },
            { value: 'lynx', label: 'Lynx', description: 'native mobile app' },
        ],
    });
    if (isCancel(projectType)) bail();

    const features = await multiselect({
        message: 'Features',
        initialValues: ['vitest'],
        options: [
            { value: 'vitest', label: 'Vitest', description: 'unit testing' },
            { value: 'eslint', label: 'oxlint', description: 'linting' },
            { value: 'tailwind', label: 'Tailwind CSS' },
            { value: 'router', label: 'File router' },
        ],
    });
    if (isCancel(features)) bail();

    const git = await confirm({ message: 'Initialize a git repository?', initialValue: true });
    if (isCancel(git)) bail();

    const s = spinner();
    s.start(`Scaffolding ${projectName}`);
    await sleep(900);
    s.message('Writing template files');
    await sleep(700);
    if (git) {
        s.message('Initializing git');
        await sleep(400);
    }
    s.stop(`Scaffolded ${projectName} (${projectType}${features.length ? ` + ${features.join(', ')}` : ''})`);

    note(`cd ${projectName}\npnpm install\npnpm dev`, 'Next steps');
    outro('Happy hacking!');
    process.exit(0);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
    cancel(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
