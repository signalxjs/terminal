import { describe, expect, it } from 'vitest';
import { ParseError, parseArgs } from '../src/index';

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
        const def = { port: { type: 'number' }, host: { type: 'string' } } as const;
        expect(parseArgs(['--port', '3000'], def).args.port).toBe(3000);
        expect(parseArgs(['--port=3000'], def).args.port).toBe(3000);
        expect(parseArgs(['--host=a=b'], def).args.host).toBe('a=b');
    });

    it('parses short flags with value or =', () => {
        const def = { port: { type: 'number', alias: 'p' } } as const;
        expect(parseArgs(['-p', '8080'], def).args.port).toBe(8080);
        expect(parseArgs(['-p=8080'], def).args.port).toBe(8080);
    });

    it('expands boolean short clusters', () => {
        const def = {
            all: { type: 'boolean', alias: 'a' },
            brief: { type: 'boolean', alias: 'b' },
            count: { type: 'number', alias: 'c' }
        } as const;
        const { args } = parseArgs(['-ab'], def);
        expect(args.all).toBe(true);
        expect(args.brief).toBe(true);

        const err = parseError(() => parseArgs(['-ac'], def));
        expect(err.code).toBe('UNKNOWN_FLAG');
        expect(err.message).toContain('boolean');
    });

    it('normalizes kebab and camel spellings both ways', () => {
        expect(parseArgs(['--dry-run'], { dryRun: { type: 'boolean' } }).args.dryRun).toBe(true);
        expect(parseArgs(['--dryRun'], { dryRun: { type: 'boolean' } }).args.dryRun).toBe(true);
        expect(parseArgs(['--dryRun'], { 'dry-run': { type: 'boolean' } }).args['dry-run']).toBe(true);
    });

    it('resolves long aliases', () => {
        const def = { force: { type: 'boolean', alias: ['hard'] } } as const;
        expect(parseArgs(['--hard'], def).args.force).toBe(true);
    });
});

describe('booleans', () => {
    it('never consumes the next token', () => {
        const def = { open: { type: 'boolean' }, entry: { type: 'positional' } } as const;
        const { args } = parseArgs(['--open', 'main.ts'], def);
        expect(args.open).toBe(true);
        expect(args.entry).toBe('main.ts');
    });

    it('accepts explicit =true/false/1/0/yes/no', () => {
        const def = { open: { type: 'boolean' } } as const;
        expect(parseArgs(['--open=false'], def).args.open).toBe(false);
        expect(parseArgs(['--open=YES'], def).args.open).toBe(true);
        expect(parseArgs(['--open=0'], def).args.open).toBe(false);
        const err = parseError(() => parseArgs(['--open=maybe'], def));
        expect(err.code).toBe('INVALID_BOOLEAN');
        expect(err.detail).toMatchObject({ arg: 'open', received: 'maybe' });
    });

    it('negates with --no-x unless negatable: false', () => {
        expect(parseArgs(['--no-color'], { color: { type: 'boolean', default: true } }).args.color).toBe(false);
        const err = parseError(() => parseArgs(['--no-color'], { color: { type: 'boolean', negatable: false } }));
        expect(err.code).toBe('UNKNOWN_FLAG');
    });

    it('prefers a literal no- key over negation', () => {
        const { args } = parseArgs(['--no-cache'], { noCache: { type: 'boolean' } });
        expect(args.noCache).toBe(true);
    });
});

