# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
