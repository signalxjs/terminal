# @sigx/terminal-showcase

An interactive TUI that exercises every component in the `@sigx/terminal`
design system, across all five SigX-tui themes. Mirrors the lynx `examples/`
showcase, adapted to a terminal.

## Run

```bash
pnpm install            # once, from the repo root (links workspace packages)

cd examples/showcase
node --import tsx src/main.tsx
```

Or from the repo root: `pnpm showcase`.

> **Needs a real terminal (TTY).** The renderer puts stdin into raw mode to read
> each keypress. If you launch it in a way that *pipes* stdin, keys get
> line-buffered by the terminal instead — Tab seems to do nothing and Enter
> scrolls/redraws the screen. The app now detects this and prints the fix.
>
> On Windows, `pnpm --filter … start` can swallow the TTY, so prefer the direct
> `node --import tsx src/main.tsx` command above (what `pnpm showcase` runs).

## Controls

| Key | Action |
| --- | --- |
| `]` / `[` | next / previous demo |
| `1`–`6` | jump straight to a demo |
| `t` / `T` | cycle the active theme (obsidian → nord → gum → paper → classic) |
| `Tab` / `Shift+Tab` | move focus between controls in the current demo |
| `Enter` / `Space` | activate the focused control |
| `Ctrl+C` | quit |

While a text field is focused, navigation keys type into it — `Tab` away first.

## Layout

```
src/
  main.tsx        entry: defineApp(<App/>).mount({ clearConsole: true }, terminalMount)
  App.tsx         shell: header, demo selector strip, active demo, status bar; key nav + theme cycle
  catalog.ts      ordered list of demos (single source of truth)
  demos/
    buttons.tsx     Button (focus, press, shadow)
    forms.tsx       Input, Checkbox, Select, Radio (two-way models)
    feedback.tsx    ProgressBar (live), Spinner, Badge variants
    navigation.tsx  Tabs, StatusBar
    layout.tsx      Box, Divider, Spacer, Card
    data.tsx        Table
```

This is the design-system layering in action: components come from
`@sigx/terminal-ui`, the theme engine + tokens from `@sigx/terminal-zero`, and
the renderer from `@sigx/runtime-terminal` — all re-exported through the
`@sigx/terminal` barrel.
