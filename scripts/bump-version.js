import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const packagesDir = join(repoRoot, 'packages');

// SemVer 2.0.0 (the regex from semver.org, no leading zeros in numeric identifiers):
// X.Y.Z with an optional -prerelease and +build — written verbatim into every package.json.
const SEMVER =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const USAGE = `Usage: node scripts/bump-version.js [patch|minor|major|<version>] [--force]

  patch | minor | major   bump every publishable package (default: patch)
  <version>               set every publishable package to an exact SemVer version
                          (X.Y.Z, optionally -prerelease / +build, e.g. 1.0.0-rc.0)
  --force                 bump even if the packages disagree on a version
  -h, --help              print this help and exit — changes nothing`;

// Read-only on anything unrecognised (#132): `--help` used to fall through to a
// real patch bump, and so did any typo, via bumpVersion()'s `default:` branch.
const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
}
const force = argv.includes('--force');
const args = argv.filter((a) => a !== '--force');
const unknown = args.filter((a) => !['patch', 'minor', 'major'].includes(a) && !SEMVER.test(a));
if (unknown.length || args.length > 1) {
    console.error(
        `❌ ${unknown.length ? `Unknown argument(s): ${unknown.join(' ')}` : `Expected one bump type or version, got: ${args.join(' ')}`}\n\n${USAGE}`,
    );
    process.exit(1);
}
const arg = args[0] || 'patch';

// Check if arg is a version number (e.g., "0.2.0") or bump type
const isExactVersion = SEMVER.test(arg);
const bumpType = isExactVersion ? null : arg;
const exactVersion = isExactVersion ? arg : null;

function bumpVersion(version, type) {
    const parts = version.split('.').map(Number);
    switch (type) {
        case 'major':
            return `${parts[0] + 1}.0.0`;
        case 'minor':
            return `${parts[0]}.${parts[1] + 1}.0`;
        case 'patch':
        default:
            return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    }
}

// Lockstep guard (same model as sigx core/lynx): all publishable packages must
// agree on a version BEFORE a relative bump — otherwise `patch` would fan the
// divergence out instead of fixing it. An exact target is exempt (that's how
// you re-unify); --force overrides.
function assertLockstep() {
    const versions = new Map();
    const errors = [];
    for (const entry of readdirSync(packagesDir)) {
        const dir = join(packagesDir, entry);
        if (!statSync(dir).isDirectory()) continue;
        const pkgPath = join(dir, 'package.json');
        const rel = relative(repoRoot, pkgPath);
        let pkg;
        try {
            pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        } catch (err) {
            errors.push(`  ${rel}: ${err.code === 'ENOENT' ? 'missing package.json' : `unreadable / invalid JSON (${err.message})`}`);
            continue;
        }
        if (pkg.private) continue;
        if (!pkg.version) {
            errors.push(`  ${rel}: non-private package is missing "version"`);
            continue;
        }
        if (!versions.has(pkg.version)) versions.set(pkg.version, []);
        versions.get(pkg.version).push(pkg.name);
    }
    if (errors.length) {
        console.error('❌ Cannot bump — broken package(s):\n');
        for (const e of errors) console.error(e);
        console.error('\nFix the offending package(s) and re-run, or pass --force to override.');
        process.exit(1);
    }
    if (versions.size <= 1) return;
    console.error('❌ Lockstep violation: publishable packages disagree on version.\n');
    const sorted = [...versions.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [version, names] of sorted) {
        console.error(`  ${version}  (${names.length})`);
        for (const name of names.sort()) console.error(`    - ${name}`);
    }
    console.error(
        '\nRun `pnpm version:set <X.Y.Z>` to re-unify before bumping, or pass --force to bump anyway.',
    );
    process.exit(1);
}

function processPackages(dir) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            const pkgPath = join(fullPath, 'package.json');
            try {
                const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
                if (pkg.private) {
                    console.log(`Skipping private package: ${pkg.name}`);
                    continue;
                }
                const oldVersion = pkg.version;
                const newVersion = exactVersion || bumpVersion(oldVersion, bumpType);
                pkg.version = newVersion;
                writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
                console.log(`${pkg.name}: ${oldVersion} → ${newVersion}`);
            } catch (e) {
                // No package.json, skip
            }
        }
    }
}

if (!force && !exactVersion) {
    assertLockstep();
}

if (exactVersion) {
    console.log(`Setting all packages to version ${exactVersion}...\n`);
} else {
    console.log(`Bumping ${bumpType} version for packages...\n`);
}
processPackages(packagesDir);
console.log('\nDone!');
