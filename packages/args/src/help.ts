/**
 * Headless help catalog: a fully structured description of a command — args,
 * types, requiredness, defaults, subcommands — that any renderer can consume
 * without re-parsing strings. The plain-text renderer lives in render.ts; a
 * themed TUI renderer can be layered on top elsewhere (zero/skin split).
 */

import { aliasesOf } from './parse.js';
import type { AnyCommand, ArgsDef } from './types.js';

export interface HelpArgEntry {
    /** Canonical arg key (camelCase as declared); renderers kebab-case flags for display. */
    name: string;
    kind: 'flag' | 'positional' | 'rest';
    type: 'string' | 'number' | 'boolean' | 'enum';
    aliases: string[];
    /** Enum members. */
    options?: readonly string[];
    required: boolean;
    multiple: boolean;
    /** Booleans only — accepts `--no-<name>`. */
    negatable: boolean;
    default?: string | number | boolean;
    description?: string;
    valueHint?: string;
    hidden: boolean;
    /** True for the synthesized --help / --version entries. */
    builtin: boolean;
}

export interface HelpSubcommandEntry {
    name: string;
    aliases: string[];
    description?: string;
    hidden: boolean;
}

export interface HelpCatalog {
    /** Command path, e.g. ['sigx', 'dev']. */
    path: string[];
    version?: string;
    description?: string;
    /** Declaration order; includes the builtin --help (and --version when set). */
    flags: HelpArgEntry[];
    /** Declaration order, rest last. */
    positionals: HelpArgEntry[];
    subCommands: HelpSubcommandEntry[];
    /** Runnable without a subcommand. */
    hasDefaultRun: boolean;
}

export function buildHelpCatalog(cmd: AnyCommand, path?: readonly string[]): HelpCatalog {
    const flags: HelpArgEntry[] = [];
    const positionals: HelpArgEntry[] = [];

    const argsDef: ArgsDef = cmd.args ?? {};
    for (const [name, def] of Object.entries(argsDef)) {
        if (def.type === 'positional' || def.type === 'rest') {
            positionals.push({
                name,
                kind: def.type,
                type: 'string',
                aliases: [],
                required: def.type === 'positional' ? (def.required ?? false) : false,
                multiple: def.type === 'rest',
                negatable: false,
                ...(def.type === 'positional' && def.default !== undefined ? { default: def.default } : {}),
                ...(def.description !== undefined ? { description: def.description } : {}),
                ...(def.valueHint !== undefined ? { valueHint: def.valueHint } : {}),
                hidden: def.hidden ?? false,
                builtin: false
            });
        } else {
            flags.push({
                name,
                kind: 'flag',
                type: def.type,
                aliases: aliasesOf(def),
                ...(def.type === 'enum' ? { options: def.options } : {}),
                required: def.required ?? false,
                multiple: def.type !== 'boolean' && (def.multiple ?? false),
                negatable: def.type === 'boolean' && def.negatable !== false,
                ...(def.default !== undefined ? { default: def.default } : {}),
                ...(def.description !== undefined ? { description: def.description } : {}),
                ...(def.valueHint !== undefined ? { valueHint: def.valueHint } : {}),
                hidden: def.hidden ?? false,
                builtin: false
            });
        }
    }

    flags.push({
        name: 'help',
        kind: 'flag',
        type: 'boolean',
        aliases: ['h'],
        required: false,
        multiple: false,
        negatable: false,
        description: 'Show help',
        hidden: false,
        builtin: true
    });
    // runMain only intercepts --version at the root invocation, so only the
    // root catalog (path length <= 1) advertises the builtin flag.
    if (cmd.meta.version !== undefined && (path === undefined || path.length <= 1)) {
        flags.push({
            name: 'version',
            kind: 'flag',
            type: 'boolean',
            aliases: [],
            required: false,
            multiple: false,
            negatable: false,
            description: 'Show version',
            hidden: false,
            builtin: true
        });
    }

    const subCommands: HelpSubcommandEntry[] = Object.entries(cmd.subCommands ?? {}).map(([name, sub]) => ({
        name,
        aliases: [...(sub.meta.aliases ?? [])],
        ...(sub.meta.description !== undefined ? { description: sub.meta.description } : {}),
        hidden: sub.meta.hidden ?? false
    }));

    return {
        path: path ? [...path] : [cmd.meta.name ?? 'cli'],
        ...(cmd.meta.version !== undefined ? { version: cmd.meta.version } : {}),
        ...(cmd.meta.description !== undefined ? { description: cmd.meta.description } : {}),
        flags,
        positionals,
        subCommands,
        hasDefaultRun: typeof cmd.run === 'function'
    };
}
