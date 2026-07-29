# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`<Shell>` — a dashboard frame that tells its body the content box** (#106): `@sigx/terminal-ui` gains a frame with exactly one job — own the chrome and report what is left. The body is a scoped slot receiving `{ width, height }`: `<Shell title="…" tabs={TABS} activeTab={tab.value} status={STATUS}>{(pane) => <DataTable width={pane.width} height={pane.height} … />}</Shell>`. That number was previously unavailable to callers — `getTerminalSize()` reports the *terminal*, while a body needs the terminal minus whatever chrome the frame drew, which is a private detail of the frame's own layout — so five places across the sigx TUI ecosystem each hardcoded a different guess (`rows - 12`, `rows - 13`, `height: 12`, `16 /* nominal body */`, a hand-summed `mkGap(…)`). Guessing high is not a cosmetic problem: the renderer never clamps a fullscreen frame, so an over-tall one scrolls the alt screen and shears the whole dashboard. Chrome is configurable by variant (`header="boxed" | "plain" | "gradient"`, `body="boxed" | "plain"`, an optional chip tab strip, `status` and/or `hints` footers) and every row of it is charged by the segment that draws it, so the pane cannot drift out of step with the JSX. `<Shell>` deliberately owns **no state, no keys and no lifecycle** — tab switching, command palettes, view stacks, exit ordering and the non-TTY fallback stay in the app, where every dashboard wants to vary them; `activeTab` is a plain value rather than a `Model` precisely because nothing in the frame ever writes it. The pane is documented as a **budget, not a reservation**: the renderer's layout is content-driven end to end, with no clipping primitive and no way to measure an opaque child, so a body that emits more than its pane still overflows — `<Shell>` reports the box rather than pretending to enforce it.

