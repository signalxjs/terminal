/**
 * Fluent command builder + subcommand resolution.
 *
 * `command(name)` starts a chain — `.describe()`, `.version()`, `.args()`,
 * `.subcommands()`, `.run()`. There is no `.build()`: the builder IS the
 * command, so a group without a handler is passed to `runMain` as-is, and
 * `.run()` (terminal) returns the finished, opaque `Command`. The args schema
 * is validated eagerly inside `.args()` so definition bugs throw at startup,
 * not mid-parse. `resolveCommand` walks the subcommand tree by matching the
 * leading non-flag tokens against keys and aliases.
 */

import type { ArgsShape, InferArgs } from './arg.js';
import { toArgsDef } from './arg.js';
import { DefinitionError, ParseError } from './errors.js';
import { validateArgs } from './parse.js';
import type { ArgsDef, CommandMeta } from './types.js';

export interface CommandContext<S extends ArgsShape = ArgsShape> {
    args: InferArgs<S>;
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

/** @internal Normalized command state — what run/help/resolve consume. */
export interface CommandState {
    meta: CommandMeta;
    args?: ArgsDef;
    subCommands?: Record<string, AnyCommand>;
    allowUnknownFlags?: boolean;
    run?: (ctx: CommandContext) => void | Promise<void>;
}

/** A finished command — what `runMain`, `resolveCommand`, and `buildHelpCatalog` accept. */
export interface Command<S extends ArgsShape = ArgsShape> {
    /** @internal */
    readonly '~cmd': CommandState;
    /** Phantom carrier of the args shape — never assigned at runtime. */
    readonly '~args'?: (s: S) => S;
}

// oxlint-disable-next-line no-explicit-any -- variance escape hatch: heterogeneous command trees
export type AnyCommand = Command<any>;

/** @internal */
export function defOf(cmd: AnyCommand): CommandState {
    return cmd['~cmd'];
}

function reservedNames(meta: CommandMeta): Map<string, string> {
    const reserved = new Map([
        ['help', '--help'],
        ['h', '-h']
    ]);
    if (meta.version !== undefined) reserved.set('version', '--version');
    return reserved;
}

export class CommandBuilder<S extends ArgsShape = Record<never, never>> implements Command<S> {
    /** @internal */
    readonly '~cmd': CommandState;
    declare readonly '~args'?: (s: S) => S;

    /** @internal — start chains with `command(name)`. */
    constructor(state: CommandState) {
        this['~cmd'] = state;
    }

    private patch(patch: Partial<CommandState>): CommandState {
        return { ...this['~cmd'], ...patch };
    }

    private patchMeta(patch: Partial<CommandMeta>): CommandBuilder<S> {
        return new CommandBuilder<S>(this.patch({ meta: { ...this['~cmd'].meta, ...patch } }));
    }

    describe(text: string): CommandBuilder<S> {
        return this.patchMeta({ description: text });
    }

    /** Enables the automatic root `--version` flag and reserves the name. */
    version(version: string): CommandBuilder<S> {
        const next = this.patchMeta({ version });
        // Re-validate so .version() after .args() still enforces the reservation.
        validateArgs(next['~cmd'].args, reservedNames(next['~cmd'].meta));
        return next;
    }

    /** Alternate names this command matches as a subcommand. */
    aliases(...names: string[]): CommandBuilder<S> {
        return this.patchMeta({ aliases: names });
    }

    /** Hide from the parent's COMMANDS list. */
    hidden(): CommandBuilder<S> {
        return this.patchMeta({ hidden: true });
    }

    /** Collect unknown flags into ctx.unknownFlags instead of throwing. */
    allowUnknownFlags(allow = true): CommandBuilder<S> {
        return new CommandBuilder<S>(this.patch({ allowUnknownFlags: allow }));
    }

    /** Declare the args schema (once); validated eagerly. */
    args<T extends ArgsShape>(shape: T): CommandBuilder<T> {
        if (this['~cmd'].args !== undefined) {
            throw new DefinitionError('args() may only be called once per command');
        }
        const argsDef = toArgsDef(shape);
        validateArgs(argsDef, reservedNames(this['~cmd'].meta));
        return new CommandBuilder<T>(this.patch({ args: argsDef }));
    }

    subcommands(map: Record<string, AnyCommand>): CommandBuilder<S> {
        return new CommandBuilder<S>(this.patch({ subCommands: { ...this['~cmd'].subCommands, ...map } }));
    }

    /**
     * Attach the handler. Terminal at the type level: the return is typed as
     * the finished `Command` (at runtime still a builder), so typed callers
     * can't keep refining past the context type the handler closed over —
     * call `.args()`/`.subcommands()` first.
     */
    run(handler: (ctx: CommandContext<S>) => void | Promise<void>): Command<S> {
        return new CommandBuilder<S>(this.patch({ run: handler as CommandState['run'] }));
    }
}

export function command(name: string): CommandBuilder {
    return new CommandBuilder({ meta: { name } });
}

export interface ResolvedCommand {
    cmd: AnyCommand;
    /** Command path, e.g. ['sigx', 'dev']. */
    path: string[];
    /** The argv remainder for the resolved command's own args. */
    rest: string[];
}

function findSubCommand(
    subCommands: Record<string, AnyCommand>,
    token: string
): { name: string; cmd: AnyCommand } | undefined {
    const direct = subCommands[token];
    if (direct) return { name: token, cmd: direct };
    for (const [name, cmd] of Object.entries(subCommands)) {
        if (defOf(cmd).meta.aliases?.includes(token)) return { name, cmd };
    }
    return undefined;
}

/** Walk subcommands/aliases. Returns the deepest matched command + remaining argv. */
export function resolveCommand(root: AnyCommand, argv: readonly string[]): ResolvedCommand {
    let cmd = root;
    const path = [defOf(root).meta.name ?? 'cli'];
    let rest = [...argv];

    for (;;) {
        const def = defOf(cmd);
        if (!def.subCommands) break;
        const token = rest[0];
        if (token === undefined || token.startsWith('-')) break;
        const match = findSubCommand(def.subCommands, token);
        if (!match) {
            if (def.run) break; // default-command: tokens are this command's own args
            throw new ParseError('UNKNOWN_COMMAND', `Unknown command '${token}'`, {
                arg: token,
                received: token,
                command: [...path]
            });
        }
        cmd = match.cmd;
        path.push(match.name);
        rest = rest.slice(1);
    }

    return { cmd, path, rest };
}
