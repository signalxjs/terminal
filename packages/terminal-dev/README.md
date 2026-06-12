# @sigx/terminal-dev

HMR dev runner for [SignalX terminal](https://github.com/signalxjs/terminal) apps: run your TUI under an in-process Vite dev server, save a component file, and watch the **running** terminal app update in place — no restart, no lost state.

```bash
pnpm add -D @sigx/terminal-dev
```

## Usage

```bash
sigx-terminal-dev                  # auto-detects src/main.tsx etc.
sigx-terminal-dev src/main.tsx
sigx-terminal-dev --root path/to/app
sigx-terminal-dev --config vite.config.ts   # layer a vite config on top
```

Point it at the module that mounts your app:

```tsx
/** @jsxImportSource @sigx/runtime-core */
// src/main.tsx — the "mount module"
import { defineApp, terminalMount } from '@sigx/terminal';
import { App } from './App';

defineApp(<App />).mount({ fullscreen: true }, terminalMount);
```

- **Edit a component module** (a file that calls `component(...)`, like `App.tsx`): just that module re-executes; every live instance re-runs the new setup against its existing context and re-renders in place. The terminal never tears down, and state outside the edited setup (parent components, stores, module-level signals elsewhere) survives.
- **Edit the mount module** (or a module nothing accepts): the app restarts in-process — clean terminal teardown, module cache dropped, entry re-imported.
- **Break the build**: the error is reported (above the live region while mounted); the next successful save recovers automatically.
- **Quit with Ctrl+C**: the dev process exits 0 — quitting the app is the normal end of a dev session, so wrappers like pnpm scripts don't report a failure. (Raw mode delivers Ctrl+C to the app as a key; the app's conventional exit 130 is translated by the bin. Other exit codes pass through.)

Your app's `tsconfig.json` needs the usual SignalX JSX setup (`"jsx": "react-jsx"`, `"jsxImportSource": "@sigx/runtime-core"` — or the `@sigx/terminal` facade).

## Programmatic API

```ts
import { startDev } from '@sigx/terminal-dev';

const handle = await startDev({
    entry: 'src/main.tsx',
    root: process.cwd(),
    onError: (err) => { /* entry failed to (re)start */ },
    onRestart: () => { /* entry (re)started */ },
});
// handle.server (ViteDevServer), handle.runner (ModuleRunner)
await handle.restart();   // manual in-process restart
await handle.close();
```

For custom Vite setups there is `terminalDevPlugin()` (the plugin that injects HMR identity registration + self-accept into component modules and keeps `@sigx/*` external for SSR) and `@sigx/terminal-dev/hmr` (the runtime that patches live component instances; injected automatically).

## How it works

- An in-process Vite dev server (middleware mode, silent) plus a [module runner](https://vite.dev/guide/api-environment) executes the app in node. `@sigx/*` packages stay out of the hot graph wherever possible, so the renderer's terminal state and the reactivity instance survive hot updates.
- The plugin gives every `component(...)` definition a stable identity (`moduleId:index`). When an edited module re-executes, the HMR runtime re-runs the new setup with each live instance's existing context, swaps `ctx.renderFn`, and calls `ctx.update()` — the contract `@sigx/runtime-core` exposes for HMR.
- Mount modules (those calling `defineApp`/`renderTerminal`/`mountTerminal`) never self-accept — re-executing one would mount a second app — so edits there surface as a full-reload, which the runner intercepts: tear down the terminal, clear the module cache, re-import the entry.

## Limitations (inherent to setup-rerun HMR)

- Signals created *inside* the edited component's setup are re-created (their state resets); state anywhere else survives.
- `onMounted` does not re-fire for already-mounted instances on a hot update.
- A stale parent that mounts *new* instances of an edited child uses the old factory until the parent itself re-renders or reloads.

## License

MIT
