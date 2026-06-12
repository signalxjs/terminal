import { describe, expectTypeOf, it } from 'vitest';
import { defineCommand, parseArgs } from '../src/index';

// Compile-time contract of the inference layer. These assertions are verified
// by `pnpm typecheck` (the root tsconfig includes this directory); vitest only
// executes them as no-ops.
describe('type inference', () => {
    it('infers required, defaulted, and optional flags', () => {
        defineCommand({
            args: {
                port: { type: 'number', required: true },
                host: { type: 'string', default: 'localhost' },
                open: { type: 'boolean' },
                retries: { type: 'number' }
            },
            run(ctx) {
                expectTypeOf(ctx.args.port).toEqualTypeOf<number>();
                expectTypeOf(ctx.args.host).toEqualTypeOf<string>();
                expectTypeOf(ctx.args.open).toEqualTypeOf<boolean | undefined>();
                expectTypeOf(ctx.args.retries).toEqualTypeOf<number | undefined>();
                // @ts-expect-error — keys outside the schema do not exist
                ctx.args.nope;
            }
        });
    });

    it('infers enum option unions', () => {
        defineCommand({
            args: {
                mode: { type: 'enum', options: ['dev', 'prod'] },
                level: { type: 'enum', options: ['low', 'high'], required: true },
                fallback: { type: 'enum', options: ['a', 'b'], default: 'a' }
            },
            run(ctx) {
                expectTypeOf(ctx.args.mode).toEqualTypeOf<'dev' | 'prod' | undefined>();
                expectTypeOf(ctx.args.level).toEqualTypeOf<'low' | 'high'>();
                expectTypeOf(ctx.args.fallback).toEqualTypeOf<'a' | 'b'>();
            }
        });
    });

    it('infers positionals, rest, and multiple as arrays', () => {
        defineCommand({
            args: {
                entry: { type: 'positional', required: true },
                config: { type: 'positional' },
                files: { type: 'rest' },
                tag: { type: 'string', multiple: true },
                ratio: { type: 'number', multiple: true }
            },
            run(ctx) {
                expectTypeOf(ctx.args.entry).toEqualTypeOf<string>();
                expectTypeOf(ctx.args.config).toEqualTypeOf<string | undefined>();
                expectTypeOf(ctx.args.files).toEqualTypeOf<string[]>();
                expectTypeOf(ctx.args.tag).toEqualTypeOf<string[]>();
                expectTypeOf(ctx.args.ratio).toEqualTypeOf<number[]>();
                expectTypeOf(ctx.args._).toEqualTypeOf<string[]>();
            }
        });
    });

    it('types the parseArgs result directly', () => {
        const { args } = parseArgs(['--port', '3000'], {
            port: { type: 'number', required: true },
            verbose: { type: 'boolean' }
        });
        expectTypeOf(args.port).toEqualTypeOf<number>();
        expectTypeOf(args.verbose).toEqualTypeOf<boolean | undefined>();
        expectTypeOf(args._).toEqualTypeOf<string[]>();
    });
});
