/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted } from '@sigx/runtime-core';
import { onKey, resolveColor, GLYPHS, READY_DELAY_MS } from '@sigx/terminal-zero';
import { CANCEL } from './cancel';
import { runPrompt } from './runPrompt';
import { promptFrame, promptRow } from './PromptShell';
import { isEnter, isEsc, isCtrlC, isLeft, isRight } from './keys';

export interface ConfirmOptions {
    message: string;
    initialValue?: boolean;
    /** Label for true. Default 'Yes'. */
    active?: string;
    /** Label for false. Default 'No'. */
    inactive?: string;
}

/**
 * Yes/No prompt: y/n answer immediately, ←/→ (or h/l) flip the selection,
 * Enter resolves the current value.
 */
export function confirm(opts: ConfirmOptions): Promise<boolean | symbol> {
    const yes = opts.active ?? 'Yes';
    const no = opts.inactive ?? 'No';
    return runPrompt<boolean>({
        message: opts.message,
        display: (v) => (v ? yes : no),
        fallback: () => (opts.initialValue !== undefined ? { ok: true, value: opts.initialValue } : { ok: false }),
        build: (done) => {
            const View = component(() => {
                const state = signal({ value: opts.initialValue ?? true });
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
                        if (key === 'y' || key === 'Y') {
                            done(true);
                            return;
                        }
                        if (key === 'n' || key === 'N') {
                            done(false);
                            return;
                        }
                        if (isLeft(key) || isRight(key) || key === 'h' || key === 'l') {
                            state.value = !state.value;
                            return;
                        }
                        if (isEnter(key)) {
                            done(state.value);
                        }
                    });
                });
                onUnmounted(() => { off?.(); });

                return () => promptFrame({
                    message: opts.message,
                    footer: 'y / n · enter confirm',
                    rows: [promptRow(
                        <text>
                            <text color={resolveColor(state.value ? 'accent' : 'dim')}>
                                {state.value ? GLYPHS.radioOn : GLYPHS.radioOff} {yes}
                            </text>
                            <text>  </text>
                            <text color={resolveColor(state.value ? 'dim' : 'accent')}>
                                {state.value ? GLYPHS.radioOff : GLYPHS.radioOn} {no}
                            </text>
                        </text>,
                    )],
                });
            }, { name: 'ConfirmPrompt' });
            return <View />;
        },
    });
}
