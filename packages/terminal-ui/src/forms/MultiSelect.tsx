/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, signal, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor, GLYPHS, READY_DELAY_MS,
} from '@sigx/terminal-zero';

export interface MultiSelectOption<T = string> {
    label: string;
    value: T;
    description?: string;
    // Planned extension (not yet rendered): `group?: string` section headers,
    // for pickers like "connected devices / available to boot".
}

/**
 * Checkbox list with a movable cursor. Model holds the checked values.
 * Keys (while focused): ↑/k ↓/j move, Space toggles, `a` toggles all,
 * Enter submits (blocked with a hint when `required` and nothing is checked).
 */
export const MultiSelect = component<
    Define.Model<string[]> &
    Define.Prop<"options", MultiSelectOption[], true> &
    Define.Prop<"label", string, false> &
    Define.Prop<"autofocus", boolean, false> &
    Define.Prop<"required", boolean, false> &
    Define.Prop<"showHint", boolean, false> &
    Define.Event<"change", string[]> &
    Define.Event<"submit", string[]>
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false;
    const isFocused = () => focusState.activeId === id;
    const state = signal({ cursor: 0, requiredHint: false });

    const getChecked = () => props.model?.value ?? [];
    const setChecked = (next: string[]) => {
        if (props.model) props.model.value = next;
        emit('change', next);
    };

    const handleKey = (key: string) => {
        if (!isFocused() || !isReady) return;
        const options = props.options || [];
        if (options.length === 0) return;

        if (key === '\x1B[A' || key === 'k') {
            state.cursor = state.cursor > 0 ? state.cursor - 1 : options.length - 1;
            return;
        }
        if (key === '\x1B[B' || key === 'j') {
            state.cursor = state.cursor < options.length - 1 ? state.cursor + 1 : 0;
            return;
        }
        if (key === ' ') {
            const value = options[state.cursor].value;
            const checked = getChecked();
            setChecked(checked.includes(value) ? checked.filter((v) => v !== value) : [...checked, value]);
            state.requiredHint = false;
            return;
        }
        if (key === 'a') {
            const all = options.map((o) => o.value);
            setChecked(getChecked().length === all.length ? [] : all);
            state.requiredHint = false;
            return;
        }
        if (key === '\r' || key === '\n') {
            const checked = getChecked();
            if (props.required && checked.length === 0) {
                state.requiredHint = true;
                return;
            }
            emit('submit', checked);
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
        const options = props.options || [];
        const focused = isFocused();
        const checked = getChecked();

        const rows = options.map((option, i) => {
            const onCursor = i === state.cursor;
            const isChecked = checked.includes(option.value);
            return (
                <box>
                    <text color={resolveColor('accent')}>{onCursor ? GLYPHS.cursor : ' '} </text>
                    <text color={resolveColor(isChecked ? 'success' : 'line')}>
                        {isChecked ? GLYPHS.checkboxOn : GLYPHS.checkboxOff}
                    </text>
                    <text color={resolveColor(onCursor ? 'accent' : 'fg')}> {option.label}</text>
                    {option.description && onCursor && <text color={resolveColor('dim')}> — {option.description}</text>}
                </box>
            );
        });

        const hint = state.requiredHint
            ? <box><text color={resolveColor('danger')}>  select at least one option (space)</text></box>
            : props.showHint
                ? <box><text color={resolveColor('dim')}>  space select · a all · enter confirm</text></box>
                : null;

        return (
            <box>
                <box border="rounded" borderColor={resolveColor(focused ? 'accent' : 'line')} label={props.label} labelColor={resolveColor(focused ? 'accent' : 'dim')}>
                    {rows}
                </box>
                {hint}
            </box>
        );
    };
}, { name: 'MultiSelect' });

export default MultiSelect;
