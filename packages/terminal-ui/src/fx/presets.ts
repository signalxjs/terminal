/**
 * Gradient stop presets. Stops are theme tokens OR raw hex: tokens resolve
 * through `resolveColor` at render time, so token-based presets (like `sigx`)
 * re-color live when the theme changes; fixed-hex presets look the same on
 * every theme.
 */
export const GRADIENT_PRESETS = {
    sigx: ['accent', 'info', 'success'],
    rainbow: ['#ff5f5f', '#f5c518', '#3fd07f', '#34d4d4', '#4a9eff', '#c678dd'],
    sunset: ['#ff7e5f', '#feb47b', '#ffcd94'],
    ocean: ['#2193b0', '#6dd5ed', '#b8e8f4'],
    fire: ['#f12711', '#f5af19'],
} as const;

export type GradientPreset = keyof typeof GRADIENT_PRESETS;
