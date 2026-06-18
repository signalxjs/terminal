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
// src/main.tsx — the "mount module"
import { defineApp, terminalMount } from '@sigx/terminal';
import { App } from './App';

defineApp(<App />).mount({ fullscreen: true }, terminalMount);
```

- **Edit a component module** (a file that calls `component(...)`, like `App.tsx`): just that module re-executes; every live instance re-runs the new setup against its existing context and re-renders in place. The terminal never tears down, and state outside the edited setup (parent components, stores, module-level signals elsewhere) survives.
- **Edit the mount module** (or a module nothing accepts): the app restarts in-process — clean terminal teardown, module cache dropped, entry re-imported.
- **Break the build**: the error is reported (above the live region while mounted); the next successful save recovers automatically.
- **Quit with Ctrl+C**: the dev process exits 0 — quitting the app is the normal end of a dev session, so wrappers like pnpm scripts don't report a failure. (Raw mode delivers Ctrl+C to the app as a key; the app's conventional exit 130 is translated by the bin. Other exit codes pass through.)

No per-file `/** @jsxImportSource … */` pragma is needed: the dev runner configures the JSX transform for your `.tsx` (importSource `@sigx/terminal`), the same way core's Vite config and lynx's plugin do. Still set the matching JSX options in your app's `tsconfig.json` (`"jsx": "react-jsx"`, `"jsxImportSource": "@sigx/terminal"`) so `tsc` and your editor typecheck against the same runtime.

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
- The plugin gives every `component(...)` definition a stable identity (`moduleId:index`). When an edited module re-executes, the HMR runtime re-runs the new setup with each live instance's existing context, swaps `ctx.renderFn`, and calls `ctx.update()` — the contract `@sigx/runtime-core` exposes for HMR. Factories previously defined under the same identity are repointed at the new setup too, so parents that captured a component reference before the edit (tab catalogs, navigation) mount the new code on the next visit.
- Mount modules (those calling `defineApp`/`renderTerminal`/`mountTerminal`) never self-accept — re-executing one would mount a second app — so edits there surface as a full-reload, which the runner intercepts: tear down the terminal, clear the module cache, re-import the entry.

## Limitations (inherent to setup-rerun HMR)

- Signals created *inside* the edited component's setup are re-created (their state resets); state anywhere else survives.
- `onMounted` does not re-fire for already-mounted instances on a hot update.

## License

MIT
