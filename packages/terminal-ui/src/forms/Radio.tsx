/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor, GLYPHS,
} from '@sigx/terminal-zero';

export interface RadioOption<T = string> {
    label: string;
    value: T;
}

/**
 * Single-choice group. Like Select, but every option is always visible with a
 * ● / ○ marker. Arrow keys (or j/k) move the selection.
 */
export const Radio = component<
    Define.Model<string> &
    Define.Prop<"options", RadioOption[], true> &
    Define.Prop<"label", string, false> &
    Define.Prop<"autofocus", boolean, false> &
    Define.Event<"change", string>
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    const isFocused = () => focusState.activeId === id;

    const getCurrentIndex = () => {
        const options = props.options || [];
        const idx = options.findIndex(o => o.value === props.model?.value);
        return idx >= 0 ? idx : 0;
    };

    const move = (delta: number) => {
        const options = props.options || [];
        if (options.length === 0) return;
        const len = options.length;
        const newIndex = (getCurrentIndex() + delta + len) % len;
        const newValue = options[newIndex].value;
        if (props.model) props.model.value = newValue;
        emit('change', newValue);
    };

    const handleKey = (key: string) => {
        if (!isFocused()) return;
        if (key === '\x1B[A' || key === 'k') move(-1);
        else if (key === '\x1B[B' || key === 'j') move(1);
    };

    let keyCleanup: (() => void) | null = null;

    onMounted(() => {
        registerFocusable(id);
        if (props.autofocus) focus(id);
        keyCleanup = onKey(handleKey);
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
        unregisterFocusable(id);
    });

    return () => {
        const options = props.options || [];
        const focused = isFocused();
        const currentValue = props.model?.value || options[0]?.value || '';

        const rows = options.map((option) => {
            const isSelected = option.value === currentValue;
            const marker = isSelected ? GLYPHS.radioOn : GLYPHS.radioOff;
            return (
                <box>
                    <text color={resolveColor(isSelected ? 'accent' : 'faint')}>{marker} </text>
                    <text color={resolveColor(isSelected ? 'fg' : 'dim')}>{option.label}</text>
                </box>
            );
        });

        return (
            <box border="rounded" borderColor={resolveColor(focused ? 'accent' : 'line')} label={props.label} labelColor={resolveColor(focused ? 'accent' : 'dim')}>
                {rows}
            </box>
        );
    };
}, { name: 'Radio' });

export default Radio;
