/**
 * @sigx/args — fluent, type-aware command & argument parser for CLIs.
 *
 * Build commands with `command(name)` and args with the `a` builders
 * (`a.number().alias('p').required()`); the builders drive compile-time
 * inference of the handler's `ctx.args`. Includes nested subcommands,
 * automatic --help/--version, a headless help catalog, and a plain-text
 * renderer. Zero runtime dependencies, platform-neutral.
 */

export {
    a,
    BooleanArg,
    PositionalArg,
    RestArg,
    ValueArg,
    type AnyArg,
    type ArgsShape,
    type ArgState,
    type InferArgs
} from './arg.js';
export {
    command,
    CommandBuilder,
    resolveCommand,
    type AnyCommand,
    type Command,
    type CommandContext,
    type ResolvedCommand
} from './command.js';
export { DefinitionError, ParseError, type ParseErrorCode, type ParseErrorDetail } from './errors.js';
export { buildHelpCatalog, type HelpArgEntry, type HelpCatalog, type HelpSubcommandEntry } from './help.js';
export { parseArgs, type ParseArgsOptions, type ParseResult } from './parse.js';
export { renderHelp, type RenderHelpOptions } from './render.js';
export { runCommand, runMain, type RunMainOptions } from './run.js';
