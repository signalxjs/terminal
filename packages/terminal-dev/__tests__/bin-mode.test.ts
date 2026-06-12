/**
 * Regression guard for issue #56: the bin shim must be committed executable
 * (git mode 100755). Files created on Windows default to 100644; on Linux,
 * `pnpm install` chmods declared bins to 755 when linking them, which makes
 * git report a permanently dirty tree — the release workflow's clean-tree
 * guard then blocks every publish.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('declared bins are committed executable', () => {
    const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    const bins: string[] = Object.values(pkg.bin ?? {});

    it('has at least one bin to guard', () => {
        expect(bins.length).toBeGreaterThan(0);
    });

    for (const bin of bins) {
        it(`${bin} has git mode 100755`, () => {
            const staged = execFileSync('git', ['ls-files', '--stage', '--', bin], {
                cwd: pkgDir,
                encoding: 'utf8',
            }).trim();
            expect(staged, `bin file not tracked: ${bin}`).not.toBe('');
            const mode = staged.split(/\s+/)[0];
            expect(mode, 'commit with git update-index --chmod=+x').toBe('100755');
        });
    }
});
