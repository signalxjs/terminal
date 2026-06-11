import { describe, it, expect } from 'vitest';
import { generateQR } from '../src/shared/qr';

const QR_CHARS = /^[█▀▄ ]*$/;

describe('generateQR (terminal half-block QR encoder)', () => {
    it('produces uniform-width lines of QR block characters only', () => {
        const lines = generateQR('https://example.com/some/path').split('\n');
        const width = lines[0].length;
        for (const line of lines) {
            expect(line.length).toBe(width);
            expect(QR_CHARS.test(line)).toBe(true);
        }
    });

    it('renders the quiet zone and the top-left finder pattern', () => {
        const lines = generateQR('https://sigx.dev').split('\n');
        // 4 quiet modules = 2 blank terminal rows top and bottom.
        expect(lines[0].trim()).toBe('');
        expect(lines[1].trim()).toBe('');
        expect(lines[lines.length - 1].trim()).toBe('');
        // First content row starts the 7-module finder: █▀▀▀▀▀█ after 4 quiet cells.
        expect(lines[2].slice(4, 11)).toBe('█▀▀▀▀▀█');
    });

    it('is deterministic — pinned output for a fixed input (drift lock)', () => {
        expect(generateQR('https://sigx.dev')).toBe(
            '                             \n' +
            '                             \n' +
            '    █▀▀▀▀▀█ ▀▄▄█▄ █▀▀▀▀▀█    \n' +
            '    █ ███ █ ▀█ ██ █ ███ █    \n' +
            '    █ ▀▀▀ █ ▀▄█▄▄ █ ▀▀▀ █    \n' +
            '    ▀▀▀▀▀▀▀ ▀ █ █ ▀▀▀▀▀▀▀    \n' +
            '    █▀▀█▀▄▀██▀ ▀▀█▄█▄█▄█▄    \n' +
            '      █▀  ▀▄▄▄█▀▀█▀▀▄▄█▀     \n' +
            '      ▀▀ ▀▀▀▀▀▀▀ ▀▀▄██▄ █    \n' +
            '    █▀▀▀▀▀█ ▀▄▀ ██▀█▄▄█▀     \n' +
            '    █ ███ █ █ ▀▄  █▀█▀▄▄     \n' +
            '    █ ▀▀▀ █ █▀▀█▀█ ▀▄▄█      \n' +
            '    ▀▀▀▀▀▀▀ ▀▀ ▀▀ ▀▀ ▀ ▀     \n' +
            '                             \n' +
            '                             ',
        );
    });

    it('invert swaps dark and light classes', () => {
        const normal = generateQR('https://sigx.dev').split('\n');
        const inverted = generateQR('https://sigx.dev', { invert: true }).split('\n');
        expect(inverted.length).toBe(normal.length);
        // The quiet zone flips from spaces to full blocks.
        expect(inverted[0].trim().length).toBeGreaterThan(0);
        expect(QR_CHARS.test(inverted[2])).toBe(true);
        expect(inverted[2]).not.toBe(normal[2]);
    });

    it('quiet: 0 shrinks the output by 8 cells and 4 rows', () => {
        const def = generateQR('https://sigx.dev').split('\n');
        const tight = generateQR('https://sigx.dev', { quiet: 0 }).split('\n');
        expect(tight[0].length).toBe(def[0].length - 8);
        expect(tight.length).toBe(def.length - 4);
    });

    it('scales up for longer payloads', () => {
        const short = generateQR('hi').split('\n');
        const long = generateQR('https://example.com/' + 'x'.repeat(180)).split('\n');
        expect(long[0].length).toBeGreaterThan(short[0].length);
    });
});
