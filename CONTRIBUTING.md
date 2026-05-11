# Contributing to @sigx/terminal

Thanks for your interest! This repo holds the terminal renderer for SignalX. The framework core (reactivity, runtime, DOM, SSR, Vite plugin) lives in [`signalxjs/core`](https://github.com/signalxjs/core).

## Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0`
- **pnpm** `>=10`

## Getting started

```bash
git clone https://github.com/signalxjs/terminal.git
cd terminal
pnpm install
pnpm build
```

`build` must run before `typecheck` / `test` because `@sigx/terminal` consumes `@sigx/runtime-terminal`'s `dist/` output via the workspace.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm build` | Builds `@sigx/runtime-terminal`, then `@sigx/terminal`. |
| `pnpm typecheck` | Runs `tsgo --noEmit` across all sources. |
| `pnpm lint` | Runs `oxlint` on `packages/*/src`. |
| `pnpm test` | Runs `vitest run`. |
| `pnpm verify:pack` | Packs every public package and inspects what would ship to npm. |

## Pre-push checklist

```bash
pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm verify:pack
```

## Releasing

See [`RELEASING.md`](./RELEASING.md).

## Code style

- 4-space indentation.
- ESM-only (`"type": "module"`).
- No `default` exports for library APIs — named exports only.
- Public APIs must have explicit types.

## License

By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE).
