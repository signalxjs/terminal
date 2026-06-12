import { describe, expect, it } from 'vitest';
import { a, DefinitionError, ParseError, parseArgs } from '../src/index';

function parseError(fn: () => unknown): ParseError {
    try {
        fn();
    } catch (error) {
        expect(error).toBeInstanceOf(ParseError);
        return error as ParseError;
    }
    throw new Error('expected a ParseError');
}

describe('flag forms', () => {
    it('parses --flag value and --flag=value', () => {
        const shape = { port: a.number(), host: a.string() };
        expect(parseArgs(['--port', '3000'], shape).args.port).toBe(3000);
        expect(parseArgs(['--port=3000'], shape).args.port).toBe(3000);
        expect(parseArgs(['--host=a=b'], shape).args.host).toBe('a=b');
    });

    it('parses short flags with value or =', () => {
        const shape = { port: a.number().alias('p') };
        expect(parseArgs(['-p', '8080'], shape).args.port).toBe(8080);
        expect(parseArgs(['-p=8080'], shape).args.port).toBe(8080);
    });

    it('expands boolean short clusters', () => {
        const shape = {
            all: a.boolean().alias('a'),
            brief: a.boolean().alias('b'),
            count: a.number().alias('c')
        };
        const { args } = parseArgs(['-ab'], shape);
        expect(args.all).toBe(true);
        expect(args.brief).toBe(true);

        const err = parseError(() => parseArgs(['-ac'], shape));
        expect(err.code).toBe('UNKNOWN_FLAG');
        expect(err.message).toContain('boolean');
    });

    it('normalizes kebab and camel spellings both ways', () => {
        expect(parseArgs(['--dry-run'], { dryRun: a.boolean() }).args.dryRun).toBe(true);
        expect(parseArgs(['--dryRun'], { dryRun: a.boolean() }).args.dryRun).toBe(true);
        expect(parseArgs(['--dryRun'], { 'dry-run': a.boolean() }).args['dry-run']).toBe(true);
    });

    it('resolves long aliases', () => {
        const shape = { force: a.boolean().alias('hard') };
        expect(parseArgs(['--hard'], shape).args.force).toBe(true);
    });
});

describe('booleans', () => {
    it('never consumes the next token', () => {
        const shape = { open: a.boolean(), entry: a.positional() };
        const { args } = parseArgs(['--open', 'main.ts'], shape);
        expect(args.open).toBe(true);
        expect(args.entry).toBe('main.ts');
    });

    it('accepts explicit =true/false/1/0/yes/no', () => {
        const shape = { open: a.boolean() };
        expect(parseArgs(['--open=false'], shape).args.open).toBe(false);
        expect(parseArgs(['--open=YES'], shape).args.open).toBe(true);
        expect(parseArgs(['--open=0'], shape).args.open).toBe(false);
        const err = parseError(() => parseArgs(['--open=maybe'], shape));
        expect(err.code).toBe('INVALID_BOOLEAN');
        expect(err.detail).toMatchObject({ arg: 'open', received: 'maybe' });
    });

    it('negates with --no-x unless negatable(false)', () => {
        expect(parseArgs(['--no-color'], { color: a.boolean().default(true) }).args.color).toBe(false);
        const err = parseError(() => parseArgs(['--no-color'], { color: a.boolean().negatable(false) }));
        expect(err.code).toBe('UNKNOWN_FLAG');
    });

    it('prefers a literal no- key over negation', () => {
        const { args } = parseArgs(['--no-cache'], { noCache: a.boolean() });
        expect(args.noCache).toBe(true);
    });
});

describe('values and coercion', () => {
    it('does not consume a flag-looking token as a value', () => {
        const shape = { port: a.number(), open: a.boolean() };
        const err = parseError(() => parseArgs(['--port', '--open'], shape));
        expect(err.code).toBe('MISSING_VALUE');
        expect(err.detail.arg).toBe('port');
    });

    it('treats negative numbers as values, not flags', () => {
        const shape = { offset: a.number(), rest: a.rest() };
        expect(parseArgs(['--offset', '-2'], shape).args.offset).toBe(-2);
        expect(parseArgs(['--offset', '-.5'], shape).args.offset).toBe(-0.5);
        expect(parseArgs(['-1.5', '-.5'], shape).args.rest).toEqual(['-1.5', '-.5']);
    });

    it('rejects non-finite numbers', () => {
        const err = parseError(() => parseArgs(['--port', 'abc'], { port: a.number() }));
        expect(err.code).toBe('INVALID_NUMBER');
        expect(err.detail).toMatchObject({ arg: 'port', received: 'abc', expected: 'number' });
    });

    it('enforces enum options exactly', () => {
        const shape = { mode: a.enum(['dev', 'prod']) };
        expect(parseArgs(['--mode', 'dev'], shape).args.mode).toBe('dev');
        const err = parseError(() => parseArgs(['--mode', 'Dev'], shape));
        expect(err.code).toBe('INVALID_ENUM');
        expect(err.detail.expected).toBe('dev|prod');
    });
});

