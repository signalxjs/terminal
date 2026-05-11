/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import { onKey } from '../index';
import { registerFocusable, unregisterFocusable, focusState, focus } from '../focus';

export const Input = component<
    Define.Model<string> &
    Define.Prop<"placeholder", string, false> &
    Define.Prop<"autofocus", boolean, false> &
    Define.Prop<"label", string, false> &
    Define.Event<"input", string> &
    Define.Event<"submit", string>
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false; // Prevent immediate submit after mount

    const isFocused = () => focusState.activeId === id;

    const getValue = () => props.model?.value || '';

    const handleKey = (key: string) => {
        if (!isFocused()) return;
        if (!isReady) return; // Ignore keys until component is ready

        if (key === '\r' || key === '\n') { // Enter (terminals may send \r or \n)
            emit('submit', getValue());
            return;
        }

        if (key === '\u007F' || key === '\b') { // Backspace
            const val = getValue();
            if (val.length > 0) {
                const newValue = val.slice(0, -1);
                if (props.model) props.model.value = newValue;
                emit('input', newValue);
            }
            return;
        }

        // Ignore control characters
        if (key.length > 1) return;

        const newValue = getValue() + key;
        if (props.model) props.model.value = newValue;
        emit('input', newValue);
    };

    let keyCleanup: (() => void) | null = null;

    onMounted(() => {
        registerFocusable(id);
        if (props.autofocus) {
            focus(id);
        }
        keyCleanup = onKey(handleKey);
        // Small delay to prevent immediate submit from previous Enter key
        setTimeout(() => { isReady = true; }, 50);
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
        unregisterFocusable(id);
    });

    return () => {
        const val = getValue().replace(/[\r\n]+/g, ' ');
        const placeholder = (props.placeholder || '').replace(/[\r\n]+/g, ' ');
        const showCursor = isFocused();
        // console.log('Input render', { val, placeholder, showCursor });

        return (
            <box border="single" borderColor={showCursor ? 'green' : 'white'} label={props.label}>
                <text>{val || placeholder}</text>
                {showCursor && <text color="cyan">_</text>}
            </box>
        );
    };
}, { name: 'Input' });
