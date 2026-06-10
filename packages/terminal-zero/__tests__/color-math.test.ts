import { describe, it, expect } from 'vitest';
import { parseHex, rgbToHex, mixHex, gradient, hueShift } from '../src/shared/colorMath';

describe('colorMath', () => {
    it('parseHex handles 6-digit, 3-digit, and invalid input', () => {
        expect(parseHex('#7aa2f7')).toEqual([122, 162, 247]);
        expect(parseHex('#fff')).toEqual([255, 255, 255]);
        expect(parseHex('fff')).toEqual([255, 255, 255]); // bare
        expect(parseHex('#gggggg')).toBeNull();
        expect(parseHex('')).toBeNull();
    });

    it('rgbToHex clamps and rounds', () => {
        expect(rgbToHex(255, 0, 128)).toBe('#ff0080');
        expect(rgbToHex(-5, 300, 127.6)).toBe('#00ff80');
    });

    it('mixHex hits endpoints and midpoint', () => {
        expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
        expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
        expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
        expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000'); // clamped
        expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff');
    });

    it('gradient samples endpoints exactly and interpolates between stops', () => {
        const g = gradient(['#000000', '#ffffff'], 3);
        expect(g).toEqual(['#000000', '#808080', '#ffffff']);

        const multi = gradient(['#ff0000', '#00ff00', '#0000ff'], 5);
        expect(multi[0]).toBe('#ff0000');
        expect(multi[2]).toBe('#00ff00'); // middle stop landed exactly
        expect(multi[4]).toBe('#0000ff');
    });

    it('gradient handles degenerate inputs without throwing', () => {
        expect(gradient(['#123456'], 3)).toEqual(['#123456', '#123456', '#123456']);
        expect(gradient([], 2)).toEqual(['#ffffff', '#ffffff']);
        expect(gradient(['#000', '#fff'], 0)).toEqual([]);
        expect(gradient(['#000000', '#ffffff'], 1)).toEqual(['#000000']);
    });

    it('hueShift rotates hue and 360° is identity', () => {
        expect(hueShift('#ff0000', 360)).toBe('#ff0000');
        expect(hueShift('#ff0000', 120)).toBe('#00ff00');
        expect(hueShift('#ff0000', 240)).toBe('#0000ff');
        expect(hueShift('#ff0000', -120)).toBe('#0000ff');
        expect(hueShift('#808080', 90)).toBe('#808080'); // gray has no hue
    });
});
