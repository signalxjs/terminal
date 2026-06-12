# @sigx/terminal

[![npm](https://img.shields.io/npm/v/@sigx/terminal.svg?label=%40sigx%2Fterminal&color=blue)](https://www.npmjs.com/package/@sigx/terminal)
[![license](https://img.shields.io/npm/l/@sigx/terminal.svg)](./LICENSE)
[![ci](https://github.com/signalxjs/terminal/actions/workflows/ci.yml/badge.svg)](https://github.com/signalxjs/terminal/actions/workflows/ci.yml)

**SignalX Terminal** — a TUI framework with TSX support built on the [SignalX](https://sigx.dev/core/) reactivity system.

> 🚧 Early public release (`0.4.x`). API is small and stabilising.

## 📚 Documentation

Full guides, API reference and live examples → **<https://sigx.dev/terminal/>**

## Packages

| Package | Description |
| --- | --- |
| [`@sigx/terminal`](./packages/terminal) | Public entry: re-exports reactivity, runtime-core and the terminal renderer + components. Set `jsxImportSource: "@sigx/terminal"` to use TSX. |
| [`@sigx/runtime-terminal`](./packages/runtime-terminal) | The terminal renderer: render modes, key dispatch, color depth, output targets. |
| [`@sigx/terminal-zero`](./packages/terminal-zero) | Headless design-system foundation: theme engine, token contract, layout primitives, prompts engine. |
| [`@sigx/terminal-ui`](./packages/terminal-ui) | Themed component library (SigX-tui skin): forms, feedback, navigation, data, fx, tasks. |
| [`@sigx/terminal-dev`](./packages/terminal-dev) | HMR dev runner: `sigx-terminal-dev` runs your app under Vite — save a component, the running TUI updates in place. |
| [`@sigx/args`](./packages/args) | Fluent, type-aware command & argument parser: chainable arg builders drive the handler's `ctx.args` types; nested subcommands, auto `--help`, headless help catalog. |

## Install

```bash
pnpm add @sigx/terminal
```

## Quick start

```tsx
/** @jsxImportSource @sigx/terminal */
import { signal, component, defineApp, Button } from '@sigx/terminal';

const App = component(() => {
    const count = signal(0);
    return () => (
        <box>
            <text>Count: {count()}</text>
            <Button label="Increment" onPress={() => count.set(count() + 1)} />
        </box>
    );
});

defineApp(App).mount();
```

## Part of SignalX

- [`sigx`](https://sigx.dev/core/) — reactivity, runtime-core, DOM renderer, SSR, Vite plugin.
- [`@sigx/cli`](https://sigx.dev/cli/) — the `sigx` CLI and `create-sigx` scaffolder.

## License

[MIT](./LICENSE)
