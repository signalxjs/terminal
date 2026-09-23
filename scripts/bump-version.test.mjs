// bump-version.js must never bump on a flag it does not understand (#132).
// Each case runs a COPY of the script against a scratch packages/ tree, so a
// regression cannot bump this repo's real manifests.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = join(dirname(fileURLToPath(import.meta.url)), 'bump-version.js');

let root;
const pkgPath = () => join(root, 'packages', 'a', 'package.json');
const version = () => JSON.parse(readFileSync(pkgPath(), 'utf-8')).version;

function run(...args) {
    return spawnSync(process.execPath, [join(root, 'scripts', 'bump-version.js'), ...args], {
        encoding: 'utf-8',
    });
}

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bump-version-'));
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'packages', 'a'), { recursive: true });
    copyFileSync(script, join(root, 'scripts', 'bump-version.js'));
    writeFileSync(pkgPath(), JSON.stringify({ name: '@x/a', version: '1.2.3' }, null, 4) + '\n');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('bump-version.js', () => {
    it.each(['--help', '-h'])('%s prints usage, exits 0 and bumps nothing', (flag) => {
        const r = run(flag);
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/Usage:/);
        expect(version()).toBe('1.2.3');
    });

    it.each([['--bogus'], ['minr'], ['patch', '--dry']])('rejects %s without bumping', (...args) => {
        const r = run(...args);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/Usage:/);
        expect(version()).toBe('1.2.3');
    });

    it.each([
        ['patch', '1.2.4'],
        ['minor', '1.3.0'],
        ['major', '2.0.0'],
        ['4.5.6', '4.5.6'],
    ])('%s still bumps to %s', (arg, expected) => {
        const r = run(arg);
        expect(r.status).toBe(0);
        expect(version()).toBe(expected);
    });
});
