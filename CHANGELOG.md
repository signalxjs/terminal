# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`@sigx/terminal-dev` — HMR dev mode** (#45): `sigx-terminal-dev <entry>` (and root `pnpm dev` for the showcase) runs a terminal app under an in-process Vite dev server with hot module replacement. Saving a component module patches live instances in place (new setup re-runs against the existing context, the renderer repaints — no teardown, surrounding state intact); saving the mount module (or a module nothing accepts) restarts the app in-process with a clean terminal teardown first; a broken edit reports the error and recovers on the next successful save. Ships a `terminalDevPlugin()` Vite plugin, a programmatic `startDev()`, and an HMR runtime (`@sigx/terminal-dev/hmr`) that hooks `@sigx/runtime-core` component definitions.

## [0.5.0] - 2026-06-12

First lockstep release of the four-package design system. New packages: `@sigx/terminal-zero` (headless foundation) and `@sigx/terminal-ui` (SigX-tui skin).

### Added

- **Component library split**: `terminal-zero` (token contract, theme engine + `resolveColor`, glyphs/focus, layout primitives) and `terminal-ui` (themed components in category folders, 5 built-in themes, default obsidian). Components moved out of `runtime-terminal` and reskinned to tokens.
- **Render modes** (`runtime-terminal`): `mode: 'inline' | 'fullscreen'` — inline live region with persisted final frame (and `persistOnExit: false` for one-shot UIs), alt-screen fullscreen with exit-signal safety, `writeStatic`/`printStatic` transcript output with console patching, non-TTY plain-text fallback, `FORCE_COLOR`/`NO_COLOR`/TTY-aware color depth, SIGWINCH resize with reactive `getTerminalSize()`, injectable `OutputTarget`, `dispatchKey`, synchronized-output frames (DEC 2026) with atomic static bursts.
- **Layered key dispatch**: `onKey(handler, { layer })` with `overlay | control | view | global` layers; strictly-`true` returns consume; Tab/Shift+Tab focus cycling became the first global handler.
- **Typography & layout**: `Text` (inline token-aware span with `bold`/`faint`/`italic`/`underline`/`lineThrough`/`inverse`), `Heading`, renderer SGR text attributes, `Row` (real horizontal layout) with `start|center|end` align, `Col` `gap`, `Spacer` fix.
- **Prompt kit**: imperative `text`/`password`/`select`/`multiselect`/`confirm` + `intro`/`outro`/`note`/`cancel`/`spinner`, collapse-to-`◇`-transcript, Esc/Ctrl+C → `CANCEL` symbol (`isCancel`), non-TTY initialValue fallback; headless engine in `terminal-zero/prompts`.
- **Components**: `TextArea` (growing multi-line editor on the headless `textBuffer`), `SuggestionList`, `MultiSelect` (group headers), `Confirm`, `KeyHints`, `LogPanel`, scrollable `LogView`, `TaskList` + `createLogStore`/`collapseTask`, `QRCode` (+ `generateQR`), `PixelArt`, `Gradient`/`Shimmer`/`Banner` fx, `Spinner` variants, `ProgressBar` variants, shared animation ticker, `createViewStack`.
- **Examples**: showcase (FX/Tasks/Typography pages), inline-counter, static-log, build-sim, create-wizard, dev-dashboard, claude-shell — all written purely against the component layer.
- **Tooling**: lockstep version enforcement (`pnpm version:check`, bump/publish guards).

## [0.4.4] - 2026-05-13

### Changed

- Bump `@sigx/reactivity` and `@sigx/runtime-core` peer/runtime dependencies to `^0.4.7` to pick up [signalxjs/core#22](https://github.com/signalxjs/core/pull/22), which preserves a component's `cleanup` closure through same-type parent re-render patches. This was the actual root cause of the `sigx create` wizard's duplicated Select on the Done step / "Directory already exists" error — the previous `0.4.3` `untrack` hardening and `0.4.6` reactivity re-entrancy guard were defensive against the symptom; this is the fix.

## [0.4.3] - 2026-05-13

### Fixed

- `runtime-terminal`: focus helpers (`registerFocusable`, `unregisterFocusable`, `focus`, `focusNext`, `focusPrev`) now wrap their `focusState` reads and writes in `untrack(...)` so they no longer leak `focusState.activeId` as a dependency to whatever effect happens to be on the stack. Without this, a child component's `onUnmounted` calling `unregisterFocusable` during a parent's render-effect patch could re-trigger the parent effect mid-patch and stack two subtrees on top of each other (visible in the `sigx create` wizard as a duplicated Done screen and a spurious "folder already exists" error). Pairs with the `@sigx/reactivity@0.4.6` re-entrancy guard.

### Changed

- Bump `@sigx/reactivity` and `@sigx/runtime-core` peer/runtime dependencies to `^0.4.6` so consumers automatically pick up the companion core-level fix.

## [0.4.2] - 2026-05-13

### Fixed

- `Button` now ignores keystrokes for 50ms after mount, matching the existing cooldown in `Input` and `Select`. Prevents an Enter press that submitted the previous focusable from immediately clicking a freshly-mounted button (e.g. the Exit button on `sigx create`'s Done screen).

## [0.4.1] - 2026-05-11

### Added

- Initial release of `@sigx/terminal` and `@sigx/runtime-terminal` from the dedicated `signalxjs/terminal` repository.
- Built-in TUI components: `Input`, `Button`, `Select`, `Checkbox`, `ProgressBar`.
- Type declarations are now shipped for both packages (`tsgo --emitDeclarationOnly`). Prior published versions (≤ 0.3.x) had no `.d.ts` files.

### Changed

- `@sigx/reactivity` and `@sigx/runtime-core` are now consumed from npm (`^0.4.0`) instead of via workspace links to the core monorepo.
