/**
 * @sigx/args — type-aware command & argument parser for CLIs.
 *
 * Define commands with typed args schemas (`defineCommand`); the schema drives
 * compile-time inference of the handler's `ctx.args`. Includes nested
 * subcommands, automatic --help/--version, a headless help catalog, and a
 * plain-text renderer. Zero runtime dependencies, platform-neutral.
 */

export { defineCommand, resolveCommand, type ResolvedCommand } from './command.js';
export { DefinitionError, ParseError, type ParseErrorCode, type ParseErrorDetail } from './errors.js';
export { buildHelpCatalog, type HelpArgEntry, type HelpCatalog, type HelpSubcommandEntry } from './help.js';
export { parseArgs, type ParseArgsOptions, type ParseResult } from './parse.js';
export { renderHelp, type RenderHelpOptions } from './render.js';
export { runCommand, runMain, type RunMainOptions } from './run.js';
export type {
    AnyCommand,
    ArgDef,
    ArgDefBase,
    ArgsDef,
    BooleanArgDef,
    Command,
    CommandContext,
    CommandDef,
    CommandMeta,
    EnumArgDef,
    NumberArgDef,
    ParsedArgs,
    PositionalArgDef,
    RestArgDef,
    StringArgDef
} from './types.js';
