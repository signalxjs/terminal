/**
 * Command definition + subcommand resolution.
 *
 * `defineCommand` normalizes a definition (folds the `description` shorthand
 * into `meta`) and eagerly validates the args schema so definition bugs throw
 * at startup, not mid-parse. `resolveCommand` walks the subcommand tree by
 * matching the leading non-flag tokens against keys and aliases.
 */

import { DefinitionError, ParseError } from './errors.js';
import { aliasesOf, camelToKebab } from './parse.js';
import type { AnyCommand, ArgsDef, Command, CommandDef } from './types.js';

function validateArgs(argsDef: ArgsDef | undefined, reserved: Map<string, string>): void {
    if (!argsDef) return;
    const seen = new Map<string, string>();
    const claim = (name: string, key: string) => {
        const reservedBy = reserved.get(name);
        if (reservedBy !== undefined) {
            throw new DefinitionError(`Arg '${key}' name/alias '${name}' is reserved for the builtin ${reservedBy}`);
        }
        const owner = seen.get(name);
        if (owner !== undefined && owner !== key) {
            throw new DefinitionError(`Arg '${key}' name/alias '${name}' collides with arg '${owner}'`);
        }
        seen.set(name, key);
    };

    let optionalPositional: string | undefined;
    let restKey: string | undefined;

    for (const [key, def] of Object.entries(argsDef)) {
        if (key === '_') {
            throw new DefinitionError(`Arg key '_' is reserved for post-'--' tokens`);
        }
        if ('required' in def && def.required && 'default' in def && def.default !== undefined) {
            throw new DefinitionError(`Arg '${key}' cannot be both required and have a default`);
        }
        if (def.type === 'enum' && def.default !== undefined && !def.options.includes(def.default)) {
            throw new DefinitionError(
                `Arg '${key}' default '${def.default}' is not one of its options (${def.options.join('|')})`
            );
        }
        if (def.type === 'positional') {
            if (restKey !== undefined) {
                throw new DefinitionError(`Positional '${key}' cannot come after rest arg '${restKey}'`);
            }
            if (def.required && optionalPositional !== undefined) {
                throw new DefinitionError(
                    `Required positional '${key}' cannot come after optional positional '${optionalPositional}'`
                );
            }
            if (!def.required) optionalPositional = key;
        } else if (def.type === 'rest') {
            if (restKey !== undefined) {
                throw new DefinitionError(`Only one rest arg is allowed ('${restKey}' and '${key}')`);
            }
            restKey = key;
        } else {
            claim(key, key);
            claim(camelToKebab(key), key);
            for (const alias of aliasesOf(def)) {
                if (alias.startsWith('-')) {
                    // parseArgs strips leading dashes before resolution, so a
                    // dashed alias would silently never match.
                    throw new DefinitionError(
                        `Arg '${key}' alias '${alias}' must not include the leading dash (use '${alias.replace(/^-+/, '')}')`
                    );
                }
                claim(alias, key);
                // parseArgs resolves kebab↔camel spellings interchangeably, so
                // an alias also claims its kebab form ('dryRun' vs 'dry-run'
                // across two args would be a footgun, not two distinct flags).
                const kebab = camelToKebab(alias);
                if (kebab !== alias && !kebab.startsWith('-')) claim(kebab, key);
            }
        }
    }
}

export function defineCommand<const A extends ArgsDef>(def: CommandDef<A>): Command<A> {
    const reserved = new Map([
        ['help', '--help'],
        ['h', '-h']
    ]);
    if (def.meta?.version !== undefined) reserved.set('version', '--version');
    validateArgs(def.args, reserved);
    const meta = { ...def.meta };
    if (meta.description === undefined && def.description !== undefined) {
        meta.description = def.description;
    }
    return { ...def, meta };
}

export interface ResolvedCommand {
    cmd: AnyCommand;
    /** Command path, e.g. ['sigx', 'dev']. */
    path: string[];
    /** The argv remainder for the resolved command's own args. */
    rest: string[];
}

function findSubCommand(subCommands: Record<string, AnyCommand>, token: string): { name: string; cmd: AnyCommand } | undefined {
    const direct = subCommands[token];
    if (direct) return { name: token, cmd: direct };
    for (const [name, cmd] of Object.entries(subCommands)) {
        if (cmd.meta.aliases?.includes(token)) return { name, cmd };
    }
    return undefined;
}

/** Walk subCommands/aliases. Returns the deepest matched command + remaining argv. */
export function resolveCommand(root: AnyCommand, argv: readonly string[]): ResolvedCommand {
    let cmd = root;
    const path = [root.meta.name ?? 'cli'];
    let rest = [...argv];

    while (cmd.subCommands) {
        const token = rest[0];
        if (token === undefined || token.startsWith('-')) break;
        const match = findSubCommand(cmd.subCommands, token);
        if (!match) {
            if (cmd.run) break; // default-command: tokens are this command's own args
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
