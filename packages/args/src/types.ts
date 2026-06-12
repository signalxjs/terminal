/**
 * Internal arg-definition shapes — the normalized currency between the fluent
 * builders (`arg.ts`), the parser (`parse.ts`), and the help catalog
 * (`help.ts`). Consumers define args through the `a` builders, which emit
 * these defs; type inference lives on the builders themselves (`InferArgs`).
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
    /** Positionals default to optional — one uniform rule across arg types. */
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
// Command metadata
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
