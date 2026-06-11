/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted } from '@sigx/runtime-core';
import { onKey, resolveColor, READY_DELAY_MS } from '@sigx/terminal-zero';
import { CANCEL } from './cancel';
import { runPrompt } from './runPrompt';
import { promptFrame, promptRow } from './PromptShell';
import { isEnter, isEsc, isCtrlC, isBackspace, isPrintable } from './keys';

export interface TextOptions {
    message: string;
    placeholder?: string;
    initialValue?: string;
    /** Return an error string to reject the submit and keep editing. */
    validate?: (value: string) => string | undefined;
    /** Render every typed character as this string (password fields). */
    mask?: string;
}

/**
 * Single-line text prompt. Enter validates and resolves; Esc/Ctrl+C resolve
 * the CANCEL symbol (check with isCancel). Editing is end-of-line only.
 */
export function text(opts: TextOptions): Promise<string | symbol> {
    const display = (v: string) => (opts.mask ? opts.mask.repeat([...v].length) : v);
    return runPrompt<string>({
        message: opts.message,
        display,
        fallback: () => (opts.initialValue !== undefined ? { ok: true, value: opts.initialValue } : { ok: false }),
        build: (done) => {
            const View = component(() => {
                const state = signal({ value: opts.initialValue ?? '', error: '' });
                let off: (() => void) | null = null;
                let ready = false;

                onMounted(() => {
                    setTimeout(() => { ready = true; }, READY_DELAY_MS);
                    off = onKey((key) => {
                        if (!ready) return;
                        if (isEsc(key) || isCtrlC(key)) {
                            done(CANCEL);
                            return;
                        }
                        if (isEnter(key)) {
                            const error = opts.validate?.(state.value);
                            if (error) {
                                state.error = error;
                                return;
                            }
                            done(state.value);
                            return;
                        }
                        if (isBackspace(key)) {
                            state.value = state.value.slice(0, -1);
                            state.error = '';
                            return;
                        }
                        if (isPrintable(key)) {
                            state.value += key;
                            state.error = '';
                        }
                    });
                });
                onUnmounted(() => { off?.(); });

                return () => {
                    const shown = opts.mask ? opts.mask.repeat([...state.value].length) : state.value;
                    const body = state.value.length === 0 && opts.placeholder
                        ? <text color={resolveColor('dim')}>{opts.placeholder}</text>
                        : <text color={resolveColor('fg')}>{shown}</text>;
                    return promptFrame({
                        message: opts.message,
                        error: state.error || undefined,
                        rows: [promptRow(
                            <text>
                                {body}
                                <text backgroundColor={resolveColor('accent')} color={resolveColor('accentText')}> </text>
                            </text>,
                        )],
                    });
                };
            }, { name: 'TextPrompt' });
            return <View />;
        },
    });
}

/** `text` with masked rendering — the summary shows the mask, never the value. */
export function password(opts: Omit<TextOptions, 'mask' | 'placeholder'> & { mask?: string }): Promise<string | symbol> {
    return text({ ...opts, mask: opts.mask ?? '•' });
}
