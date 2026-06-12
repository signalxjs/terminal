/**
 * Entry points: `runMain` for CLI binaries (help/version interception, error
 * printing, exit codes via process.exitCode — never process.exit, so streams
 * flush and embedders survive) and `runCommand`, the throwing variant for
 * hosts that render errors themselves (e.g. a TUI shell) and for tests.
 */

import { resolveCommand } from './command.js';
import { ParseError } from './errors.js';
import { buildHelpCatalog } from './help.js';
import { parseArgs } from './parse.js';
import { renderHelp } from './render.js';
import type { AnyCommand, ArgsDef, CommandContext } from './types.js';

export interface RunMainOptions {
    /** Defaults to process.argv.slice(2). */
    rawArgs?: readonly string[];
    /** Defaults to console.log — injectable for tests and TUI hosts. */
    stdout?: (text: string) => void;
    /** Defaults to console.error. */
    stderr?: (text: string) => void;
}

function setExitCode(code: number): void {
    if (typeof process !== 'undefined') process.exitCode = code;
}

/** Tokens before the first bare `--` (flags after it are payload, not ours). */
function preDashDash(argv: readonly string[]): readonly string[] {
    const end = argv.indexOf('--');
    return end === -1 ? argv : argv.slice(0, end);
}

/**
 * Root-only --version: stop scanning at the first non-flag token, so
 * `sigx dev --version` is left to the subcommand's own parsing.
 */
function wantsRootVersion(argv: readonly string[]): boolean {
    for (const token of argv) {
        if (token === '--') return false;
        if (token === '--version') return true;
        if (!token.startsWith('-')) return false;
    }
    return false;
}

interface ResolvedRun {
    cmd: AnyCommand;
    path: string[];
    rest: string[];
}

function buildContext(root: AnyCommand, resolved: ResolvedRun): CommandContext {
    const { args, unknownFlags } = parseArgs<ArgsDef>(resolved.rest, resolved.cmd.args ?? {}, {
        ...(resolved.cmd.allowUnknownFlags !== undefined ? { allowUnknownFlags: resolved.cmd.allowUnknownFlags } : {}),
        commandPath: resolved.path
    });
    return {
        args,
        rawArgs: [...resolved.rest],
        cmd: resolved.cmd,
        root,
        path: resolved.path,
        unknownFlags
    };
}

/**
 * Resolve + parse + run, throwing on any failure (ParseError or handler
 * error) instead of printing. Returns the context the handler received —
 * untyped args, since resolution may descend to a subcommand whose schema
 * differs from the root's.
 */
export async function runCommand(
    cmd: AnyCommand,
    opts: { rawArgs: readonly string[] }
): Promise<CommandContext> {
    const resolved = resolveCommand(cmd, opts.rawArgs);
    const ctx = buildContext(cmd, resolved);
    if (resolved.cmd.run) await resolved.cmd.run(ctx);
    return ctx;
}

export async function runMain(cmd: AnyCommand, opts: RunMainOptions = {}): Promise<void> {
    const rawArgs = opts.rawArgs ?? (typeof process !== 'undefined' ? process.argv.slice(2) : []);
    const stdout = opts.stdout ?? ((text: string) => console.log(text));
    const stderr = opts.stderr ?? ((text: string) => console.error(text));

    if (cmd.meta.version !== undefined && wantsRootVersion(rawArgs)) {
        stdout(cmd.meta.version);
        setExitCode(0);
        return;
    }

    let resolved: ResolvedRun;
    try {
        resolved = resolveCommand(cmd, rawArgs);
    } catch (error) {
        if (error instanceof ParseError) {
            stderr(`error: ${error.message}`);
            stderr(`Run '${(error.detail.command ?? [cmd.meta.name ?? 'cli']).join(' ')} --help' for usage.`);
            setExitCode(1);
            return;
        }
        throw error;
    }

    const pre = preDashDash(resolved.rest);
    const wantsHelp = pre.includes('--help') || pre.includes('-h');
    if (wantsHelp || !resolved.cmd.run) {
        stdout(renderHelp(buildHelpCatalog(resolved.cmd, resolved.path)));
        setExitCode(wantsHelp ? 0 : 1);
        return;
    }

    let ctx: CommandContext;
    try {
        ctx = buildContext(cmd, resolved);
    } catch (error) {
        if (error instanceof ParseError) {
            stderr(`error: ${error.message}`);
            stderr(`Run '${resolved.path.join(' ')} --help' for usage.`);
            setExitCode(1);
            return;
        }
        throw error;
    }

    try {
        await resolved.cmd.run(ctx);
        setExitCode(0);
    } catch (error) {
        stderr(`error: ${error instanceof Error ? error.message : String(error)}`);
        setExitCode(1);
    }
}
