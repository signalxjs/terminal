import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hexToSGR, resolveFg, resolveBg, setColorDepth, redetectColorDepth } from '../src/color';

describe('color: hex -> SGR by depth', () => {
    beforeEach(() => setColorDepth('truecolor'));

    it('truecolor emits 24-bit fg/bg', () => {
        expect(hexToSGR('#7aa2f7')).toBe('\x1b[38;2;122;162;247m');
        expect(hexToSGR('#7aa2f7', { isBg: true })).toBe('\x1b[48;2;122;162;247m');
    });

    it('expands 3-digit hex', () => {
        expect(hexToSGR('#fff')).toBe('\x1b[38;2;255;255;255m');
    });

    it('ansi16 quantizes to the nearest 16-color code', () => {
        setColorDepth('ansi16');
        expect(hexToSGR('#ff0000')).toBe('\x1b[91m'); // nearest: bright red
        expect(hexToSGR('#000000')).toBe('\x1b[30m'); // nearest: black
        expect(hexToSGR('#ffffff')).toBe('\x1b[97m'); // nearest: bright white
        expect(hexToSGR('#ff0000', { isBg: true })).toBe('\x1b[101m');
    });

    it('ansi256 emits a 256-color index', () => {
        setColorDepth('ansi256');
        expect(hexToSGR('#000000')).toBe('\x1b[38;5;16m');
    });

    it('none emits nothing', () => {
        setColorDepth('none');
        expect(hexToSGR('#7aa2f7')).toBe('');
        expect(resolveFg('red')).toBe('');
    });

    it('resolveFg/resolveBg route ANSI names and hex', () => {
        setColorDepth('truecolor');
        expect(resolveFg('red')).toBe('\x1b[31m');
        expect(resolveBg('blue')).toBe('\x1b[44m');
        expect(resolveFg('#000000')).toBe('\x1b[38;2;0;0;0m');
        expect(resolveFg(undefined)).toBe('');
    });
});

describe('color: environment detection', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        setColorDepth('truecolor');
    });

    // Under vitest stdout is not a TTY, so without overrides depth is 'none'.
    it('non-TTY stdout disables color', () => {
        vi.stubEnv('FORCE_COLOR', undefined as unknown as string);
        vi.stubEnv('NO_COLOR', undefined as unknown as string);
        expect(redetectColorDepth()).toBe('none');
    });

    it('FORCE_COLOR levels override everything, including non-TTY', () => {
        vi.stubEnv('FORCE_COLOR', '0');
        expect(redetectColorDepth()).toBe('none');
        vi.stubEnv('FORCE_COLOR', '1');
        expect(redetectColorDepth()).toBe('ansi16');
        vi.stubEnv('FORCE_COLOR', '2');
        expect(redetectColorDepth()).toBe('ansi256');
        vi.stubEnv('FORCE_COLOR', '3');
        expect(redetectColorDepth()).toBe('truecolor');
        vi.stubEnv('FORCE_COLOR', 'true');
        expect(redetectColorDepth()).toBe('truecolor');
    });

    it('FORCE_COLOR beats NO_COLOR', () => {
        vi.stubEnv('NO_COLOR', '1');
        vi.stubEnv('FORCE_COLOR', '1');
        expect(redetectColorDepth()).toBe('ansi16');
    });

    it('NO_COLOR disables color', () => {
        vi.stubEnv('FORCE_COLOR', undefined as unknown as string);
        vi.stubEnv('NO_COLOR', '1');
        expect(redetectColorDepth()).toBe('none');
    });
});
