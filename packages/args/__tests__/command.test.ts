import { describe, expect, it } from 'vitest';
import { a, command, DefinitionError, ParseError, resolveCommand, type ArgsShape } from '../src/index';

describe('command builder', () => {
    it('sets the description via describe()', () => {
        const cmd = command('build').describe('Build it').run(() => {});
        expect(cmd['~cmd'].meta.description).toBe('Build it');
    });

    it('refines immutably — chained calls do not mutate earlier builders', () => {
        const base = command('x');
        const described = base.describe('described');
        expect(base['~cmd'].meta.description).toBeUndefined();
        expect(described['~cmd'].meta.description).toBe('described');
    });

    it('rejects a second args() call', () => {
        expect(() =>
            command('x')
                .args({ port: a.number() })
                .args({ host: a.string() })
        ).toThrow(DefinitionError);
    });

    it.each([
        ['required positional after optional', { a: a.positional(), b: a.positional().required() }],
        ['positional after rest', { files: a.rest(), entry: a.positional() }],
        ['two rest args', { a: a.rest(), b: a.rest() }],
        ['alias collision', { port: a.number().alias('p'), print: a.boolean().alias('p') }],
        ['kebab/camel alias collision', { a: a.boolean().alias('dryRun'), b: a.boolean().alias('dry-run') }],
        ['alias with a leading dash', { port: a.number().alias('-p') }],
        ['kebab/camel key collision', { dryRun: a.boolean(), 'dry-run': a.boolean() }],
        ['reserved key _', { _: a.string() }],
        ['flag named help', { help: a.boolean() }],
        ['h alias (reserved for the builtin -h)', { host: a.string().alias('h') }]
    ] as [string, ArgsShape][])('rejects %s', (_label, shape) => {
        expect(() => command('x').args(shape)).toThrow(DefinitionError);
    });

    it('reserves version only when version() is set, in either order', () => {
        expect(() => command('x').version('1.0.0').args({ version: a.boolean() })).toThrow(DefinitionError);
        expect(() => command('x').args({ version: a.boolean() }).version('1.0.0')).toThrow(DefinitionError);
        expect(() => command('x').args({ version: a.boolean() })).not.toThrow();
    });
});

describe('resolveCommand', () => {
    const build = command('build').describe('build').run(() => {});
    const add = command('add').describe('add').run(() => {});
    const pkg = command('pkg').describe('pkg group').subcommands({ add });
    const root = command('sigx')
        .subcommands({ build, pkg })
        .run(() => {});

    it('resolves nested subcommands and builds the path', () => {
        const resolved = resolveCommand(root, ['pkg', 'add', '--verbose']);
        expect(resolved.cmd).toBe(add);
        expect(resolved.path).toEqual(['sigx', 'pkg', 'add']);
        expect(resolved.rest).toEqual(['--verbose']);
    });

    it('matches aliases()', () => {
        const b = command('build').aliases('b').run(() => {});
        const r = command('x').subcommands({ build: b });
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
