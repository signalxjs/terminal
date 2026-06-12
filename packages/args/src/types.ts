/**
 * Argument schema types and the type-inference layer.
 *
 * The schema a command declares (`ArgsDef`) drives compile-time inference of
 * the parsed-args shape (`ParsedArgs`): `required: true` and present `default`
 * values produce non-optional properties, enums infer their option union, and
 * `multiple`/`rest` args always resolve to arrays. `defineCommand` takes a
 * `const` type parameter so literal defaults and enum options survive inference.
 */

// ---------------------------------------------------------------------------
// Arg definitions
// ---------------------------------------------------------------------------

export interface ArgDefBase {
    description?: string;
    /** Hide from help output. */
    hidden?: boolean;
    /** Value placeholder for help, e.g. 'file' renders `--out <file>`. */
    valueHint?: string;
}

interface FlagDefBase extends ArgDefBase {
    /** Alternate names; single-character aliases become short flags (-p). */
    alias?: string | readonly string[];
}

export interface StringArgDef extends FlagDefBase {
    type: 'string';
    required?: boolean;
    default?: string;
    /** Repeatable flag: `--tag a --tag b` → string[] (always present, [] if absent). */
    multiple?: boolean;
}

export interface NumberArgDef extends FlagDefBase {
    type: 'number';
    required?: boolean;
    default?: number;
    multiple?: boolean;
}

export interface BooleanArgDef extends FlagDefBase {
    type: 'boolean';
    required?: boolean;
    default?: boolean;
    /** Accept `--no-<name>` to force false. Default: true. */
    negatable?: boolean;
}

export interface EnumArgDef<O extends readonly string[] = readonly string[]> extends FlagDefBase {
    type: 'enum';
    options: O;
    required?: boolean;
    default?: O[number];
    multiple?: boolean;
}

export interface PositionalArgDef extends ArgDefBase {
    type: 'positional';
    /** Unlike citty, positionals default to optional — one uniform rule. */
    required?: boolean;
    default?: string;
}

/** Variadic tail positional: collects all remaining positional tokens. Always string[]. */
export interface RestArgDef extends ArgDefBase {
    type: 'rest';
}

export type ArgDef =
    | StringArgDef
    | NumberArgDef
    | BooleanArgDef
    | EnumArgDef
    | PositionalArgDef
    | RestArgDef;

export type ArgsDef = Record<string, ArgDef>;

// ---------------------------------------------------------------------------
// Inference layer
// ---------------------------------------------------------------------------

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type ArgBaseValue<D extends ArgDef> = D extends { type: 'enum'; options: infer O extends readonly string[] }
    ? O[number]
    : D extends { type: 'number' }
      ? number
      : D extends { type: 'boolean' }
        ? boolean
        : string;

type ArgValue<D extends ArgDef> = D extends { type: 'rest' }
    ? string[]
    : D extends { multiple: true }
      ? ArgBaseValue<D>[]
      : ArgBaseValue<D>;

/** True only when a real (non-undefined) default literal is present on the def. */
type HasDefault<D extends ArgDef> = D extends { default: infer V } ? (undefined extends V ? false : true) : false;

type IsResolved<D extends ArgDef> = D extends { type: 'rest' }
    ? true
    : D extends { multiple: true }
      ? true
      : D extends { required: true }
        ? true
        : HasDefault<D>;

export type ParsedArgs<A extends ArgsDef> = Simplify<
    {
        [K in keyof A]: IsResolved<A[K]> extends true ? ArgValue<A[K]> : ArgValue<A[K]> | undefined;
    } & {
        /** Raw tokens after `--`, verbatim. */
        _: string[];
    }
>;

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export interface CommandMeta {
    /** Display name for the root usage line; subcommands are named by their parent key. */
    name?: string;
    /** Root only: enables the automatic `--version` flag. */
    version?: string;
    description?: string;
    aliases?: readonly string[];
    /** Hide from the parent's COMMANDS list. */
    hidden?: boolean;
}

export interface CommandContext<A extends ArgsDef = ArgsDef> {
    args: ParsedArgs<A>;
    /** The argv slice given to this command (after subcommand descent). */
    rawArgs: string[];
    /** The resolved (deepest) command. */
    cmd: AnyCommand;
    root: AnyCommand;
    /** Command path, e.g. ['sigx', 'dev']. */
    path: string[];
    /** Unrecognized flag tokens — populated only when allowUnknownFlags is true. */
    unknownFlags: string[];
}

export interface CommandDef<A extends ArgsDef = ArgsDef> {
    meta?: CommandMeta;
    /** Shorthand for meta.description. */
    description?: string;
    args?: A;
    subCommands?: Record<string, AnyCommand>;
    /** Collect unknown flags into ctx.unknownFlags instead of throwing. Default false. */
    allowUnknownFlags?: boolean;
    run?: (ctx: CommandContext<A>) => void | Promise<void>;
}

export interface Command<A extends ArgsDef = ArgsDef> extends CommandDef<A> {
    /** Normalized: always present, with `description` shorthand folded in. */
    meta: CommandMeta;
}

// oxlint-disable-next-line no-explicit-any -- variance escape hatch: heterogeneous command trees
export type AnyCommand = Command<any>;
