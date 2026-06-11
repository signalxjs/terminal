/** @jsxImportSource @sigx/runtime-core */
/**
 * Shared clack-style chrome for the imperative prompts:
 *
 *   ◆ Project name              ← state glyph + message
 *   │ my-sigx-app▌              ← body rows (promptRow)
 *   └ hint or error             ← footer closes the bar
 *
 * Plain vnode-building helpers (not components) — each prompt composes them
 * inside its own render function.
 */
import { resolveColor } from '@sigx/terminal-zero';

export interface FrameOptions {
    message: string;
    rows: unknown[];
    /** Dim guidance under the bar; replaced by `error` when set. */
    footer?: string;
    /** Validation error — switches the glyph to ▲ danger. */
    error?: string;
}

export function promptFrame(opts: FrameOptions) {
    const hasError = !!opts.error;
    return (
        <box>
            <box>
                <text color={resolveColor(hasError ? 'danger' : 'accent')}>{hasError ? '▲' : '◆'}</text>
                <text color={resolveColor('fg')}> {opts.message}</text>
            </box>
            {opts.rows}
            <box>
                <text color={resolveColor('line')}>└ </text>
                {hasError
                    ? <text color={resolveColor('danger')}>{opts.error}</text>
                    : opts.footer
                        ? <text color={resolveColor('dim')}>{opts.footer}</text>
                        : null}
            </box>
        </box>
    );
}

/** One body row behind the `│` gutter. */
export function promptRow(children: unknown) {
    return (
        <box>
            <text color={resolveColor('line')}>│ </text>
            {children}
        </box>
    );
}
