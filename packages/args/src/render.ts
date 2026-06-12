/**
 * Built-in plain-text help renderer. No ANSI, no theming — strictly the
 * default formatter for a `HelpCatalog`; themed renderers consume the catalog
 * directly instead of these strings.
 */

import type { HelpArgEntry, HelpCatalog } from './help.js';
import { camelToKebab } from './parse.js';

export interface RenderHelpOptions {
    /** Total line width for wrapping. Default 80. */
    width?: number;
}

function wrap(text: string, width: number): string[] {
    if (width <= 0) return [text];
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        if (line === '') {
            line = word;
        } else if (line.length + 1 + word.length <= width) {
            line += ` ${word}`;
        } else {
            lines.push(line);
            line = word;
        }
    }
    if (line !== '') lines.push(line);
    return lines.length > 0 ? lines : [''];
}

function twoColumn(rows: Array<[string, string]>, width: number): string[] {
    const leftWidth = Math.max(...rows.map(([left]) => left.length));
    const descIndent = 2 + leftWidth + 3;
    const lines: string[] = [];
    for (const [left, right] of rows) {
        if (right === '') {
            lines.push(`  ${left}`);
            continue;
        }
        const wrapped = wrap(right, Math.max(20, width - descIndent));
        lines.push(`  ${left.padEnd(leftWidth)}   ${wrapped[0]}`);
        for (const cont of wrapped.slice(1)) {
            lines.push(`${' '.repeat(descIndent)}${cont}`);
        }
    }
    return lines;
}

function formatDefault(value: string | number | boolean): string {
    return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function valueHint(entry: HelpArgEntry): string {
    if (entry.valueHint !== undefined) return entry.valueHint;
    if (entry.options !== undefined) return entry.options.join('|');
    return camelToKebab(entry.name);
}

function flagLabel(entry: HelpArgEntry): string {
    const short = entry.aliases.find((a) => a.length === 1);
    const prefix = short !== undefined ? `-${short}, ` : '    ';
    let label = `${prefix}--${camelToKebab(entry.name)}`;
    if (entry.type !== 'boolean') label += ` <${valueHint(entry)}>`;
    return label;
}

function description(entry: HelpArgEntry): string {
    const parts: string[] = [];
    if (entry.description !== undefined) parts.push(entry.description);
    if (entry.required) parts.push('(required)');
    if (entry.default !== undefined) parts.push(`(default: ${formatDefault(entry.default)})`);
    return parts.join(' ');
}

function positionalToken(entry: HelpArgEntry): string {
    const name = camelToKebab(entry.name);
    if (entry.kind === 'rest') return `[${name}...]`;
    return entry.required ? `<${name}>` : `[${name}]`;
}

export function renderHelp(catalog: HelpCatalog, opts: RenderHelpOptions = {}): string {
    const width = opts.width ?? 80;
    const name = catalog.path.join(' ');
    const flags = catalog.flags.filter((f) => !f.hidden);
    const positionals = catalog.positionals.filter((p) => !p.hidden);
    const subCommands = catalog.subCommands.filter((c) => !c.hidden);

    const out: string[] = [];

    let header = name;
    if (catalog.description !== undefined) header += ` — ${catalog.description}`;
    if (catalog.version !== undefined) header += ` (v${catalog.version})`;
    out.push(header, '');

    out.push('USAGE');
    if (catalog.hasDefaultRun || subCommands.length === 0) {
        const usage = [name];
        if (flags.length > 0) usage.push('[options]');
        usage.push(...positionals.map(positionalToken));
        out.push(`  ${usage.join(' ')}`);
    }
    if (subCommands.length > 0) {
        out.push(`  ${name} <command> [options]`);
    }

    if (positionals.length > 0) {
        out.push('', 'ARGUMENTS');
        out.push(...twoColumn(positionals.map((p) => [camelToKebab(p.name), description(p)]), width));
    }

    if (flags.length > 0) {
        out.push('', 'OPTIONS');
        out.push(...twoColumn(flags.map((f) => [flagLabel(f), description(f)]), width));
    }

    if (subCommands.length > 0) {
        out.push('', 'COMMANDS');
        out.push(
            ...twoColumn(
                subCommands.map((c) => [[c.name, ...c.aliases].join(', '), c.description ?? '']),
                width
            )
        );
        out.push('', `Run '${name} <command> --help' for details on a command.`);
    }

    return out.join('\n');
}
