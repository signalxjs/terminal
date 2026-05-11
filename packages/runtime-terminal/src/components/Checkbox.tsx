/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, signal, type Define } from '@sigx/runtime-core';
import { onKey } from '../index';
import { registerFocusable, unregisterFocusable, focusState, focus } from '../focus';

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
        if (!isFocused()) return;
        if (props.disabled) return;

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

        // Visual: [x] Label  or [ ] Label
        // When focused, show a cursor indicator and highlight the label
        const boxColor = disabled ? 'white' : (isChecked ? 'green' : (focused ? 'cyan' : 'white'));
        const labelColor = disabled ? 'white' : (focused ? 'cyan' : undefined);
        const checkMark = isChecked ? 'x' : ' ';
        const focusIndicator = focused ? '>' : ' ';

        return (
            <box>
                <text color={focused ? 'cyan' : 'white'}>{focusIndicator}</text>
                <text color={boxColor}>[{checkMark}]</text>
                {label && <text color={labelColor}> {label}</text>}
            </box>
        );
    };
}, { name: 'Checkbox' });

export default Checkbox;
