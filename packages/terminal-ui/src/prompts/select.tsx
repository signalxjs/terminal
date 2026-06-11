/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted } from '@sigx/runtime-core';
import { onKey, resolveColor, GLYPHS, READY_DELAY_MS, CANCEL, runPrompt, isEnter, isEsc, isCtrlC, isUp, isDown } from '@sigx/terminal-zero';
import { promptFrame, promptRow } from './PromptShell';

export interface PromptOption<T> {
    value: T;
    /** Defaults to String(value). */
    label?: string;
    description?: string;
}

export function optionLabel<T>(option: PromptOption<T>): string {
    return option.label ?? String(option.value);
}

export interface SelectOptions<T> {
    message: string;
    options: PromptOption<T>[];
    initialValue?: T;
}

/** Single-choice prompt: ↑/k ↓/j move (wrapping), Enter resolves the value. */
export function select<T = string>(opts: SelectOptions<T>): Promise<T | symbol> {
    const display = (v: T) => {
        const hit = opts.options.find((o) => o.value === v);
        return hit ? optionLabel(hit) : String(v);
    };
    return runPrompt<T>({
        message: opts.message,
        display,
        fallback: () => (opts.initialValue !== undefined ? { ok: true, value: opts.initialValue } : { ok: false }),
        build: (done) => {
            const View = component(() => {
                const initial = opts.options.findIndex((o) => o.value === opts.initialValue);
                const state = signal({ cursor: initial >= 0 ? initial : 0 });
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
                        if (isUp(key) || key === 'k') {
                            state.cursor = state.cursor > 0 ? state.cursor - 1 : opts.options.length - 1;
                            return;
                        }
                        if (isDown(key) || key === 'j') {
                            state.cursor = state.cursor < opts.options.length - 1 ? state.cursor + 1 : 0;
                            return;
                        }
                        if (isEnter(key)) {
                            done(opts.options[state.cursor].value);
                        }
                    });
                });
                onUnmounted(() => { off?.(); });

                return () => promptFrame({
                    message: opts.message,
                    rows: opts.options.map((option, i) => {
                        const onCursor = i === state.cursor;
                        return promptRow(
                            <text>
                                <text color={resolveColor(onCursor ? 'accent' : 'faint')}>{onCursor ? GLYPHS.cursor : ' '} </text>
                                <text color={resolveColor(onCursor ? 'accent' : 'fg')}>{optionLabel(option)}</text>
                                {option.description && onCursor && <text color={resolveColor('dim')}> — {option.description}</text>}
                            </text>,
                        );
                    }),
                });
            }, { name: 'SelectPrompt' });
            return <View />;
        },
    });
}
