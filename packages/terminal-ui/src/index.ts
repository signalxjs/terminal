/**
 * @sigx/terminal-ui — the SigX-tui design-system skin for SignalX terminal UIs.
 *
 * Styled components organized by semantic category (buttons, forms, feedback,
 * navigation, layout, data), built on the @sigx/terminal-zero foundation.
 * Importing this package registers the five SigX-tui themes (default: obsidian).
 */

// Register the built-in themes (side effect) and expose the theme API.
export * from './theme';

// Components by category.
export * from './buttons';
export * from './forms';
export * from './feedback';
export * from './navigation';
export * from './layout';
export * from './data';
export * from './fx';
export * from './tasks';
export * from './prompts';
