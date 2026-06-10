/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor, GLYPHS,
} from '@sigx/terminal-zero';

export const Checkbox = component<
    Define.Model<boolean> &
    Define.Prop<"label", string, false> &
    Define.Prop<"autofocus", boolean, false> &
    Define.Prop<"disabled", boolean, false> &
    Define.Event<"change", boolean>
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    const isFocused = () => focusState.activeId === id;
    const checked = () => !!props.model?.value;

    const handleKey = (key: string) => {
        if (!isFocused() || props.disabled) return;
        if (key === '\r' || key === ' ') { // Enter or Space toggles
            const next = !checked();
            if (props.model) props.model.value = next;
            emit('change', next);
        }
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
        const label = props.label || '';
        const focused = isFocused();
        const isChecked = checked();
        const disabled = !!props.disabled;

        const marker = isChecked ? GLYPHS.checkboxOn : GLYPHS.checkboxOff;
        const markerColor = disabled
            ? resolveColor('faint')
            : resolveColor(isChecked ? 'success' : (focused ? 'accent' : 'line'));
        const labelColor = disabled
            ? resolveColor('faint')
            : resolveColor(focused ? 'accent' : 'fg');

        return (
            <box>
                {focused && <text color={resolveColor('accent')}>{GLYPHS.focusBar} </text>}
                <text color={markerColor}>{marker}</text>
                {label && <text color={labelColor}> {label}</text>}
            </box>
        );
    };
}, { name: 'Checkbox' });

export default Checkbox;
