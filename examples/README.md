# Examples

Small runnable apps, one per framework capability. Run them **from the repo
root** (after `pnpm install`):

| Command | Example | Demonstrates |
| --- | --- | --- |
| `pnpm showcase` | `showcase/` | Every component across the five themes — fullscreen (alt-screen) mode, `]`/`[` to switch pages, `t` to cycle themes |
| `pnpm wizard` | `create-wizard/` | The imperative prompt kit: `text`/`select`/`multiselect`/`confirm`, collapse-to-`◇`-transcript, Esc/Ctrl+C cancel |
| `pnpm build-sim` | `build-sim/` | A lynx-style build pipeline: `TaskList` + streaming `LogPanel` tail, steps collapsing to permanent `✔` lines |
| `pnpm inline-counter` | `inline-counter/` | Inline render mode: live region below your prompt, scrollback untouched, final frame persists on exit |
| `pnpm static-log` | `static-log/` | `printStatic` + console patching: permanent lines scrolling above a live spinner |

Each example also runs directly from its own folder:

```bash
cd examples/create-wizard
pnpm start                        # = node --import tsx src/main.tsx
```

> **Interactive examples need a real terminal (TTY).** The renderer puts stdin
> into raw mode to read each keypress. On Windows, `pnpm --filter … start` can
> swallow the TTY — the root scripts above use `cd && node` for exactly that
> reason. Use Windows Terminal rather than a piped shell.

## Variants worth trying

```bash
# Non-TTY behavior (what CI sees): plain ordered text, no escapes, no animation
node --import tsx src/main.tsx | cat

# Forced color depth on a piped run (FORCE_COLOR beats non-TTY detection)
FORCE_COLOR=1 node --import tsx src/main.tsx | cat    # nearest-ANSI-16
FORCE_COLOR=2 node --import tsx src/main.tsx | cat    # 256-color
FORCE_COLOR=3 node --import tsx src/main.tsx | cat    # truecolor

# build-sim failure path: the full captured log flushes into scrollback above ✖
BUILD_SIM_FAIL=1 pnpm build-sim                        # exits 1

# create-wizard: press Esc or Ctrl+C at any prompt → graceful ■ cancel, exit 130
pnpm wizard
```

All prompts in `create-wizard` carry `initialValue`s, so its piped run doubles
as the non-TTY fallback check — every prompt answers itself and prints the
transcript.
