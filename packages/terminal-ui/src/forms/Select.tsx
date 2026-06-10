/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor, GLYPHS,
} from '@sigx/terminal-zero';

export interface SelectOption<T = string> {
    label: string;
    value: T;
    description?: string;
}

export const Select = component<
    Define.Model<string> &
    Define.Prop<"options", SelectOption[], true> &
    Define.Prop<"label", string, false> &
    Define.Prop<"autofocus", boolean, false> &
    Define.Prop<"showDescription", boolean, false> &
    Define.Event<"change", string> &
    Define.Event<"submit", string>
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false;
    const isFocused = () => focusState.activeId === id;

    const getCurrentIndex = () => {
        const options = props.options || [];
        const idx = options.findIndex(o => o.value === props.model?.value);
        return idx >= 0 ? idx : 0;
    };

    const handleKey = (key: string) => {
        if (!isFocused() || !isReady) return;
        const options = props.options || [];
        if (options.length === 0) return;
        const currentIndex = getCurrentIndex();

        if (key === '\x1B[A' || key === 'k') { // up
            const newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
            const newValue = options[newIndex].value;
            if (props.model) props.model.value = newValue;
            emit('change', newValue);
            return;
        }
        if (key === '\x1B[B' || key === 'j') { // down
            const newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
            const newValue = options[newIndex].value;
            if (props.model) props.model.value = newValue;
            emit('change', newValue);
            return;
        }
        if (key === '\r' || key === '\n') { // submit
            emit('submit', props.model?.value || options[0]?.value || '');
            return;
        }
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
        const options = props.options || [];
        const focused = isFocused();
        const currentValue = props.model?.value || options[0]?.value || '';
        const selectedOption = options.find(o => o.value === currentValue);

        const optionElements = options.map((option) => {
            const isSelected = option.value === currentValue;
            const indicator = isSelected ? GLYPHS.cursor : ' ';
            const rowColor = resolveColor(isSelected ? 'accent' : 'fg');
            return (
                <box>
                    <text color={resolveColor(isSelected ? 'accent' : 'faint')}>{indicator} </text>
                    <text color={rowColor}>{option.label}</text>
                </box>
            );
        });

        const descriptionElement = props.showDescription && selectedOption?.description ? (
            <box>
                <text color={resolveColor('dim')}>  ↳ {selectedOption.description}</text>
            </box>
        ) : null;

        return (
            <box>
                <box border="rounded" borderColor={resolveColor(focused ? 'accent' : 'line')} label={props.label} labelColor={resolveColor(focused ? 'accent' : 'dim')}>
                    {optionElements}
                </box>
                {descriptionElement}
            </box>
        );
    };
}, { name: 'Select' });

export default Select;
