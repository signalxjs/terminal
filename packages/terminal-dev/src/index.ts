/**
 * @sigx/terminal-dev — HMR dev runner for SignalX terminal apps.
 *
 * - `startDev()` / the `sigx-terminal-dev` bin: run an app under an
 *   in-process Vite dev server with hot component replacement.
 * - `terminalDevPlugin()`: the Vite plugin, for custom setups.
 * - `@sigx/terminal-dev/hmr`: the HMR runtime (injected automatically).
 */
export { terminalDevPlugin, type TerminalDevPluginOptions } from './plugin.js';
export { startDev, type DevOptions, type DevHandle } from './dev.js';
