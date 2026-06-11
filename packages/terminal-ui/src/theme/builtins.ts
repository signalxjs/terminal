/**
 * The five SigX-tui themes. Registered with the @sigx/terminal-zero engine on
 * import; `obsidian` becomes the default. Hex values are the single source of
 * truth — the renderer degrades them to 256/16-color as needed.
 */
import { registerTheme, setTheme, applyThemeCanvas, type Theme } from '@sigx/terminal-zero';

export const THEMES: Record<string, Theme> = {
    obsidian: {
        name: 'Obsidian', mode: 'dark',
        bg: '#16161e', panel: '#1a1b26', chrome: '#13131a', line: '#2a2c3d',
        fg: '#c0caf5', dim: '#565f89', faint: '#3b4261', shadow: '#0d0d12',
        accent: '#7aa2f7', accentSoft: '#283250', accentText: '#16161e', selSoft: '#272d44',
        success: '#9ece6a', warn: '#e0af68', danger: '#f7768e', info: '#7dcfff',
        black: '#16161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
        blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#c0caf5',
    },
    nord: {
        name: 'Nord', mode: 'dark',
        bg: '#2e3440', panel: '#3b4252', chrome: '#2b303b', line: '#434c5e',
        fg: '#e5e9f0', dim: '#7b8494', faint: '#4c566a', shadow: '#21252e',
        accent: '#88c0d0', accentSoft: '#3b4860', accentText: '#2e3440', selSoft: '#3b4456',
        success: '#a3be8c', warn: '#ebcb8b', danger: '#bf616a', info: '#81a1c1',
        black: '#2e3440', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
        blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
    },
    gum: {
        name: 'Gum', mode: 'dark',
        bg: '#191724', panel: '#1f1d2e', chrome: '#16141f', line: '#2a273f',
        fg: '#e0def4', dim: '#6e6a86', faint: '#403d52', shadow: '#100e17',
        accent: '#c4a7e7', accentSoft: '#2a2438', accentText: '#191724', selSoft: '#2a273f',
        success: '#abc4a0', warn: '#f6c177', danger: '#eb6f92', info: '#9ccfd8',
        black: '#191724', red: '#eb6f92', green: '#abc4a0', yellow: '#f6c177',
        blue: '#31a1c2', magenta: '#c4a7e7', cyan: '#9ccfd8', white: '#e0def4',
    },
    paper: {
        name: 'Paper', mode: 'light',
        bg: '#faf9f5', panel: '#ffffff', chrome: '#f1efe8', line: '#e6e3da',
        fg: '#2a2733', dim: '#8b8794', faint: '#c4c0b6', shadow: '#d9d6cc',
        accent: '#5b5bd6', accentSoft: '#ecebfb', accentText: '#ffffff', selSoft: '#f1f0fb',
        success: '#2a8a4f', warn: '#b07a1a', danger: '#d1495b', info: '#1b8a9a',
        black: '#2a2733', red: '#d1495b', green: '#2a8a4f', yellow: '#b07a1a',
        blue: '#2f6feb', magenta: '#8250df', cyan: '#1b8a9a', white: '#6e7481',
    },
    classic: {
        name: 'Classic', mode: 'dark',
        bg: '#0c0e13', panel: '#11141b', chrome: '#0a0b0f', line: '#1d2129',
        fg: '#c9cdd6', dim: '#6b7280', faint: '#3a3f4b', shadow: '#000000',
        accent: '#3fd07f', accentSoft: '#10271c', accentText: '#0c0e13', selSoft: '#15211b',
        success: '#3fd07f', warn: '#f5c518', danger: '#e5484d', info: '#34d4d4',
        black: '#0c0e13', red: '#e5484d', green: '#3fd07f', yellow: '#f5c518',
        blue: '#4a9eff', magenta: '#c678dd', cyan: '#34d4d4', white: '#c9cdd6',
    },
};

for (const [id, theme] of Object.entries(THEMES)) {
    registerTheme(id, theme);
}

// The SigX-tui default.
setTheme('obsidian');

// Auto-paint the themed screen canvas from the active theme. Reacts to runtime
// setTheme/setColorDepth. Call disableThemeCanvas() to opt out (transparent /
// inline apps that don't want a themed background).
applyThemeCanvas();
