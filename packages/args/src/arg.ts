/**
 * Fluent arg builders — the `a` namespace.
 *
 * Each builder wraps a plain internal `ArgDef` (what the parser and help
 * catalog consume) and carries a phantom output type (`'~out'`) plus a
 * type-state generic threading requiredness/multiplicity, so a record of
 * builders infers the exact parsed-args shape (`InferArgs`). Refiners are
 * immutable — every call returns a new builder, so a base builder can be
 * shared and re-refined safely. Invalid combinations are unrepresentable
 * where possible (the method simply doesn't exist on that builder, or a
 * `this`-parameter guard rejects the chain); `validateArgs` stays as the
 * runtime backstop for untyped callers.
 */

import type { ArgDef, ArgsDef } from './types.js';

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** Type-state carried by a builder: how the arg resolves at parse time. */
export interface ArgState {
    presence: 'optional' | 'required' | 'default';
    multiple: boolean;
}

type ValueOf<Base, S extends ArgState> = S['multiple'] extends true
    ? Base[]
    : S['presence'] extends 'optional'
      ? Base | undefined
      : Base;

abstract class BaseArg<Out> {
    /** Phantom carrier of the parsed value type — never assigned at runtime. */
    declare readonly '~out': Out;
    /** @internal The plain ArgDef the parser and help catalog consume. */
    readonly '~def': ArgDef;

    constructor(def: ArgDef) {
        this['~def'] = def;
    }

    describe(text: string): this {
        return this.with({ description: text });
    }

    /** Hide from help output. */
    hidden(): this {
        return this.with({ hidden: true });
    }

    /** Value placeholder for help, e.g. 'file' renders `--out <file>`. */
    valueHint(hint: string): this {
        return this.with({ valueHint: hint });
    }

    protected with(patch: object): this {
        const Ctor = this.constructor as new (def: ArgDef) => this;
        return new Ctor({ ...this['~def'], ...patch });
    }
}

abstract class FlagArg<Out> extends BaseArg<Out> {
    /** Alternate names; single-character aliases become short flags (-p). */
    alias(...names: string[]): this {
        const existing = (this['~def'] as { alias?: string | readonly string[] }).alias;
        const list = existing === undefined ? [] : typeof existing === 'string' ? [existing] : existing;
        return this.with({ alias: [...list, ...names] });
    }
}

/** String, number, and enum flags — `Base` is the coerced value type. */
export class ValueArg<
    Base extends string | number,
    S extends ArgState = { presence: 'optional'; multiple: false }
> extends FlagArg<ValueOf<Base, S>> {
    /** Invariance marker: keeps differently-stated builders unassignable. */
    declare readonly '~state': (s: S) => S;

    required(
        this: ValueArg<Base, { presence: 'optional'; multiple: S['multiple'] }>
    ): ValueArg<Base, { presence: 'required'; multiple: S['multiple'] }> {
        return this.with({ required: true }) as unknown as ValueArg<
            Base,
            { presence: 'required'; multiple: S['multiple'] }
        >;
    }

    default(
        this: ValueArg<Base, { presence: 'optional'; multiple: S['multiple'] }>,
        value: Base
    ): ValueArg<Base, { presence: 'default'; multiple: S['multiple'] }> {
        return this.with({ default: value }) as unknown as ValueArg<
            Base,
            { presence: 'default'; multiple: S['multiple'] }
        >;
    }

    /**
     * Repeatable flag: `--tag a --tag b` → array, always present — `[]` when
     * absent, or `[default]` when combined with `.default(v)`.
     */
    multiple(): ValueArg<Base, { presence: S['presence']; multiple: true }> {
        return this.with({ multiple: true }) as unknown as ValueArg<
            Base,
            { presence: S['presence']; multiple: true }
        >;
    }
}

export class BooleanArg<S extends ArgState = { presence: 'optional'; multiple: false }> extends FlagArg<
    ValueOf<boolean, S>
> {
    declare readonly '~state': (s: S) => S;

    required(
        this: BooleanArg<{ presence: 'optional'; multiple: false }>
    ): BooleanArg<{ presence: 'required'; multiple: false }> {
        return this.with({ required: true }) as unknown as BooleanArg<{ presence: 'required'; multiple: false }>;
    }

    default(
        this: BooleanArg<{ presence: 'optional'; multiple: false }>,
        value: boolean
    ): BooleanArg<{ presence: 'default'; multiple: false }> {
        return this.with({ default: value }) as unknown as BooleanArg<{ presence: 'default'; multiple: false }>;
    }

    /** Whether `--no-<name>` forces false. Default: true. */
    negatable(enabled: boolean): this {
        return this.with({ negatable: enabled });
    }
}

export class PositionalArg<S extends ArgState = { presence: 'optional'; multiple: false }> extends BaseArg<
    ValueOf<string, S>
> {
    declare readonly '~state': (s: S) => S;

    required(
        this: PositionalArg<{ presence: 'optional'; multiple: false }>
    ): PositionalArg<{ presence: 'required'; multiple: false }> {
        return this.with({ required: true }) as unknown as PositionalArg<{ presence: 'required'; multiple: false }>;
    }

    default(
        this: PositionalArg<{ presence: 'optional'; multiple: false }>,
        value: string
    ): PositionalArg<{ presence: 'default'; multiple: false }> {
        return this.with({ default: value }) as unknown as PositionalArg<{ presence: 'default'; multiple: false }>;
    }
}

/** Variadic tail positional: collects all remaining positional tokens. Always string[]. */
export class RestArg extends BaseArg<string[]> {}

/** Fluent factories for every arg type. */
export const a = {
    string: (): ValueArg<string> => new ValueArg<string>({ type: 'string' }),
    number: (): ValueArg<number> => new ValueArg<number>({ type: 'number' }),
    boolean: (): BooleanArg => new BooleanArg({ type: 'boolean' }),
    enum: <const O extends readonly [string, ...string[]]>(options: O): ValueArg<O[number]> =>
        new ValueArg<O[number]>({ type: 'enum', options }),
    positional: (): PositionalArg => new PositionalArg({ type: 'positional' }),
    rest: (): RestArg => new RestArg({ type: 'rest' })
};

/** Any arg builder, regardless of type or state — what `args()` records accept. */
export interface AnyArg {
    readonly '~out': unknown;
    readonly '~def': ArgDef;
}

export type ArgsShape = Record<string, AnyArg>;

/** The parsed-args object a shape infers to — what `ctx.args` is typed as. */
export type InferArgs<S extends ArgsShape> = Simplify<{ [K in keyof S]: S[K]['~out'] } & { _: string[] }>;

/** @internal Unwrap a builder record into the plain ArgsDef the parser consumes. */
export function toArgsDef(shape: ArgsShape): ArgsDef {
    const def: ArgsDef = {};
    for (const [key, builder] of Object.entries(shape)) def[key] = builder['~def'];
    return def;
}
