/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor,
} from '@sigx/terminal-zero';

export const Input = component<
    Define.Model<string> &
    Define.Prop<"placeholder", string, false> &
    Define.Prop<"autofocus", boolean, false> &
    Define.Prop<"label", string, false> &
    Define.Event<"input", string> &
    Define.Event<"submit", string>
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false;
    const isFocused = () => focusState.activeId === id;
    const getValue = () => props.model?.value || '';

    const handleKey = (key: string) => {
        if (!isFocused() || !isReady) return;

        if (key === '\r' || key === '\n') {
            emit('submit', getValue());
            return;
        }
        if (key === '\u007F' || key === '\b') { // Backspace / Delete
            const val = getValue();
            if (val.length > 0) {
                const newValue = val.slice(0, -1);
                if (props.model) props.model.value = newValue;
                emit('input', newValue);
            }
            return;
        }
        if (key.length > 1) return; // ignore control sequences

        const newValue = getValue() + key;
        if (props.model) props.model.value = newValue;
        emit('input', newValue);
    };

    let keyCleanup: (() => void) | null = null;

    onMounted(() => {
        registerFocusable(id);
        if (props.autofocus) focus(id);
        keyCleanup = onKey(handleKey);
        setTimeout(() => { isReady = true; }, 50);
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
        unregisterFocusable(id);
    });

    return () => {
        const val = getValue().replace(/[\r\n]+/g, ' ');
        const placeholder = (props.placeholder || '').replace(/[\r\n]+/g, ' ');
        const focused = isFocused();
        const hasValue = val.length > 0;

        return (
            <box border="rounded" borderColor={resolveColor(focused ? 'accent' : 'line')} label={props.label} labelColor={resolveColor(focused ? 'accent' : 'dim')}>
                <text color={resolveColor(hasValue ? 'fg' : 'dim')}>{val || placeholder}</text>
                {focused && (
                    // Block cursor: a reverse-video space (exactly one cell).
                    <text backgroundColor={resolveColor('accent')} color={resolveColor('accentText')}> </text>
                )}
            </box>
        );
    };
}, { name: 'Input' });

export default Input;
