// Importing this module registers the five SigX-tui themes (side effect) and
// re-exports the engine API for convenience.
import './builtins';

export { THEMES } from './builtins';
export {
    setTheme,
    getTheme,
    getActiveTheme,
    registerTheme,
    hasTheme,
    listThemes,
    resolveColor,
    applyThemeCanvas,
    disableThemeCanvas,
    type Theme,
} from '@sigx/terminal-zero';
