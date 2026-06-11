export * from '@sigx/reactivity';
export * from '@sigx/runtime-core';
export * from '@sigx/runtime-terminal';
// Design system: headless foundation (contract, theme engine, layout primitives)
// + the SigX-tui component skin. terminal-ui re-exports the theme API and layout
// primitives from terminal-zero, so importing it surfaces them here too.
export * from '@sigx/terminal-zero';
export * from '@sigx/terminal-ui';

// Explicit re-export: runtime-core also exports a `Text` (its internal vdom
// node-type symbol), which would make the star exports ambiguous. App code
// wants the typography component; the vdom symbol stays importable from
// @sigx/runtime-core directly.
export { Text, Heading } from '@sigx/terminal-zero';
