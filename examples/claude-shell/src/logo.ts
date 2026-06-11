/**
 * A little pixel mascot for the shell header — rendered with renderPixelArt
 * (half-blocks, two pixel rows per terminal line). Palette mixes theme
 * tokens (re-colors with the active theme) and fixed hex.
 */
export const LOGO_ROWS = [
    '..aaaaaaaa..',
    '.aaaaaaaaaa.',
    'aa.aa..aa.aa',
    'aaaaaaaaaaaa',
    '.aaaaaaaaaa.',
    '..aa.aa.aa..',
    '.aa..aa..aa.',
];

export const LOGO_PALETTE: Record<string, string> = {
    a: '#e8825a', // mascot body — fixed warm coral, independent of theme
};
