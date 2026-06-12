/**
 * Tokenizer + coercion + validation: turns an argv array into a typed,
 * validated args object according to an `ArgsDef` schema.
 *
 * Semantics:
 * - `--name value`, `--name=value`, kebab↔camel normalization, aliases.
 * - Booleans never consume the next token; `--no-name` negates when allowed.
 * - A flag-looking token (`-x`, but not negative numbers) is never consumed
 *   as a value — that's a MISSING_VALUE error, not silent swallowing.
 * - Short flags `-p value` / `-p=value`; clusters `-abc` of boolean shorts.
 * - Bare `--` ends flag parsing; the remainder goes verbatim into `args._`.
 * - Unknown flags throw unless `allowUnknownFlags` collects them.
 * - Repeats append for `multiple: true`, otherwise last wins.
 */

import { ParseError } from './errors.js';
import type { ArgDef, ArgsDef, ParsedArgs } from './types.js';

export interface ParseArgsOptions {
    /** Collect unknown flags instead of throwing UNKNOWN_FLAG. Default false. */
    allowUnknownFlags?: boolean;
    /** Command path used to annotate ParseError.detail.command. */
    commandPath?: string[];
}

export interface ParseResult<A extends ArgsDef> {
    args: ParsedArgs<A>;
    /** [] unless allowUnknownFlags collected something. */
    unknownFlags: string[];
}

