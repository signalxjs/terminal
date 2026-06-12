# @sigx/args

Type-aware command & argument parser for CLIs — the args schema you declare
drives the types your handler receives. Zero runtime dependencies,
platform-neutral, 100% TypeScript.

```bash
pnpm add @sigx/args
```

## Quick start

```ts
import { defineCommand, runMain } from '@sigx/args';

const dev = defineCommand({
    description: 'Start the dev server',
    args: {
        entry: { type: 'positional', required: true, description: 'Entry file' },
        port: { type: 'number', alias: 'p', required: true, description: 'Port to listen on' },
        host: { type: 'string', default: 'localhost', description: 'Host name' },
        mode: { type: 'enum', options: ['dev', 'prod'], description: 'Build mode' },
        open: { type: 'boolean', description: 'Open the browser' }
    },
    run(ctx) {
        ctx.args.entry; // string            (required → non-optional)
        ctx.args.port;  // number            (required → non-optional)
        ctx.args.host;  // string            (default → non-optional)
        ctx.args.mode;  // 'dev' | 'prod' | undefined
        ctx.args.open;  // boolean | undefined
        ctx.args._;     // string[]          (everything after `--`, verbatim)
    }
});

const main = defineCommand({
    meta: { name: 'sigx', version: '1.0.0', description: 'SignalX CLI' },
    subCommands: { dev }
});

await runMain(main);
```

`--help`/`-h` and `--version` are handled automatically at every level —
`sigx --help`, `sigx dev --help`.

## Arg types

| Def | Parses | Inferred type |
| --- | --- | --- |
| `{ type: 'string' }` | `--name value`, `--name=value` | `string` (`\| undefined` unless required/default) |
| `{ type: 'number' }` | finite numbers, incl. negative | `number` |
| `{ type: 'boolean' }` | `--flag`, `--flag=false`, `--no-flag` | `boolean` |
| `{ type: 'enum', options: ['a', 'b'] }` | exact member match | `'a' \| 'b'` |
| `{ type: 'positional' }` | non-flag tokens, declaration order | `string` |
| `{ type: 'rest' }` | remaining positional tokens | `string[]` (always present) |

Common options: `required`, `default`, `description`, `alias`
(single-character aliases become short flags like `-p`), `hidden`, `valueHint`,
`multiple` (repeatable flag → array, always present), `negatable: false`
(disable `--no-x`).

## Parsing rules

- `--flag value`, `--flag=value`, short `-p value` / `-p=value`, boolean
  clusters `-abc`.
- Kebab and camel spellings both resolve: `--dry-run` and `--dryRun` hit the
  `dryRun` key.
- Booleans never consume the next token; a flag-looking token is never read as
  a value (`--port --open` is `MISSING_VALUE`, not a silent swallow). Negative
  numbers (`-2`) are values.
- Bare `--` ends flag parsing; the remainder lands verbatim in `args._`.
- Unknown flags throw by default; set `allowUnknownFlags: true` per command to
  collect them into `ctx.unknownFlags` instead.
- Repeated flags: `multiple: true` appends, otherwise last wins.

Parse failures throw a typed `ParseError` with a machine-readable `code`
(`UNKNOWN_FLAG`, `MISSING_REQUIRED`, `INVALID_ENUM`, …) and structured
`detail` (`arg`, `received`, `expected`, `command`) so hosts can render rich
error UI without string matching. Definition bugs (alias collisions, a
required positional after an optional one, …) throw `DefinitionError` eagerly
from `defineCommand`.

## Headless help catalog

`buildHelpCatalog(cmd)` returns a fully structured `HelpCatalog` — flags,
positionals, types, requiredness, defaults, enum options, subcommands, plus
the synthesized `--help`/`--version` entries (`builtin: true`). The built-in
`renderHelp(catalog)` formats it as plain text; themed renderers (e.g. a TUI
help screen) consume the catalog directly instead of re-parsing strings.

## Embedding

`runMain` prints and sets `process.exitCode` (it never calls `process.exit`),
with injectable `rawArgs`/`stdout`/`stderr`. For hosts that render errors
themselves — an interactive shell, tests — `runCommand(cmd, { rawArgs })`
resolves, parses, runs, and throws instead of printing.

## Migrating from citty

The API mirrors citty (`defineCommand`, `meta`, `args`, `subCommands`, `run`,
`runMain`) and `@sigx/cli`'s `PluginCommand` shape is structurally valid as a
`CommandDef`. Behavioral deltas:

- `ctx.args` is fully typed from the schema — no more manual `Number(...)`
  casts.
- Positionals default to **optional**; add `required: true` where citty
  assumed it.
- Unknown flags **throw**; set `allowUnknownFlags: true` where citty's
  silent collection is needed.
