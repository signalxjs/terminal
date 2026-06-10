import { describe, it, expect, beforeEach } from 'vitest';
import { setColorDepth } from '@sigx/runtime-terminal';
import { resolveColor, registerTheme, setTheme, getTheme, type Theme } from '../src/theme';

const demo: Theme = {
    name: 'Demo', mode: 'dark',
    bg: '#000000', panel: '#111111', chrome: '#000000', line: '#222222',
    fg: '#cccccc', dim: '#888888', faint: '#444444', shadow: '#000000',
    accent: '#7aa2f7', accentSoft: '#283250', accentText: '#000000', selSoft: '#272d44',
    success: '#00ff00', warn: '#ffff00', danger: '#ff0000', info: '#00ffff',
    black: '#000000', red: '#ff0000', green: '#00ff00', yellow: '#ffff00',
    blue: '#0000ff', magenta: '#ff00ff', cyan: '#00ffff', white: '#ffffff',
};

describe('resolveColor — the semantic half of the pipeline', () => {
    beforeEach(() => {
        registerTheme('demo', demo);
        setTheme('demo');
        setColorDepth('truecolor');
    });

    it('resolves a token to the theme hex in truecolor', () => {
        expect(resolveColor('accent')).toBe('#7aa2f7');
        expect(resolveColor('danger')).toBe('#ff0000');
    });

    it('passes a raw hex through unchanged', () => {
        expect(resolveColor('#abcdef')).toBe('#abcdef');
    });

    it('degrades a non-ANSI token to its FALLBACK_ALIAS name in ansi16', () => {
        setColorDepth('ansi16');
        expect(resolveColor('accent')).toBe('cyan');
        expect(resolveColor('danger')).toBe('red');
        expect(resolveColor('fg')).toBe('white');
    });

    it('keeps an ANSI core token as its own name in ansi16', () => {
        setColorDepth('ansi16');
        expect(resolveColor('red')).toBe('red');
        expect(resolveColor('blue')).toBe('blue');
    });

    it('setTheme switches the active theme', () => {
        expect(getTheme()).toBe('demo');
        registerTheme('demo2', { ...demo, accent: '#123456' });
        setTheme('demo2');
        expect(resolveColor('accent')).toBe('#123456');
    });

    it('throws on an unknown theme id', () => {
        expect(() => setTheme('nope')).toThrow();
    });
});