export function kebabToCamel(name: string): string {
    return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function camelToKebab(name: string): string {
    return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

type FlagDef = Extract<ArgDef, { type: 'string' | 'number' | 'boolean' | 'enum' }>;

function isFlagDef(def: ArgDef): def is FlagDef {
    return def.type !== 'positional' && def.type !== 'rest';
}

export function aliasesOf(def: ArgDef): string[] {
    if (!isFlagDef(def) || def.alias === undefined) return [];
    return typeof def.alias === 'string' ? [def.alias] : [...def.alias];
}

/**
 * Map every accepted spelling (key, kebab-cased key, aliases) to its canonical
 * key. Collisions are a definition bug — reported by defineCommand, ignored here.
 */
function buildNameMap(argsDef: ArgsDef): Map<string, string> {
    const map = new Map<string, string>();
    for (const [key, def] of Object.entries(argsDef)) {
        if (!isFlagDef(def)) continue;
        map.set(key, key);
        map.set(camelToKebab(key), key);
        for (const alias of aliasesOf(def)) map.set(alias, key);
    }
    return map;
}

/** A token that would be read as a flag (so it can't serve as a flag's value). */
function looksLikeFlag(token: string): boolean {
    // `-2` and `-.5` are negative numbers, not flags.
    return token.length > 1 && token.startsWith('-') && !/^-(\d|\.\d)/.test(token);
}

const TRUE_WORDS = new Set(['true', '1', 'yes']);
const FALSE_WORDS = new Set(['false', '0', 'no']);

export function parseArgs<const A extends ArgsDef>(
    argv: readonly string[],
    argsDef: A,
    opts: ParseArgsOptions = {}
): ParseResult<A> {
    const command = opts.commandPath;
    const names = buildNameMap(argsDef);
    const values: Record<string, unknown> = {};
    const positionalTokens: string[] = [];
    const passthrough: string[] = [];
    const unknownFlags: string[] = [];

    const fail = (code: ConstructorParameters<typeof ParseError>[0], message: string, detail: ParseError['detail']) => {
        throw new ParseError(code, message, { ...detail, ...(command ? { command } : {}) });
    };

    const resolve = (raw: string): string | undefined =>
        names.get(raw) ?? names.get(camelToKebab(raw)) ?? names.get(kebabToCamel(raw));

    const coerce = (key: string, def: FlagDef, raw: string): string | number | boolean => {
        switch (def.type) {
            case 'number': {
                const n = Number(raw);
                if (raw.trim() === '' || !Number.isFinite(n)) {
                    fail('INVALID_NUMBER', `Invalid number '${raw}' for --${camelToKebab(key)}`, {
                        arg: key,
                        received: raw,
                        expected: 'number'
                    });
                }
                return n;
            }
            case 'enum': {
                if (!def.options.includes(raw)) {
                    const expected = def.options.join('|');
                    fail('INVALID_ENUM', `Invalid value '${raw}' for --${camelToKebab(key)} (expected ${expected})`, {
                        arg: key,
                        received: raw,
                        expected
                    });
                }
                return raw;
            }
            case 'boolean': {
                const word = raw.toLowerCase();
                if (TRUE_WORDS.has(word)) return true;
                if (FALSE_WORDS.has(word)) return false;
                fail('INVALID_BOOLEAN', `Invalid value '${raw}' for --${camelToKebab(key)} (expected true|false)`, {
                    arg: key,
                    received: raw,
                    expected: 'true|false'
                });
                return false; // unreachable — fail() throws
            }
            default:
                return raw;
        }
    };

    const assign = (key: string, def: FlagDef, value: string | number | boolean) => {
        if (def.type !== 'boolean' && def.multiple) {
            const arr = (values[key] as unknown[] | undefined) ?? [];
            arr.push(value);
            values[key] = arr;
        } else {
            values[key] = value; // repeats: last wins
        }
    };

    /**
     * Collect (or reject) an unknown flag. Without `=`, the next non-flag
     * token is collected too — mirroring how known flags take values — so an
     * unknown `--flag value` pair doesn't shift positional binding. Use `=`
     * or `--` when a following token must stay positional.
     */
    const handleUnknown = (token: string, hadEqValue: boolean, next?: () => string | undefined) => {
        if (opts.allowUnknownFlags) {
            unknownFlags.push(token);
            if (!hadEqValue && next) {
                const value = next();
                if (value !== undefined) unknownFlags.push(value);
            }
            return;
        }
        fail('UNKNOWN_FLAG', `Unknown flag '${token}'`, { received: token });
    };

    /** Bind a value to a non-boolean flag from `=value` or the next token. */
    const takeValue = (key: string, def: FlagDef, eqValue: string | undefined, next: () => string | undefined) => {
        let raw = eqValue;
        if (raw === undefined) {
            const peeked = next();
            if (peeked === undefined || looksLikeFlag(peeked)) {
                fail('MISSING_VALUE', `Flag --${camelToKebab(key)} requires a value`, { arg: key });
            }
            raw = peeked;
        }
        assign(key, def, coerce(key, def, raw as string));
    };

    let i = 0;
    const consumeNext = () => {
        const peeked = argv[i + 1];
        if (peeked === undefined || looksLikeFlag(peeked)) return undefined;
        i++;
        return peeked;
    };

    for (; i < argv.length; i++) {
        const token = argv[i];

        if (token === '--') {
            passthrough.push(...argv.slice(i + 1));
            break;
        }

        if (token.startsWith('--')) {
            const body = token.slice(2);
            const eq = body.indexOf('=');
            const rawName = eq === -1 ? body : body.slice(0, eq);
            const eqValue = eq === -1 ? undefined : body.slice(eq + 1);

            let key = resolve(rawName);
            let negated = false;
            if (key === undefined && rawName.startsWith('no-')) {
                const positive = resolve(rawName.slice(3));
                const def = positive === undefined ? undefined : argsDef[positive];
                if (positive !== undefined && def?.type === 'boolean' && def.negatable !== false) {
                    key = positive;
                    negated = true;
                }
            }
            if (key === undefined) {
                handleUnknown(token, eqValue !== undefined, consumeNext);
                continue;
            }

            const def = argsDef[key] as FlagDef;
            if (negated) {
                if (eqValue !== undefined) {
                    fail('INVALID_BOOLEAN', `--no-${camelToKebab(key)} does not take a value`, {
                        arg: key,
                        received: eqValue
                    });
                }
                values[key] = false;
            } else if (def.type === 'boolean') {
                values[key] = eqValue === undefined ? true : coerce(key, def, eqValue);
            } else {
                takeValue(key, def, eqValue, consumeNext);
            }
            continue;
        }

        if (looksLikeFlag(token)) {
            const body = token.slice(1);
            const eq = body.indexOf('=');
            const rawName = eq === -1 ? body : body.slice(0, eq);
            const eqValue = eq === -1 ? undefined : body.slice(eq + 1);

            if (rawName.length === 1) {
                const key = resolve(rawName);
                if (key === undefined) {
                    handleUnknown(token, eqValue !== undefined, consumeNext);
                    continue;
                }
                const def = argsDef[key] as FlagDef;
                if (def.type === 'boolean') {
                    values[key] = eqValue === undefined ? true : coerce(key, def, eqValue);
                } else {
                    takeValue(key, def, eqValue, consumeNext);
                }
                continue;
            }

            // Short-flag cluster: every char must be a boolean short alias.
            const keys: string[] = [];
            let valid = eqValue === undefined;
            for (const ch of rawName) {
                const key = resolve(ch);
                if (key === undefined || argsDef[key].type !== 'boolean') {
                    valid = false;
                    break;
                }
                keys.push(key);
            }
            if (!valid) {
                if (opts.allowUnknownFlags) {
                    unknownFlags.push(token);
                    continue;
                }
                fail(
                    'UNKNOWN_FLAG',
                    `Unknown flag '${token}' (short clusters like -abc may only combine boolean flags)`,
                    { received: token }
                );
            }
            for (const key of keys) values[key] = true;
            continue;
        }

        positionalTokens.push(token);
    }

    // Fill positionals in declaration order; a trailing rest takes the remainder.
    let cursor = 0;
    for (const [key, def] of Object.entries(argsDef)) {
        if (def.type === 'positional') {
            if (cursor < positionalTokens.length) values[key] = positionalTokens[cursor++];
        } else if (def.type === 'rest') {
            values[key] = positionalTokens.slice(cursor);
            cursor = positionalTokens.length;
        }
    }
    if (cursor < positionalTokens.length) {
        fail('UNEXPECTED_POSITIONAL', `Unexpected argument '${positionalTokens[cursor]}'`, {
            received: positionalTokens[cursor]
        });
    }

    // Defaults, then the required check. Absent optionals become explicit
    // `undefined` own properties so runtime shape matches ParsedArgs (every
    // schema key is present — `in` checks and key enumeration stay truthful).
    for (const [key, def] of Object.entries(argsDef)) {
        if (values[key] === undefined) {
            if (def.type === 'rest') {
                values[key] = [];
            } else if (isFlagDef(def) && def.type !== 'boolean' && def.multiple) {
                values[key] = def.default !== undefined ? [def.default] : [];
            } else if (def.default !== undefined) {
                values[key] = def.default;
            } else {
                values[key] = undefined;
            }
        }
        if (def.type !== 'rest' && def.required) {
            const value = values[key];
            const missing = value === undefined || (Array.isArray(value) && value.length === 0);
            if (missing) {
                const label = def.type === 'positional' ? `<${camelToKebab(key)}>` : `--${camelToKebab(key)}`;
                fail('MISSING_REQUIRED', `Missing required ${def.type === 'positional' ? 'argument' : 'flag'} ${label}`, {
                    arg: key
                });
            }
        }
    }

    values['_'] = passthrough;
    return { args: values as ParsedArgs<A>, unknownFlags };
}
