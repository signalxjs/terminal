# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `runtime-terminal`: layered key dispatch — `onKey(handler, { layer })` with `'overlay' | 'control' | 'view' | 'global'` layers; a handler returning strictly `true` consumes the key and stops dispatch. Built-in Tab/Shift+Tab focus cycling moved into the first `'global'` handler so overlays/controls can consume Tab first. Bare `onKey(handler)` is unchanged (default layer `'control'`, void return cascades).
- `terminal-zero`: headless `textBuffer` (soft-wrap layout + code-point cursor math for multi-line editors, wide-glyph aware) and `createViewStack` (reactive push/pop navigation with an Esc-pop pattern).
- `terminal-ui`: `TextArea` (growing multi-line input — wraps, grows to `maxRows`, movable block cursor, Enter submits, `\`+Enter / Ctrl+J newline), `SuggestionList` (overlay intellisense consuming only navigation keys), `PixelArt` / `renderPixelArt` (half-block pixel logos).
- `examples/claude-shell` (`pnpm claude-shell`): assistant-shell demo — pixel logo + scrollback transcript, `/` command intellisense, Esc-poppable model picker.

### Changed

- `terminal-ui` `Input` ignores all control bytes (a cascading Tab could previously be appended as a literal character).

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