- **`boxChrome` and `fitLines` — the frame arithmetic, headless** (#106): new pure helpers in `@sigx/terminal-zero`. `boxChrome({ border, padX, dropShadow })` returns the rows and columns a `<box>` spends on its own chrome, mirroring `drawBox` (a border is 2 rows and 2 columns, `padX` widens both sides, a drop shadow costs a column on every row plus one row underneath) — and is cross-checked against a real painted box in its tests, so a change to the renderer fails there rather than silently shifting every consumer's layout. `fitLines(lines, pane)` is the other half: fit every line to the width and the list to the height, which is how a component actually occupies the area it was given rather than hugging its content. Both are exported so an app with a hand-rolled frame gets the same numbers without adopting `<Shell>`, and `DataTable` now derives its own chrome through `boxChrome` instead of restating it as `1 + (variant === 'boxed' ? 4 : 0)`.

- **Data-dense dashboard components** (#103): `@sigx/terminal-ui` gains a `DataTable` (scrolling viewport, sortable columns, a focusable cursor), a `Sparkline`, a `Meter`, a `Trend` marker, a `BarChart`, a `DetailList` and a `StatusGrid` — all re-exported through `@sigx/terminal`. The layout, scaling and sorting maths is pure and lives in `@sigx/terminal-zero` (`layoutTable`, `scrollWindow`, `moveCursor`, `sortRows`, `columnComparator`, `naturalCompare`, `sparkline`/`sparklineRows`/`renderSparkline`, `meter`/`barCells`/`commonScale`, `fitCell`/`padCell`/`ellipsize`, `statusGrid`), so an app can use it headlessly — `printStatic(sparkline(history))` needs no mount. Designed and originally implemented by [@andtii](https://github.com/andtii), who offered it upstream; the shape here is generalised off its actor-runtime origins, but its judgement calls are kept as the defaults, because they are the valuable part. Namely: a sparkline scales from **zero**, not the series minimum (a flat line at 1000 req/s should not draw as a mountain range — `baseline="min"` opts out); the lowest level is **reserved for a value at the baseline**, so a real 1 req/s never renders as silence; **a gap is not a zero** — `null` draws as `·`, because a counter reset, an unreachable poll and an idle period are three different facts; table columns give up space from the **right**, since the leftmost is nearly always the identity; truncation is **always marked** with `…`; sorting **breaks ties on identity**, so a table re-sorted every poll does not shuffle rows that have not changed; the cursor **clamps** rather than wrapping and the viewport moves **one row** rather than a screenful; and a shared scale is an explicit input to `BarChart` rather than something derived per row, because auto-scaling each bar is exactly what destroys the comparison. Three deliberate departures from the original: widths are measured in **display cells** (`displayWidth`), so wide CJK and emoji cells stay aligned; `Trend` takes a **`polarity`** prop, since `▲` means trouble for latency and good news for throughput and hardcoding either would make the component lie about half a dashboard; and the histogram-shaped `HistogramBars`/`HistogramSnapshot` pair is generalised into `BarChart` over `{ label, value }[]`, with percentile rows becoming three items.

### Fixed

- **`Table` columns stay aligned when a cell contains wide glyphs** (#103): the static `Table` sized its columns with `String.length`, so a CJK ideograph or an emoji — two columns wide in a terminal — was counted as one, and every separator below it drifted. It now measures in display cells like the rest of the renderer. ASCII tables are unaffected. The component previously had no tests at all; it has them now.

## [0.10.0] - 2026-07-29

### Changed

- **SignalX core retargeted to the 0.14 band** (#108). The `catalog:` block in `pnpm-workspace.yaml` now pins `@sigx/reactivity`, `@sigx/runtime-core` and `@sigx/vite` at `^0.14.0` (was `^0.13.0`); every package continues to reference them as `"catalog:"`, which pnpm rewrites to `^0.14.0` on `pnpm pack`/publish. **Consumers must upgrade core to 0.14.x** — a 0.13.x core no longer satisfies these ranges. This is a packaging-only change: nothing in the terminal API changed, and the single-shared-engine guarantee (one `@sigx/reactivity@0.14.x` across the workspace) is unchanged.

  Core 0.14 changes reactivity semantics in a way worth noting for renderer authors: a reactive object's **key set** is now a dependency, implemented as `ownKeys` and `has` proxy traps, so enumerating reactive state inside an effect or computed re-runs the reader when a key appears or disappears. Verified beyond the unit suite (321 tests) by running the TUI showcase against 0.14.0 — it boots, paints, navigates by keyboard, and its spinners and progress bars animate continuously with no dropped frames or stalled effects.

## [0.9.0] - 2026-07-23

### Changed

- **SignalX core retargeted to the 0.13 band** (#100). The `catalog:` block in `pnpm-workspace.yaml` now pins `@sigx/reactivity`, `@sigx/runtime-core` and `@sigx/vite` at `^0.13.0` (was `^0.12.0`); every package continues to reference them as `"catalog:"`, which pnpm rewrites to `^0.13.0` on `pnpm pack`/publish. **Consumers must upgrade core to 0.13.x** — a 0.12.x core no longer satisfies these ranges. This is a packaging-only change: nothing in the terminal API changed, and the single-shared-engine guarantee (one `@sigx/reactivity@0.13.x` across the workspace) is unchanged.

## [0.8.0] - 2026-07-18

### Changed

- **Breaking: SignalX core moves to the 0.12 band** (#93). `@sigx/reactivity` and `@sigx/runtime-core` are now pinned `^0.12.0` — as `dependencies` on `@sigx/runtime-terminal` / `@sigx/terminal`, and as `peerDependencies` on `@sigx/terminal-zero`, `@sigx/terminal-ui` and `@sigx/terminal-dev` (runtime-core). **Consumers must upgrade core to 0.12.x**; a 0.10.x/0.11.x core no longer satisfies these ranges. Nothing in the terminal API changed: core 0.11 made the renderer namespace-agnostic (three new *optional* `RendererOptions` host ops — `getElementNamespace`/`getChildNamespace`/`getContainerNamespace` — and an `isSVG`→`ns` positional rename with positions unchanged), which a TUI renderer with no XML namespaces neither implements nor is affected by; core 0.12 is additive (the new `@sigx/server` package) and touches nothing here. The `declareLiveClient()` live-client declaration keeping `useData`/`useStream` working in the windowless runtime is unchanged and still verified by `runtime-terminal`'s `live-client` test. `@sigx/vite` also moves to `^0.12.0`, tracking the core line.

- **The SignalX core version is now managed through a pnpm `catalog`** (#93). `pnpm-workspace.yaml` declares `@sigx/reactivity` and `@sigx/runtime-core` at `^0.12.0` in a top-level `catalog:` block; every package references them as `"catalog:"`, which pnpm rewrites to `^0.12.0` on `pnpm pack`/publish. This gives the workspace a single source of truth for the core version (no more per-package range drift) while keeping the single-shared-engine guarantee — every terminal package resolves to one `@sigx/reactivity@0.12.x`.

## [0.7.0] - 2026-07-16

### Changed

- **Breaking: SignalX core moves to the 0.10 band** (#87). `@sigx/reactivity` and `@sigx/runtime-core` are now pinned `>=0.10.0 <0.11.0` — as `dependencies` on `@sigx/runtime-terminal` / `@sigx/terminal`, and as `peerDependencies` on `@sigx/terminal-zero`, `@sigx/terminal-ui` and `@sigx/terminal-dev`. **Consumers must upgrade core to 0.10.x**; a 0.6.x core no longer satisfies these ranges. Nothing in the terminal API changed — core's breaking changes across 0.7.0–0.10.0 (slot-presence semantics, the `useAsync`/`<Suspense>`/`<ErrorBoundary>` removals) touch no code in this repo, and the renderer contract is unchanged apart from an optional trailing `appContext` on `patchProp`. `@sigx/vite` also moves to `^0.10.0`.

- **Terminal apps no longer need a per-file `/** @jsxImportSource @sigx/terminal */` pragma** (#78): `terminalDevPlugin()` (`@sigx/terminal-dev`) now configures the oxc JSX transform itself (`runtime: 'automatic'`, `importSource: '@sigx/terminal'`) for both `serve` and `build`, so `.tsx` run through the dev runner compile against the terminal runtime with zero per-file boilerplate — matching how `sigx` (web) configures it in Vite and `@sigx/lynx` (native) does in its plugin. A file that still carries its own pragma keeps working (oxc honors the pragma over the config). For editors and `tsc`, set `"jsxImportSource": "@sigx/terminal"` in `tsconfig.json`; the repo examples now do exactly this (and carry no pragma). The internal package sources (`@sigx/terminal-zero`, `@sigx/terminal-ui`) keep their `@sigx/runtime-core` pragma until `@sigx/vite`'s library builder exposes a configurable import source.

### Fixed

- **`useData` / `useStream` now actually fetch in a TUI** (#87): `@sigx/runtime-terminal` declares itself a live client via core 0.10's new `declareLiveClient()`. Core otherwise infers "live client" from `typeof window !== 'undefined'` — a check that keeps server renders safe but reads as `false` in a terminal, so a keyed read mounted into `pending` and silently never fetched. Since `@sigx/terminal` re-exports `useData`, any app calling it got a read that hung forever. The declaration lives in the platform-identity module, so server renders keep the `window` inference.

## [0.6.2] - 2026-06-17

### Changed

- **`@sigx/terminal` and `@sigx/runtime-terminal` now declare SignalX core as `dependencies`, not `peerDependencies`** (#72): `@sigx/reactivity` and `@sigx/runtime-core` moved back from `peerDependencies` to `dependencies` (`>=0.6.0 <0.7.0`) in the terminal umbrella (`@sigx/terminal`) and its renderer (`@sigx/runtime-terminal`). This makes `npm install @sigx/terminal` bring the reactive engine on its own — consistent with the `sigx` (web) and `@sigx/lynx` (native) umbrellas and the `@sigx/runtime-lynx` renderer, and no longer requiring the explicit `npm install @sigx/terminal @sigx/reactivity @sigx/runtime-core` that older docs spelled out. The single-shared-engine guarantee is preserved: a terminal app installs exactly one umbrella, which owns one copy of core. The satellite component libraries `@sigx/terminal-zero` and `@sigx/terminal-ui` keep core as `peerDependencies` — they must agree on the core the app's umbrella provides (the case `peerDependencies` actually exists for, see #64).

## [0.6.1] - 2026-06-12

Ships the core-dependency fix on npm: v0.6.0 was published with the old hard-pinned `^0.4.9` core dependencies; this release actually delivers the `peerDependencies` change below.

### Changed

- **SignalX core packages are now `peerDependencies`** (#64): `@sigx/reactivity` and `@sigx/runtime-core` moved from `dependencies` to `peerDependencies` (`>=0.6.0 <0.7.0`) in `@sigx/runtime-terminal`, `@sigx/terminal-zero`, `@sigx/terminal-ui`, `@sigx/terminal`, and `@sigx/terminal-dev` (runtime-core). Previously each companion package hard-pinned core with a 0.x caret range (`^0.4.9`) that cannot overlap with the range pinned by other companions or by `sigx` itself — consumers mixing versions silently got **duplicate reactivity engines** (signals from one engine invisible to the other's effects). With peers, the consumer's package manager resolves a single shared core instance. Internal sibling dependencies between the terminal packages remain regular `dependencies`. The workspace builds and the full test suite now run against core 0.6. **Consumers must install the core packages themselves** (most already do, via `sigx` or direct deps); npm 7+ auto-installs peers.

## [0.6.0] - 2026-06-12

New package: `@sigx/args` — fluent, type-aware command & argument parser for CLIs.

### Added

- **`@sigx/args` — fluent, type-aware command & argument parser** (#60, #63): commands chain from `command(name)` (`.describe()`, `.version()`, `.args()`, `.subcommands()`, `.run()`) and args are declared with chainable `a.*` builders (`a.number().alias('p').required()` — string/number/boolean/enum, positionals, variadic rest, defaults, `--no-x` negation) whose type-state drives compile-time inference of the handler's `ctx.args`; invalid refiner combinations don't typecheck. Nested subcommands with aliases; automatic `--help`/`--version`; a headless `HelpCatalog` data model with a built-in plain-text renderer (themed TUI renderers can consume the catalog directly); typed `ParseError` codes for programmatic error rendering; `runMain` for binaries, a throwing `runCommand` for embedding (e.g. the sigx CLI shell), and a headless `parseArgs(argv, shape)`. Zero runtime dependencies, platform-neutral.

## [0.5.1] - 2026-06-12

New package: `@sigx/terminal-dev` — HMR dev mode for terminal apps. (Its `0.5.0` was briefly published and unpublished while bootstrapping npm trusted publishing; npm burns published version numbers, hence the lockstep patch bump.)

### Added

- **`@sigx/terminal-dev` — HMR dev mode** (#45): `sigx-terminal-dev <entry>` (and root `pnpm dev` for the showcase) runs a terminal app under an in-process Vite dev server with hot module replacement. Saving a component module patches live instances in place (new setup re-runs against the existing context, the renderer repaints — no teardown, surrounding state intact); saving the mount module (or a module nothing accepts) restarts the app in-process with a clean terminal teardown first; a broken edit reports the error and recovers on the next successful save. Ships a `terminalDevPlugin()` Vite plugin, a programmatic `startDev()`, and an HMR runtime (`@sigx/terminal-dev/hmr`) that hooks `@sigx/runtime-core` component definitions.

### Fixed

- **`sigx-terminal-dev`: quitting the app with Ctrl+C no longer fails the dev process** (#48): raw mode delivers Ctrl+C to the app as a key (the renderer exits 130, the SIGINT convention) instead of signalling the process group, so wrappers like pnpm reported `ELIFECYCLE … exit code 130`. The bin now treats the app's Ctrl+C exit as a clean end of the dev session and exits 0; real failure codes pass through unchanged.
- **HMR: edits no longer lost when navigating away and back** (#50): hot updates only patched live instances, so a parent that captured the component reference before the edit (a tab catalog, a navigation view) kept mounting the OLD factory — switching tabs reverted the edit, and editing a hidden tab's component never showed. Every factory now mounts through a per-identity setup trampoline, and a redefine swaps the trampoline's target — so remounts through stale references mount the edited version.
- **Publish script no longer hijacks an `npm login` session** (#52): a stale `NPM_TOKEN` environment variable made the script rewrite `~/.npmrc` with that token. All token plumbing is gone — the script uses ambient auth (local `npm login`, or trusted publishing in CI) and never touches `~/.npmrc`.

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
