/**
 * Cancellation marker for the imperative prompts. `Symbol.for` so duplicated
 * module instances (mixed dist/src resolution in a workspace) still agree.
 */
export const CANCEL: unique symbol = Symbol.for('sigx.prompt.cancel') as never;

/** True when a prompt result means the user cancelled (Esc / Ctrl+C). */
export function isCancel(value: unknown): value is typeof CANCEL {
    return value === CANCEL;
}
