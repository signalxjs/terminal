/**
 * Shared key predicates for prompt input. Constants are built with
 * fromCharCode so no raw control bytes live in source. Esc is detected by
 * exact match: Node delivers complete escape sequences per data event, so a
 * lone ESC byte is the Esc key, while arrows arrive as multi-byte chunks.
 */
const ESC = String.fromCharCode(27);
const CTRL_C = String.fromCharCode(3);
const DEL = String.fromCharCode(127);
const BS = String.fromCharCode(8);

export const isEnter = (key: string): boolean => key === '\r' || key === '\n';
export const isSpace = (key: string): boolean => key === ' ';
export const isEsc = (key: string): boolean => key === ESC;
export const isCtrlC = (key: string): boolean => key === CTRL_C;
/** DEL on most terminals, BS on some Windows shells. */
export const isBackspace = (key: string): boolean => key === DEL || key === BS;
export const isUp = (key: string): boolean => key === ESC + '[A';
export const isDown = (key: string): boolean => key === ESC + '[B';
export const isRight = (key: string): boolean => key === ESC + '[C';
export const isLeft = (key: string): boolean => key === ESC + '[D';
/** A single printable character (what a text field appends). */
export const isPrintable = (key: string): boolean => key.length === 1 && key >= ' ' && key !== DEL;
