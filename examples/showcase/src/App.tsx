/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted } from '@sigx/terminal';
import { onKey, StatusBar, resolveColor, setTheme, listThemes } from '@sigx/terminal';
import { demos } from './catalog';

export const App = component(() => {
    // Only the design themes (skip the foundation's bare `neutral`).
    const themes = listThemes().filter((t) => t !== 'neutral');
    let themeIdx = Math.max(0, themes.indexOf('obsidian'));
    setTheme(themes[themeIdx]);

    const state = signal({ demo: 0, theme: themes[themeIdx] });

    const setDemo = (i: number) => {
        const n = demos.length;
        state.demo = ((i % n) + n) % n;
    };
    const cycleTheme = (delta: number) => {
        themeIdx = (themeIdx + delta + themes.length) % themes.length;
        setTheme(themes[themeIdx]);
        state.theme = themes[themeIdx];
    };

    const handleKey = (key: string) => {
        if (key === ']') setDemo(state.demo + 1);
        else if (key === '[') setDemo(state.demo - 1);
        else if (key === 't') cycleTheme(1);
        else if (key === 'T') cycleTheme(-1);
        else if (key >= '1' && key <= '9') {
            const i = Number(key) - 1;
            if (i < demos.length) setDemo(i);
        }
    };

    let cleanup: (() => void) | null = null;
    onMounted(() => { cleanup = onKey(handleKey); });
    onUnmounted(() => { cleanup?.(); });

    return () => {
        const active = demos[state.demo];
        const Demo = active.component;

        // Demo selector strip — segmented tabs filled by state.
        const strip = demos.map((d, i) => {
            const on = i === state.demo;
            return (
                <text
                    backgroundColor={resolveColor(on ? 'accent' : 'accentSoft')}
                    color={resolveColor(on ? 'accentText' : 'dim')}
                > {String(i + 1)} {d.title} </text>
            );
        });

        return (
            <box>
                <box border="thick" borderColor={resolveColor('accent')} padX={1}>
                    <text color={resolveColor('accent')}>SigX Terminal — Component Showcase</text>
                </box>
                <box>{strip}</box>
                <box></box>
                <box border="rounded" borderColor={resolveColor('line')} label={active.title} labelColor={resolveColor('accent')} padX={1} dropShadow={true} shadowColor={resolveColor('shadow')}>
                    <Demo />
                </box>
                <box></box>
                <StatusBar items={[
                    { key: '[ ]', label: 'prev / next' },
                    { key: `1-${demos.length}`, label: 'jump' },
                    { key: 'Tab', label: 'focus' },
                    { key: 't', label: `theme: ${state.theme}` },
                    { key: '^C', label: 'quit' },
                ]} />
            </box>
        );
    };
}, { name: 'App' });
