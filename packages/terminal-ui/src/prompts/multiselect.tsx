/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted } from '@sigx/runtime-core';
import { onKey, resolveColor, GLYPHS, READY_DELAY_MS, CANCEL, runPrompt, isEnter, isEsc, isCtrlC, isUp, isDown, isSpace } from '@sigx/terminal-zero';
import { promptFrame, promptRow } from './PromptShell';
import { optionLabel, type PromptOption } from './select';

export interface MultiSelectPromptOptions<T> {
    message: string;
    options: PromptOption<T>[];
    initialValues?: T[];
    /** Block an empty Enter and show a hint instead. Default false. */
    required?: boolean;
}

/**
 * Multi-choice prompt: ↑/k ↓/j move, Space toggles, `a` toggles all,
 * Enter resolves the checked values (in option order).
 */
export function multiselect<T = string>(opts: MultiSelectPromptOptions<T>): Promise<T[] | typeof CANCEL> {
    const display = (values: T[]) => {
        if (values.length === 0) return 'none';
        return opts.options.filter((o) => values.includes(o.value)).map(optionLabel).join(', ');
    };
    return runPrompt<T[]>({
        message: opts.message,
        display,
        fallback: () => (opts.initialValues !== undefined ? { ok: true, value: opts.initialValues } : { ok: false }),
        build: (done) => {
            const View = component(() => {
                const state = signal({
                    cursor: 0,
                    checked: new Set<T>(opts.initialValues ?? []),
                    requiredHint: false,
                });
                let off: (() => void) | null = null;
                let ready = false;

                const resolveChecked = () =>
                    opts.options.filter((o) => state.checked.has(o.value)).map((o) => o.value);

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
                        if (isSpace(key)) {
                            const value = opts.options[state.cursor].value;
                            const next = new Set(state.checked);
                            if (next.has(value)) next.delete(value);
                            else next.add(value);
                            state.checked = next;
                            state.requiredHint = false;
                            return;
                        }
                        if (key === 'a') {
                            state.checked = state.checked.size === opts.options.length
                                ? new Set<T>()
                                : new Set(opts.options.map((o) => o.value));
                            state.requiredHint = false;
                            return;
                        }
                        if (isEnter(key)) {
                            const values = resolveChecked();
                            if (opts.required && values.length === 0) {
                                state.requiredHint = true;
                                return;
                            }
                            done(values);
                        }
                    });
                });
                onUnmounted(() => { off?.(); });

                return () => promptFrame({
                    message: opts.message,
                    error: state.requiredHint ? 'select at least one option (space)' : undefined,
                    footer: 'space toggle · a all · enter confirm',
                    rows: opts.options.flatMap((option, i) => {
                        const onCursor = i === state.cursor;
                        const isChecked = state.checked.has(option.value);
                        const header = option.group && option.group !== opts.options[i - 1]?.group
                            ? [promptRow(<text color={resolveColor('dim')}>{option.group}</text>)]
                            : [];
                        return [
                            ...header,
                            promptRow(
                                <text>
                                    <text color={resolveColor(onCursor ? 'accent' : 'faint')}>{onCursor ? GLYPHS.cursor : ' '} </text>
                                    <text color={resolveColor(isChecked ? 'success' : 'line')}>
                                        {isChecked ? GLYPHS.checkboxOn : GLYPHS.checkboxOff}
                                    </text>
                                    <text color={resolveColor(onCursor ? 'accent' : 'fg')}> {optionLabel(option)}</text>
                                    {option.description && onCursor && <text color={resolveColor('dim')}> — {option.description}</text>}
                                </text>,
                            ),
                        ];
                    }),
                });
            }, { name: 'MultiSelectPrompt' });
            return <View />;
        },
    });
}
