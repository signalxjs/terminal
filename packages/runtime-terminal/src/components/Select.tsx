/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import { onKey } from '../index';
import { registerFocusable, unregisterFocusable, focusState, focus } from '../focus';

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
    let isReady = false; // Prevent immediate submit after mount

    const isFocused = () => focusState.activeId === id;

    const getCurrentIndex = () => {
        const options = props.options || [];
        const idx = options.findIndex(o => o.value === props.model?.value);
        return idx >= 0 ? idx : 0;
    };

    const handleKey = (key: string) => {
        if (!isFocused()) return;
        if (!isReady) return; // Ignore keys until component is ready

        const options = props.options || [];
        if (options.length === 0) return;

        const currentIndex = getCurrentIndex();

        // Arrow up or 'k'
        if (key === '\x1B[A' || key === 'k') {
            const newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
            const newValue = options[newIndex].value;
            if (props.model) props.model.value = newValue;
            emit('change', newValue);
            return;
        }

        // Arrow down or 'j'
        if (key === '\x1B[B' || key === 'j') {
            const newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
            const newValue = options[newIndex].value;
            if (props.model) props.model.value = newValue;
            emit('change', newValue);
            return;
        }

        // Enter to submit (terminals may send \r or \n)
        if (key === '\r' || key === '\n') {
            emit('submit', props.model?.value || options[0]?.value || '');
            return;
        }
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
        const options = props.options || [];
        const focused = isFocused();
        const currentValue = props.model?.value || options[0]?.value || '';
        const label = props.label;
        const selectedOption = options.find(o => o.value === currentValue);

        // Render options
        const optionElements = options.map((option) => {
            const isSelected = option.value === currentValue;
            const indicator = isSelected ? '❯' : ' ';
            const color = isSelected ? 'cyan' : 'white';

            return (
                <box>
                    <text color={color}>{indicator} {option.label}</text>
                </box>
            );
        });

        // Description shown below the box (common pattern in CLI tools)
        const descriptionElement = props.showDescription && selectedOption?.description ? (
            <box>
                <text color="#666666">  ↳ {selectedOption.description}</text>
            </box>
        ) : null;

        return (
            <box>
                <box border="single" borderColor={focused ? 'green' : 'white'} label={label}>
                    {optionElements}
                </box>
                {descriptionElement}
            </box>
        );
    };
}, { name: 'Select' });

export default Select;