describe('values and coercion', () => {
    it('does not consume a flag-looking token as a value', () => {
        const def = { port: { type: 'number' }, open: { type: 'boolean' } } as const;
        const err = parseError(() => parseArgs(['--port', '--open'], def));
        expect(err.code).toBe('MISSING_VALUE');
        expect(err.detail.arg).toBe('port');
    });

    it('treats negative numbers as values, not flags', () => {
        const def = { offset: { type: 'number' }, rest: { type: 'rest' } } as const;
        expect(parseArgs(['--offset', '-2'], def).args.offset).toBe(-2);
        expect(parseArgs(['-1.5'], def).args.rest).toEqual(['-1.5']);
    });

    it('rejects non-finite numbers', () => {
        const err = parseError(() => parseArgs(['--port', 'abc'], { port: { type: 'number' } }));
        expect(err.code).toBe('INVALID_NUMBER');
        expect(err.detail).toMatchObject({ arg: 'port', received: 'abc', expected: 'number' });
    });

    it('enforces enum options exactly', () => {
        const def = { mode: { type: 'enum', options: ['dev', 'prod'] } } as const;
        expect(parseArgs(['--mode', 'dev'], def).args.mode).toBe('dev');
        const err = parseError(() => parseArgs(['--mode', 'Dev'], def));
        expect(err.code).toBe('INVALID_ENUM');
        expect(err.detail.expected).toBe('dev|prod');
    });
});

describe('repeats', () => {
    it('appends for multiple: true and defaults to []', () => {
        const def = { tag: { type: 'string', multiple: true } } as const;
        expect(parseArgs(['--tag', 'a', '--tag=b'], def).args.tag).toEqual(['a', 'b']);
        expect(parseArgs([], def).args.tag).toEqual([]);
    });

    it('last wins without multiple', () => {
        expect(parseArgs(['--port', '1', '--port', '2'], { port: { type: 'number' } }).args.port).toBe(2);
    });
});

describe('positionals, rest, and --', () => {
    it('fills positionals in declaration order, rest collects the tail', () => {
        const def = {
            entry: { type: 'positional' },
            out: { type: 'positional' },
            files: { type: 'rest' },
            verbose: { type: 'boolean' }
        } as const;
        const { args } = parseArgs(['a.ts', '--verbose', 'b.ts', 'c.ts', 'd.ts'], def);
        expect(args.entry).toBe('a.ts');
        expect(args.out).toBe('b.ts');
        expect(args.files).toEqual(['c.ts', 'd.ts']);
        expect(args.verbose).toBe(true);
    });

    it('rejects extra positionals without a rest arg', () => {
        const err = parseError(() => parseArgs(['a', 'b'], { entry: { type: 'positional' } }));
        expect(err.code).toBe('UNEXPECTED_POSITIONAL');
        expect(err.detail.received).toBe('b');
    });

    it('passes everything after -- through to _, untouched', () => {
        const def = { entry: { type: 'positional' }, port: { type: 'number' } } as const;
        const { args } = parseArgs(['main.ts', '--', '--port', '9'], def);
        expect(args.entry).toBe('main.ts');
        expect(args.port).toBeUndefined();
        expect(args._).toEqual(['--port', '9']);
    });
});

describe('defaults and required', () => {
    it('applies defaults after parsing', () => {
        const def = { host: { type: 'string', default: 'localhost' } } as const;
        expect(parseArgs([], def).args.host).toBe('localhost');
        expect(parseArgs(['--host', 'x'], def).args.host).toBe('x');
    });

    it('throws MISSING_REQUIRED for absent flags and positionals', () => {
        const flagErr = parseError(() => parseArgs([], { port: { type: 'number', required: true } }));
        expect(flagErr.code).toBe('MISSING_REQUIRED');
        expect(flagErr.message).toContain('--port');

        const posErr = parseError(() => parseArgs([], { entry: { type: 'positional', required: true } }));
        expect(posErr.code).toBe('MISSING_REQUIRED');
        expect(posErr.message).toContain('<entry>');
    });

    it('requires at least one value for required multiple flags', () => {
        const err = parseError(() => parseArgs([], { tag: { type: 'string', multiple: true, required: true } }));
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
        const { args, unknownFlags } = parseArgs(['--bogus=1', '-z', 'pos'], { entry: { type: 'positional' } }, {
            allowUnknownFlags: true
        });
        expect(unknownFlags).toEqual(['--bogus=1', '-z']);
        expect(args.entry).toBe('pos');
    });

    it('annotates errors with the command path when given', () => {
        const err = parseError(() => parseArgs(['--bogus'], {}, { commandPath: ['sigx', 'dev'] }));
        expect(err.detail.command).toEqual(['sigx', 'dev']);
    });
});