describe('repeats', () => {
    it('appends for multiple() and defaults to []', () => {
        const shape = { tag: a.string().multiple() };
        expect(parseArgs(['--tag', 'a', '--tag=b'], shape).args.tag).toEqual(['a', 'b']);
        expect(parseArgs([], shape).args.tag).toEqual([]);
    });

    it('last wins without multiple()', () => {
        expect(parseArgs(['--port', '1', '--port', '2'], { port: a.number() }).args.port).toBe(2);
    });
});

describe('positionals, rest, and --', () => {
    it('fills positionals in declaration order, rest collects the tail', () => {
        const shape = {
            entry: a.positional(),
            out: a.positional(),
            files: a.rest(),
            verbose: a.boolean()
        };
        const { args } = parseArgs(['a.ts', '--verbose', 'b.ts', 'c.ts', 'd.ts'], shape);
        expect(args.entry).toBe('a.ts');
        expect(args.out).toBe('b.ts');
        expect(args.files).toEqual(['c.ts', 'd.ts']);
        expect(args.verbose).toBe(true);
    });

    it('rejects extra positionals without a rest arg', () => {
        const err = parseError(() => parseArgs(['a', 'b'], { entry: a.positional() }));
        expect(err.code).toBe('UNEXPECTED_POSITIONAL');
        expect(err.detail.received).toBe('b');
    });

    it('validates the shape eagerly — a key named _ throws DefinitionError', () => {
        expect(() => parseArgs([], { _: a.string() })).toThrow(DefinitionError);
    });

    it('validates collisions eagerly even without a command', () => {
        expect(() => parseArgs([], { port: a.number().alias('p'), print: a.boolean().alias('p') })).toThrow(
            DefinitionError
        );
    });

    it('passes everything after -- through to _, untouched', () => {
        const shape = { entry: a.positional(), port: a.number() };
        const { args } = parseArgs(['main.ts', '--', '--port', '9'], shape);
        expect(args.entry).toBe('main.ts');
        expect(args.port).toBeUndefined();
        expect(args._).toEqual(['--port', '9']);
    });
});

describe('defaults and required', () => {
    it('applies defaults after parsing', () => {
        const shape = { host: a.string().default('localhost') };
        expect(parseArgs([], shape).args.host).toBe('localhost');
        expect(parseArgs(['--host', 'x'], shape).args.host).toBe('x');
    });

    it('materializes absent optionals as own undefined properties', () => {
        const { args } = parseArgs([], {
            verbose: a.boolean(),
            entry: a.positional(),
            mode: a.enum(['a', 'b'])
        });
        expect('verbose' in args).toBe(true);
        expect(Object.keys(args).sort()).toEqual(['_', 'entry', 'mode', 'verbose']);
        expect(args.verbose).toBeUndefined();
    });

    it('throws MISSING_REQUIRED for absent flags and positionals', () => {
        const flagErr = parseError(() => parseArgs([], { port: a.number().required() }));
        expect(flagErr.code).toBe('MISSING_REQUIRED');
        expect(flagErr.message).toContain('--port');

        const posErr = parseError(() => parseArgs([], { entry: a.positional().required() }));
        expect(posErr.code).toBe('MISSING_REQUIRED');
        expect(posErr.message).toContain('<entry>');
    });

    it('requires at least one value for required multiple flags', () => {
        const err = parseError(() => parseArgs([], { tag: a.string().multiple().required() }));
        expect(err.code).toBe('MISSING_REQUIRED');
    });
});

describe('unknown flags', () => {
    it('throws by default with the offending token', () => {
        const err = parseError(() => parseArgs(['--bogus'], {}));
        expect(err.code).toBe('UNKNOWN_FLAG');
        expect(err.detail.received).toBe('--bogus');
    });

    it('collects them with allowUnknownFlags', () => {
        const { args, unknownFlags } = parseArgs(
            ['pos', '--bogus=1', '-z', '--verbose'],
            { entry: a.positional() },
            { allowUnknownFlags: true }
        );
        expect(unknownFlags).toEqual(['--bogus=1', '-z', '--verbose']);
        expect(args.entry).toBe('pos');
    });

    it('consumes an unknown flag value so positional binding does not shift', () => {
        const { args, unknownFlags } = parseArgs(
            ['--foo', 'bar', 'pos'],
            { entry: a.positional() },
            { allowUnknownFlags: true }
        );
        expect(unknownFlags).toEqual(['--foo', 'bar']);
        expect(args.entry).toBe('pos');
    });

    it('does not consume past an unknown --flag=value or a flag-looking token', () => {
        const { args, unknownFlags } = parseArgs(
            ['--foo=1', 'pos', '--bar', '--baz'],
            { entry: a.positional() },
            { allowUnknownFlags: true }
        );
        expect(unknownFlags).toEqual(['--foo=1', '--bar', '--baz']);
        expect(args.entry).toBe('pos');
    });

    it('annotates errors with the command path when given', () => {
        const err = parseError(() => parseArgs(['--bogus'], {}, { commandPath: ['sigx', 'dev'] }));
        expect(err.detail.command).toEqual(['sigx', 'dev']);
    });
});
