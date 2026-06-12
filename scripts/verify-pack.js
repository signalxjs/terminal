#!/usr/bin/env node

/**
 * @sigx/terminal - Pre-publish pack smoke test
 *
 * Catches packaging bugs that lint/typecheck/test miss:
 *   - missing files in `files` array
 *   - broken `exports` map (especially the `./jsx-runtime` subpath)
 *   - unresolved `workspace:^` ranges
 *   - dist/ produced by stale builds
 *
 * What it does:
 *   1. Build both publishable packages.
 *   2. `pnpm pack` each into a temp dir.
 *   3. Spin up a minimal scratch project with `file:` deps to those tarballs.
 *   4. Build a small TSX program with `tsc` using
 *      `jsxImportSource: "@sigx/terminal"` to prove the published shape works
 *      end-to-end (incl. the jsx-runtime subpath and bundled .d.ts files).
 *
 * Usage:
 *   node scripts/verify-pack.js
 *
 * No flags. Exits non-zero on any failure.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const PACKAGES = [
    'packages/args',
    'packages/runtime-terminal',
    'packages/terminal-zero',
    'packages/terminal-ui',
    'packages/terminal',
    'packages/terminal-dev',
];

const sandbox = join(tmpdir(), `sigx-terminal-verify-pack-${Date.now()}`);
const tarballDir = join(sandbox, 'tarballs');
const appDir = join(sandbox, 'app');

function run(cmd, opts = {}) {
    console.log(`$ ${cmd}${opts.cwd ? `  (in ${opts.cwd})` : ''}`);
    execSync(cmd, { stdio: 'inherit', ...opts });
}

function step(label) {
    console.log(`\n▶  ${label}`);
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf-8'));
}

function packPackage(pkgPath) {
    const pkgFullPath = join(rootDir, pkgPath);
    const pkgJson = readJson(join(pkgFullPath, 'package.json'));
    run('pnpm pack --pack-destination ' + JSON.stringify(tarballDir), { cwd: pkgFullPath });
    const tarballs = readdirSync(tarballDir).filter((f) => f.endsWith('.tgz'));
    const safeName = pkgJson.name.replace('@', '').replace('/', '-');
    const match = tarballs.find((f) => f.startsWith(safeName));
    if (!match) {
        throw new Error(`Could not find tarball for ${pkgJson.name} in ${tarballDir}`);
    }
    return { name: pkgJson.name, version: pkgJson.version, tarball: join(tarballDir, match) };
}

function main() {
    step(`Sandbox: ${sandbox}`);
    mkdirSync(tarballDir, { recursive: true });
    mkdirSync(appDir, { recursive: true });

    step('Build all packages');
    run('pnpm run build', { cwd: rootDir });

    step('Pack each publishable package');
    const packed = PACKAGES.map(packPackage);
    for (const p of packed) {
        console.log(`   📦 ${p.name}@${p.version}  →  ${p.tarball}`);
    }

    step('Create scratch app');
    const deps = Object.fromEntries(
        packed.map((p) => [p.name, `file:${p.tarball.replace(/\\/g, '/')}`])
    );
    const rootPkg = readJson(join(rootDir, 'package.json'));
    const appPkg = {
        name: 'sigx-terminal-pack-smoke',
        version: '0.0.0',
        private: true,
        type: 'module',
        scripts: { build: 'tsc -p .' },
        dependencies: deps,
        devDependencies: {
            typescript: rootPkg.devDependencies.typescript,
            '@types/node': rootPkg.devDependencies['@types/node'],
        },
    };
    writeFileSync(join(appDir, 'package.json'), JSON.stringify(appPkg, null, 2));

    writeFileSync(
        join(appDir, 'tsconfig.json'),
        JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2022',
                    module: 'ESNext',
                    moduleResolution: 'Bundler',
                    jsx: 'react-jsx',
                    jsxImportSource: '@sigx/terminal',
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    noEmit: true,
                    types: ['node'],
                },
                include: ['src'],
            },
            null,
            2
        )
    );

    mkdirSync(join(appDir, 'src'), { recursive: true });

    // Exercise the public surface: reactivity re-export, runtime-core re-export,
    // runtime-terminal components, and TSX through `jsxImportSource`.
    writeFileSync(
        join(appDir, 'src', 'main.tsx'),
        [
            "import { signal, component, defineApp, Button } from '@sigx/terminal';",
            '',
            'const App = component(() => {',
            '    const count = signal(0);',
            '    return () => (',
            '        <box>',
            '            <text>Count: {count.value}</text>',
            '            <Button label="Increment" onPress={() => { count.value++; }} />',
            '        </box>',
            '    );',
            '});',
            '',
            'export const app = defineApp(<App />);',
            '',
        ].join('\n')
    );

    // Direct imports of each layer as separately-published units: the
    // renderer's device APIs, zero's theme engine, and the ui skin's
    // components (which moved out of runtime-terminal in the zero+skin split).
    writeFileSync(
        join(appDir, 'src', 'runtime-check.ts'),
        [
            "import { renderTerminal, writeStatic, setOutputTarget } from '@sigx/runtime-terminal';",
            "import { resolveColor, setTheme, GLYPHS } from '@sigx/terminal-zero';",
            "import { Input, Select, Checkbox, ProgressBar, Spinner, TaskList, LogPanel, Gradient, createLogStore } from '@sigx/terminal-ui';",
            'export type _Renderer = [typeof renderTerminal, typeof writeStatic, typeof setOutputTarget];',
            'export type _Zero = [typeof resolveColor, typeof setTheme, typeof GLYPHS];',
            'export type _Components = [typeof Input, typeof Select, typeof Checkbox, typeof ProgressBar, typeof Spinner, typeof TaskList, typeof LogPanel, typeof Gradient, typeof createLogStore];',
            '',
        ].join('\n')
    );

    // The dev tooling package: the Vite plugin, dev runner and HMR runtime
    // (incl. the ./hmr subpath export) as published units.
    writeFileSync(
        join(appDir, 'src', 'dev-check.ts'),
        [
            "import { startDev, terminalDevPlugin } from '@sigx/terminal-dev';",
            "import { registerHMRModule, installHMRPlugin } from '@sigx/terminal-dev/hmr';",
            'export type _Dev = [typeof startDev, typeof terminalDevPlugin, typeof registerHMRModule, typeof installHMRPlugin];',
            '',
        ].join('\n')
    );

    // The args package: command definition, parsing, and the help catalog as a
    // published unit (zero-dependency, platform-neutral).
    writeFileSync(
        join(appDir, 'src', 'args-check.ts'),
        [
            "import { a, command, runMain, parseArgs, buildHelpCatalog, renderHelp, ParseError } from '@sigx/args';",
            'export type _Args = [typeof a, typeof command, typeof runMain, typeof parseArgs, typeof buildHelpCatalog, typeof renderHelp, typeof ParseError];',
            '',
        ].join('\n')
    );

    step('Install scratch app (npm — to avoid pnpm workspace hoisting interference)');
    run('npm install --no-audit --no-fund --loglevel=error', { cwd: appDir });

    step('Typecheck scratch app against the packed tarballs');
    run('npm run build', { cwd: appDir });

    step('✅ Pack smoke test passed');
}

try {
    main();
} catch (err) {
    console.error('\n❌ Pack smoke test failed:', err.message);
    console.error(`   Sandbox preserved for inspection: ${sandbox}`);
    process.exitCode = 1;
    process.exit(1);
}

try {
    rmSync(sandbox, { recursive: true, force: true });
} catch {
    // ignore
}
