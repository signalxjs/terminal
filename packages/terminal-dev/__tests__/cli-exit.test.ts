/**
 * Exit-code semantics of the `sigx-terminal-dev` bin (issue #48): under raw
 * mode, Ctrl+C never reaches the process group as SIGINT — the renderer reads
 * it as a key and calls `process.exit(130)`. For a dev session that's the
 * NORMAL way to quit, so the CLI must end 0 (or pnpm prints ELIFECYCLE noise);
 * real failures must keep their codes.
 *
 * Spawns the built CLI (dist/cli.js — built before tests, like the other
 * workspace-dist suites) on fixtures that exit with a given code after start.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.join(here, '..');
const cliPath = path.join(pkgDir, 'dist', 'cli.js');

// Self-contained on a clean checkout: build this package's dist once if a
// prior `pnpm build` hasn't (CI always has; locally it may not).
beforeAll(() => {
    if (!existsSync(cliPath)) {
        execSync('pnpm run build', { cwd: pkgDir, stdio: 'ignore' });
    }
});

function runCli(root: string): Promise<number | null> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cliPath, 'src/main.ts', '--root', root], {
            stdio: ['ignore', 'ignore', 'pipe'],
        });
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error('dev CLI did not exit within 20s'));
        }, 20_000);
        child.on('exit', (code) => {
            clearTimeout(timer);
            resolve(code);
        });
        child.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

describe('sigx-terminal-dev exit codes', () => {
    let dir: string;

    beforeEach(() => {
        dir = path.join(here, '.tmp', `cli-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
        mkdirSync(path.join(dir, 'src'), { recursive: true });
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    function writeEntry(exitCode: number | string): void {
        writeFileSync(path.join(dir, 'src', 'main.ts'), `
setTimeout(() => process.exit(${JSON.stringify(exitCode)}), 200);
export {};
`);
    }

    it('treats the app quitting via Ctrl+C (exit 130) as a clean end of the dev session', async () => {
        writeEntry(130);
        expect(await runCli(dir)).toBe(0);
    }, 30_000);

    it("translates node's string form of the code ('130') too", async () => {
        writeEntry('130');
        expect(await runCli(dir)).toBe(0);
    }, 30_000);

    it('does not mask real failures', async () => {
        writeEntry(1);
        expect(await runCli(dir)).toBe(1);
    }, 30_000);
});
