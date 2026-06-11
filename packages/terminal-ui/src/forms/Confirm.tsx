/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor, GLYPHS, READY_DELAY_MS,
} from '@sigx/terminal-zero';

/**
 * Yes/No toggle. Keys (while focused): y/Y and n/N answer immediately,
 * ←/→ (or h/l) flip the selection, Enter submits the current value.
 */
export const Confirm = component<
    Define.Model<boolean> &
    Define.Prop<"label", string, false> &
    Define.Prop<"activeLabel", string, false> &
    Define.Prop<"inactiveLabel", string, false> &
    Define.Prop<"autofocus", boolean, false> &
    Define.Event<"change", boolean> &
    Define.Event<"submit", boolean>
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false;
    const isFocused = () => focusState.activeId === id;

    const getValue = () => props.model?.value ?? true;
    const setValue = (next: boolean) => {
        if (props.model) props.model.value = next;
        emit('change', next);
    };

    const handleKey = (key: string) => {
        if (!isFocused() || !isReady) return;
        if (key === 'y' || key === 'Y') {
            setValue(true);
            emit('submit', true);
            return;
        }
        if (key === 'n' || key === 'N') {
            setValue(false);
            emit('submit', false);
            return;
        }
        if (key === '\x1B[D' || key === '\x1B[C' || key === 'h' || key === 'l') {
            setValue(!getValue());
            return;
        }
        if (key === '\r' || key === '\n') {
            emit('submit', getValue());
            return;
        }
    };

    let keyCleanup: (() => void) | null = null;

    onMounted(() => {
        registerFocusable(id);
        if (props.autofocus) focus(id);
        keyCleanup = onKey(handleKey);
        setTimeout(() => { isReady = true; }, READY_DELAY_MS);
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
        unregisterFocusable(id);
    });

    return () => {
        const focused = isFocused();
        const value = getValue();
        const yes = props.activeLabel || 'Yes';
        const no = props.inactiveLabel || 'No';

        return (
            <box>
                <text color={resolveColor(focused ? 'accent' : 'line')}>{focused ? GLYPHS.focusBar : ' '} </text>
                {props.label && <text color={resolveColor('fg')}>{props.label}  </text>}
                <text color={resolveColor(value ? 'accent' : 'dim')}>
                    {value ? GLYPHS.radioOn : GLYPHS.radioOff} {yes}
                </text>
                <text>  </text>
                <text color={resolveColor(value ? 'dim' : 'accent')}>
                    {value ? GLYPHS.radioOff : GLYPHS.radioOn} {no}
                </text>
            </box>
        );
    };
}, { name: 'Confirm' });

export default Confirm;
