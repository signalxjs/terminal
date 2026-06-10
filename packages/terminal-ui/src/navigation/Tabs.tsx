/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor,
} from '@sigx/terminal-zero';

export interface TabOption<T = string> {
    label: string;
    value: T;
}

/** Horizontal tab switcher. Active tab fills accent; ←/→ (or h/l) switch. */
export const Tabs = component<
    Define.Model<string> &
    Define.Prop<"options", TabOption[], true> &
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
        if (key === '\x1B[D' || key === 'h') move(-1);
        else if (key === '\x1B[C' || key === 'l') move(1);
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
        const current = props.model?.value || options[0]?.value || '';
        const focused = isFocused();

        const tabs: any[] = [];
        options.forEach((option, i) => {
            const active = option.value === current;
            const bg = resolveColor(active ? 'accent' : 'accentSoft');
            const fg = resolveColor(active ? 'accentText' : 'dim');
            tabs.push(<text backgroundColor={bg} color={fg}> {option.label} </text>);
            if (i < options.length - 1) tabs.push(<text> </text>);
        });

        return (
            <box border="rounded" borderColor={resolveColor(focused ? 'accent' : 'line')}>
                {tabs}
            </box>
        );
    };
}, { name: 'Tabs' });

export default Tabs;
