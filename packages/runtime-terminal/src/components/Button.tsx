/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, signal, type Define } from '@sigx/runtime-core';
import { onKey } from '../index';
import { registerFocusable, unregisterFocusable, focusState } from '../focus';

export const Button = component<
    Define.Prop<"label", string, false> &
    Define.Prop<"dropShadow", boolean, false> &
    Define.Event<"click">
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false; // Prevent immediate click after mount

    const isFocused = () => focusState.activeId === id;
    const pressed = signal({ value: false });

    const handleKey = (key: string) => {
        if (!isFocused()) return;
        if (!isReady) return; // Ignore keys until component is ready

        if (key === '\r' || key === '\n' || key === ' ') { // Enter or Space
            // Visual press effect + emit click
            pressed.value = true as any;
            if (pressTimer) clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                pressed.value = false as any;
                pressTimer = null;
            }, 120);
            emit('click');
        }
    };

    let keyCleanup: (() => void) | null = null;
    let pressTimer: ReturnType<typeof setTimeout> | null = null;

    onMounted(() => {
        registerFocusable(id);
        keyCleanup = onKey(handleKey);
        // Small delay to prevent immediate click from previous Enter key
        setTimeout(() => { isReady = true; }, 50);
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
        unregisterFocusable(id);
        if (pressTimer) clearTimeout(pressTimer);
    });

    return () => {
        const focused = isFocused();
        const label = props.label || 'Button';
        const isPressed = pressed.value as boolean;

        return (
            <box
                border="single"
                borderColor={isPressed ? 'yellow' : (focused ? 'green' : 'white')}
                backgroundColor={isPressed ? 'red' : (focused ? 'blue' : undefined)}
                dropShadow={props.dropShadow}
            >
                <text color={focused ? 'white' : undefined}>{label}</text>
            </box>
        );
    };
}, { name: 'Button' });