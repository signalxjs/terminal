import { describe, expect, it } from 'vitest';
import { DefinitionError, ParseError, defineCommand, resolveCommand } from '../src/index';

describe('defineCommand', () => {
    it('folds the description shorthand into meta', () => {
        const cmd = defineCommand({ description: 'Build it', run() {} });
        expect(cmd.meta.description).toBe('Build it');
    });

    it('keeps an explicit meta.description over the shorthand', () => {
        const cmd = defineCommand({ meta: { description: 'meta wins' }, description: 'shorthand' });
        expect(cmd.meta.description).toBe('meta wins');
    });

    it('accepts a PluginCommand-shaped definition (citty-swap compatibility)', () => {
        // Mirrors @sigx/cli's PluginCommand: description + minimal string/boolean args.
        const cmd = defineCommand({
            description: 'Start SSG development server',
            args: {
                config: { type: 'string', description: 'Path to ssg.config.ts' },
                host: { type: 'boolean', description: 'Expose to network' }
            },
            async run() {}
        });
        expect(cmd.meta.description).toBe('Start SSG development server');
    });

    it.each([
        ['required positional after optional', { a: { type: 'positional' }, b: { type: 'positional', required: true } }],
        ['positional after rest', { files: { type: 'rest' }, entry: { type: 'positional' } }],
        ['two rest args', { a: { type: 'rest' }, b: { type: 'rest' } }],
        ['required with default', { port: { type: 'number', required: true, default: 1 } }],
        ['enum default outside options', { mode: { type: 'enum', options: ['a'], default: 'b' } }],
        ['alias collision', { port: { type: 'number', alias: 'p' }, print: { type: 'boolean', alias: 'p' } }],
        ['kebab/camel alias collision', { a: { type: 'boolean', alias: 'dryRun' }, b: { type: 'boolean', alias: 'dry-run' } }],
        ['alias with a leading dash', { port: { type: 'number', alias: '-p' } }],
        ['kebab/camel key collision', { dryRun: { type: 'boolean' }, 'dry-run': { type: 'boolean' } }],
        ['reserved key _', { _: { type: 'string' } }],
        ['flag named help', { help: { type: 'boolean' } }],
        ['h alias (reserved for the builtin -h)', { host: { type: 'string', alias: 'h' } }]
    ] as const)('rejects %s', (_label, args) => {
        expect(() => defineCommand({ args: args as never })).toThrow(DefinitionError);
    });

    it('reserves version only when meta.version is set', () => {
        expect(() =>
            defineCommand({ meta: { version: '1.0.0' }, args: { version: { type: 'boolean' } } })
        ).toThrow(DefinitionError);
        expect(() => defineCommand({ args: { version: { type: 'boolean' } } })).not.toThrow();
    });
});

describe('resolveCommand', () => {
    const build = defineCommand({ description: 'build', run() {} });
    const add = defineCommand({ description: 'add', run() {} });
    const pkg = defineCommand({ description: 'pkg group', subCommands: { add } });
    const root = defineCommand({
        meta: { name: 'sigx' },
        subCommands: { build, pkg },
        run() {}
    });

    it('resolves nested subcommands and builds the path', () => {
        const resolved = resolveCommand(root, ['pkg', 'add', '--verbose']);
        expect(resolved.cmd).toBe(add);
        expect(resolved.path).toEqual(['sigx', 'pkg', 'add']);
        expect(resolved.rest).toEqual(['--verbose']);
    });

    it('matches meta.aliases', () => {
        const b = defineCommand({ meta: { aliases: ['b'] }, run() {} });
        const r = defineCommand({ meta: { name: 'x' }, subCommands: { build: b } });
        expect(resolveCommand(r, ['b']).cmd).toBe(b);
        expect(resolveCommand(r, ['b']).path).toEqual(['x', 'build']);
    });

    it('falls back to the default run for unmatched tokens', () => {
        const resolved = resolveCommand(root, ['main.ts']);
        expect(resolved.cmd).toBe(root);
        expect(resolved.rest).toEqual(['main.ts']);
    });

    it('throws UNKNOWN_COMMAND when a group has no default run', () => {
        let caught: unknown;
        try {
            resolveCommand(pkg, ['nope']);
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(ParseError);
        expect((caught as ParseError).code).toBe('UNKNOWN_COMMAND');
        expect((caught as ParseError).detail.received).toBe('nope');
    });

    it('stops descending at the first flag token', () => {
        const resolved = resolveCommand(root, ['--help', 'build']);
        expect(resolved.cmd).toBe(root);
    });
});
