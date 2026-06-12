# @sigx/args

Fluent, type-aware command & argument parser for CLIs — the arg builders you
chain drive the types your handler receives. Zero runtime dependencies,
platform-neutral, 100% TypeScript.

```bash
pnpm add @sigx/args
```

## Quick start

```ts
import { a, command, runMain } from '@sigx/args';

const dev = command('dev')
    .describe('Start the dev server')
    .args({
        entry: a.positional().required().describe('Entry file'),
        port: a.number().alias('p').required().describe('Port to listen on'),
        host: a.string().default('localhost').describe('Host name'),
        mode: a.enum(['dev', 'prod']).describe('Build mode'),
        open: a.boolean().describe('Open the browser')
    })
    .run((ctx) => {
        ctx.args.entry; // string            (required → non-optional)
        ctx.args.port;  // number            (required → non-optional)
        ctx.args.host;  // string            (default → non-optional)
        ctx.args.mode;  // 'dev' | 'prod' | undefined
        ctx.args.open;  // boolean | undefined
        ctx.args._;     // string[]          (everything after `--`, verbatim)
    });

const main = command('sigx').version('1.0.0').describe('SignalX CLI').subcommands({ dev });

await runMain(main);
```

`--help`/`-h` is handled automatically at every level — `sigx --help`,
`sigx dev --help` — and `--version` at the root when `.version()` is set.
The spellings `help` and `h` (and `version`, when `.version()` is set) are
reserved: declaring an arg with one of those names or aliases throws a
`DefinitionError`.

## Arg builders

| Builder | Parses | Inferred type |
| --- | --- | --- |
| `a.string()` | `--name value`, `--name=value` | `string` (`\| undefined` unless `.required()`/`.default()`) |
| `a.number()` | finite numbers, incl. negative | `number` |
| `a.boolean()` | `--flag`, `--flag=false`, `--no-flag` | `boolean` |
| `a.enum(['a', 'b'])` | exact member match | `'a' \| 'b'` |
| `a.positional()` | non-flag tokens, declaration order | `string` |
| `a.rest()` | remaining positional tokens | `string[]` (always present) |

Refiners chain; each returns a new builder (they're immutable, so a base
builder can be shared and re-refined safely):

| Refiner | On | Effect |
| --- | --- | --- |
| `.required()` | all but rest | non-optional; parse fails when absent |
| `.default(v)` | all but rest | non-optional; `v` is type-checked (an enum default must be one of its options) |
| `.multiple()` | string, number, enum | repeatable flag → array, always present (`[]` if absent) |
| `.alias('p', …)` | flags | alternate names; single characters become short flags (`-p`) |
| `.negatable(false)` | boolean | disable the automatic `--no-x` negation |
| `.describe(text)` / `.valueHint(hint)` / `.hidden()` | all | help output |

Invalid combinations don't typecheck: the refiner either doesn't exist on
that builder (`a.boolean().multiple()`, `a.positional().alias()`) or the
chain is rejected (`a.string().default('x').required()`). The same rules are
enforced at runtime for untyped callers.

The command chain: `command(name)` → `.describe()`, `.version()`,
`.aliases()`, `.hidden()`, `.allowUnknownFlags()`, `.args({...})` (once),
`.subcommands({...})`, and finally `.run(handler)`. There is no `.build()` —
a group without a handler is passed to `runMain` as-is, and `.run()` is
terminal: it returns the finished `Command`, so declare `.args()` and
`.subcommands()` before it.

## Parsing rules

- `--flag value`, `--flag=value`, short `-p value` / `-p=value`, boolean
  clusters `-abc`.
- Kebab and camel spellings both resolve: `--dry-run` and `--dryRun` hit the
  `dryRun` key.
- Booleans never consume the next token; a flag-looking token is never read as
  a value (`--port --open` is `MISSING_VALUE`, not a silent swallow). Negative
  numbers (`-2`) are values.
- Bare `--` ends flag parsing; the remainder lands verbatim in `args._`.
- Unknown flags throw by default; set `.allowUnknownFlags()` per command to
  collect them into `ctx.unknownFlags` instead. An unknown `--flag value` pair
  is collected together (mirroring known-flag value binding) so positional
  binding doesn't shift — use `=` or `--` when a following token must stay
  positional.
- Repeated flags: `.multiple()` appends, otherwise last wins.

Parse failures throw a typed `ParseError` with a machine-readable `code`
(`UNKNOWN_FLAG`, `MISSING_REQUIRED`, `INVALID_ENUM`, …) and structured
`detail` (`arg`, `received`, `expected`, `command`) so hosts can render rich
error UI without string matching. Definition bugs (alias collisions, a
required positional after an optional one, …) throw `DefinitionError` eagerly
from `.args()`.

## Headless parsing

`parseArgs(argv, shape)` parses against a record of builders without any
command — same inference, same validation:

```ts
import { a, parseArgs } from '@sigx/args';

const { args } = parseArgs(process.argv.slice(2), {
    port: a.number().required(),
    verbose: a.boolean()
});
args.port; // number
```

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
