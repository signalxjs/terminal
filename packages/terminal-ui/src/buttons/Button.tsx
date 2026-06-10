/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, signal, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState,
    resolveColor, GLYPHS, PRESS_MS, READY_DELAY_MS,
} from '@sigx/terminal-zero';

export const Button = component<
    Define.Prop<"label", string, false> &
    Define.Prop<"dropShadow", boolean, false> &
    Define.Event<"click">
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false; // Prevent immediate click after mount
    const isFocused = () => focusState.activeId === id;
    const pressed = signal({ value: false as boolean });
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let keyCleanup: (() => void) | null = null;

    const handleKey = (key: string) => {
        if (!isFocused() || !isReady) return;
        if (key === '\r' || key === '\n' || key === ' ') {
            pressed.value = true;
            if (pressTimer) clearTimeout(pressTimer);
            pressTimer = setTimeout(() => { pressed.value = false; pressTimer = null; }, PRESS_MS);
            emit('click');
        }
    };

    onMounted(() => {
        registerFocusable(id);
        keyCleanup = onKey(handleKey);
        setTimeout(() => { isReady = true; }, READY_DELAY_MS);
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
        unregisterFocusable(id);
        if (pressTimer) clearTimeout(pressTimer);
    });

    return () => {
        const focused = isFocused();
        const label = props.label || 'Button';
        const isPressed = pressed.value;
        const border = resolveColor(focused ? 'accent' : 'line');
        const bg = isPressed ? resolveColor('accent') : (focused ? resolveColor('accentSoft') : undefined);
        const textColor = isPressed ? resolveColor('accentText') : resolveColor(focused ? 'accent' : 'fg');

        return (
            <box
                border="rounded"
                borderColor={border}
                backgroundColor={bg}
                dropShadow={props.dropShadow}
                shadowColor={resolveColor('shadow')}
            >
                {focused && <text color={resolveColor('accent')}>{GLYPHS.focusBar} </text>}
                <text color={textColor}>{label}</text>
            </box>
        );
    };
}, { name: 'Button' });

export default Button;
