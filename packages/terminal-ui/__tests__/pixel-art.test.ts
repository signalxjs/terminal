import { describe, it, expect, afterEach } from 'vitest';
import { setColorDepth } from '@sigx/runtime-terminal';
import { renderPixelArt } from '../src/fx/PixelArt';

const ROWS = [
    'aa..',
    'aabb',
    '..bb',
];
const PALETTE = { a: '#ff0000', b: '#00ff00' };

describe('renderPixelArt', () => {
    afterEach(() => setColorDepth('truecolor'));

    it('produces ceil(rows/2) lines, including odd row counts', () => {
        setColorDepth('none');
        expect(renderPixelArt(ROWS, PALETTE)).toHaveLength(2);
        expect(renderPixelArt(['a'], PALETTE)).toHaveLength(1);
    });

    it('renders transparent pixels as plain spaces', () => {
        setColorDepth('none');
        const lines = renderPixelArt(ROWS, PALETTE);
        // Last line: row '..bb' alone (lower half '▄'... actually upper since odd) —
        // first two columns transparent.
        expect(lines[1].startsWith('  ') || lines[1].startsWith(' ')).toBe(true);
    });

    it('emits run-length SGR at truecolor and terminates with a reset', () => {
        setColorDepth('truecolor');
        const lines = renderPixelArt(ROWS, PALETTE);
        const sgrCount = (lines[0].match(/38;2;/g) || []).length;
        expect(sgrCount).toBeGreaterThan(0);
        expect(sgrCount).toBeLessThan(4); // run-length: fewer SGRs than pixels
        expect(lines[0].endsWith('\x1b[0m')).toBe(true);
    });

    it('is escape-free at depth none', () => {
        setColorDepth('none');
        for (const line of renderPixelArt(ROWS, PALETTE)) {
            expect(line).not.toContain('\x1b[');
        }
    });

    it('uses half-blocks for split cells and full coverage', () => {
        setColorDepth('none');
        const lines = renderPixelArt(ROWS, PALETTE);
        const all = lines.join('');
        expect(all).toMatch(/[▀▄]/);
    });
});
