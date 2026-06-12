import { describe, expectTypeOf, it } from 'vitest';
import { a, command, parseArgs, type InferArgs } from '../src/index';

// Compile-time contract of the inference layer. These assertions are verified
// by `pnpm typecheck` (the root tsconfig includes this directory); vitest only
// executes them as no-ops.
describe('type inference', () => {
    it('infers required, defaulted, and optional flags', () => {
        command('x')
            .args({
                port: a.number().required(),
                host: a.string().default('localhost'),
                open: a.boolean(),
                retries: a.number()
            })
            .run((ctx) => {
                expectTypeOf(ctx.args.port).toEqualTypeOf<number>();
                expectTypeOf(ctx.args.host).toEqualTypeOf<string>();
                expectTypeOf(ctx.args.open).toEqualTypeOf<boolean | undefined>();
                expectTypeOf(ctx.args.retries).toEqualTypeOf<number | undefined>();
                // @ts-expect-error — keys outside the schema do not exist
                ctx.args.nope;
            });
    });

    it('infers enum option unions', () => {
        command('x')
            .args({
                mode: a.enum(['dev', 'prod']),
                level: a.enum(['low', 'high']).required(),
                fallback: a.enum(['a', 'b']).default('a')
            })
            .run((ctx) => {
                expectTypeOf(ctx.args.mode).toEqualTypeOf<'dev' | 'prod' | undefined>();
                expectTypeOf(ctx.args.level).toEqualTypeOf<'low' | 'high'>();
                expectTypeOf(ctx.args.fallback).toEqualTypeOf<'a' | 'b'>();
            });
    });

    it('infers positionals, rest, and multiple as arrays', () => {
        command('x')
            .args({
                entry: a.positional().required(),
                config: a.positional(),
                files: a.rest(),
                tag: a.string().multiple(),
                ratio: a.number().multiple()
            })
            .run((ctx) => {
                expectTypeOf(ctx.args.entry).toEqualTypeOf<string>();
                expectTypeOf(ctx.args.config).toEqualTypeOf<string | undefined>();
                expectTypeOf(ctx.args.files).toEqualTypeOf<string[]>();
                expectTypeOf(ctx.args.tag).toEqualTypeOf<string[]>();
                expectTypeOf(ctx.args.ratio).toEqualTypeOf<number[]>();
                expectTypeOf(ctx.args._).toEqualTypeOf<string[]>();
            });
    });

    it('keeps arrays non-optional regardless of refiner order', () => {
        command('x')
            .args({
                requiredTags: a.string().multiple().required(),
                defaultedTags: a.string().default('base').multiple()
            })
            .run((ctx) => {
                expectTypeOf(ctx.args.requiredTags).toEqualTypeOf<string[]>();
                expectTypeOf(ctx.args.defaultedTags).toEqualTypeOf<string[]>();
            });
    });

    it('types the parseArgs result directly', () => {
        const { args } = parseArgs(['--port', '3000'], {
            port: a.number().required(),
            verbose: a.boolean()
        });
        expectTypeOf(args.port).toEqualTypeOf<number>();
        expectTypeOf(args.verbose).toEqualTypeOf<boolean | undefined>();
        expectTypeOf(args._).toEqualTypeOf<string[]>();
    });

    it('infers a standalone shape via InferArgs', () => {
        const shape = { port: a.number().required(), tag: a.string().multiple() };
        expectTypeOf<InferArgs<typeof shape>>().toEqualTypeOf<{ port: number; tag: string[]; _: string[] }>();
    });

    it('rejects invalid refiner combinations at compile time', () => {
        // @ts-expect-error — default must match the value type
        a.number().default('x');
        // @ts-expect-error — enum default must be one of its options
        a.enum(['a', 'b']).default('c');
        // @ts-expect-error — booleans are not repeatable
        a.boolean().multiple;
        // @ts-expect-error — positionals have no aliases
        a.positional().alias;
        // @ts-expect-error — only booleans are negatable
        a.string().negatable;
        // @ts-expect-error — rest args are always optional arrays
        a.rest().required;
        // @ts-expect-error — a defaulted arg cannot also be required
        a.string().default('x').required();
        // @ts-expect-error — a required arg cannot also have a default
        a.number().required().default(1);
        // @ts-expect-error — requiredness cannot be restated
        a.boolean().required().required();
    });
});
