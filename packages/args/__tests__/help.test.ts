import { describe, expect, it } from 'vitest';
import { buildHelpCatalog, defineCommand, renderHelp } from '../src/index';

const dev = defineCommand({
    meta: { name: 'sigx', version: '0.5.1', description: 'Start the dev server' },
    args: {
        entry: { type: 'positional', required: true, description: 'Entry file' },
        files: { type: 'rest', description: 'Additional files' },
        port: { type: 'number', alias: 'p', required: true, valueHint: 'n', description: 'Port to listen on' },
        host: { type: 'string', default: 'localhost', description: 'Host name' },
        mode: { type: 'enum', options: ['dev', 'prod'], description: 'Build mode' },
        secret: { type: 'string', hidden: true }
    },
    subCommands: {
        build: defineCommand({ meta: { aliases: ['b'], description: 'Build the project' }, run() {} }),
        internal: defineCommand({ meta: { hidden: true }, run() {} })
    },
    run() {}
});

describe('buildHelpCatalog', () => {
    const catalog = buildHelpCatalog(dev, ['sigx', 'dev']);

    it('captures path, version, description, and default-run', () => {
        expect(catalog.path).toEqual(['sigx', 'dev']);
        expect(catalog.version).toBe('0.5.1');
        expect(catalog.description).toBe('Start the dev server');
        expect(catalog.hasDefaultRun).toBe(true);
    });

    it('splits flags from positionals in declaration order', () => {
        expect(catalog.positionals.map((p) => p.name)).toEqual(['entry', 'files']);
        expect(catalog.positionals[1]).toMatchObject({ kind: 'rest', multiple: true });
        expect(catalog.flags.map((f) => f.name)).toEqual(['port', 'host', 'mode', 'secret', 'help']);
    });

    it('captures arg facts a themed renderer needs', () => {
        const port = catalog.flags[0];
        expect(port).toMatchObject({ type: 'number', aliases: ['p'], required: true, valueHint: 'n' });
        expect(catalog.flags[1]).toMatchObject({ default: 'localhost' });
        expect(catalog.flags[2]).toMatchObject({ type: 'enum', options: ['dev', 'prod'] });
        expect(catalog.flags[3]).toMatchObject({ hidden: true });
    });

    it('synthesizes builtin --help everywhere, --version only at the root', () => {
        // Root catalog (default path, length 1) advertises --version…
        const root = buildHelpCatalog(dev);
        expect(root.flags.filter((f) => f.builtin).map((f) => f.name)).toEqual(['help', 'version']);
        // …but a subcommand catalog does not — runMain only intercepts it at the root.
        expect(catalog.flags.filter((f) => f.builtin).map((f) => f.name)).toEqual(['help']);
        // No meta.version → no version entry even at the root
        const plain = buildHelpCatalog(defineCommand({ run() {} }));
        expect(plain.flags.filter((f) => f.builtin).map((f) => f.name)).toEqual(['help']);
    });

    it('lists subcommands with aliases and hidden flags', () => {
        expect(catalog.subCommands).toEqual([
            { name: 'build', aliases: ['b'], description: 'Build the project', hidden: false },
            { name: 'internal', aliases: [], hidden: true }
        ]);
    });
});

describe('renderHelp', () => {
    const text = renderHelp(buildHelpCatalog(dev, ['sigx', 'dev']));
    const lines = text.split('\n');

    it('renders the header with description and version', () => {
        expect(lines[0]).toBe('sigx dev — Start the dev server (v0.5.1)');
    });

    it('renders both usage lines for a runnable command with subcommands', () => {
        expect(text).toContain('  sigx dev [options] <entry> [files...]');
        expect(text).toContain('  sigx dev <command> [options]');
    });

    it('renders aligned options with hints, required, and defaults', () => {
        expect(text).toContain('-p, --port <n>');
        expect(text).toContain('Port to listen on (required)');
        expect(text).toContain('--host <host>');
        expect(text).toContain('Host name (default: "localhost")');
        expect(text).toContain('--mode <dev|prod>');
        expect(text).toContain('-h, --help');
    });

    it('lists long aliases alongside the canonical flag name', () => {
        const cmd = defineCommand({
            args: { force: { type: 'boolean', alias: ['f', 'hard'] } },
            run() {}
        });
        const rendered = renderHelp(buildHelpCatalog(cmd, ['x']));
        expect(rendered).toContain('-f, --force, --hard');
    });

    it('omits hidden entries', () => {
        expect(text).not.toContain('secret');
        expect(text).not.toContain('internal');
    });

    it('lists subcommands with aliases and the trailing hint', () => {
        expect(text).toContain('build, b');
        expect(text).toContain("Run 'sigx dev <command> --help' for details on a command.");
    });

    it('wraps long descriptions at the given width with hanging indent', () => {
        const wordy = defineCommand({
            args: {
                opt: {
                    type: 'string',
                    description: 'a very long description that definitely needs to wrap onto multiple lines'
                }
            },
            run() {}
        });
        const narrow = renderHelp(buildHelpCatalog(wordy, ['x']), { width: 40 });
        const optLines = narrow.split('\n').filter((l) => l.includes('wrap') || l.includes('description'));
        expect(optLines.length).toBeGreaterThan(1);
        // Continuation lines indent past the left column
        const cont = narrow.split('\n').find((l) => /^\s+\S/.test(l) && !l.trimStart().startsWith('-') && l.includes('lines'));
        expect(cont).toBeDefined();
    });

    it('omits the command line and hint for leaf commands', () => {
        const leaf = renderHelp(buildHelpCatalog(defineCommand({ run() {} }), ['x', 'leaf']));
        expect(leaf).not.toContain('<command>');
        expect(leaf).not.toContain('COMMANDS');
    });
});
