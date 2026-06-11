/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted, Text, Spacer, Col } from '@sigx/terminal';
import { onKey, StatusBar, Box, setTheme, listThemes } from '@sigx/terminal';
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
                <Text bg={on ? 'accent' : 'accentSoft'} color={on ? 'accentText' : 'dim'}>
                    {' '}{String(i + 1)} {d.title}{' '}
                </Text>
            );
        });

        return (
            <Col>
                <Box border="thick" borderColor="accent" padX={1}>
                    <Text color="accent">SigX Terminal — Component Showcase</Text>
                </Box>
                <Col>{strip}</Col>
                <Spacer size={1} />
                <Box border="rounded" borderColor="line" label={active.title} labelColor="accent" padX={1} dropShadow={true}>
                    <Demo />
                </Box>
                <Spacer size={1} />
                <StatusBar items={[
                    { key: '[ ]', label: 'prev / next' },
                    { key: `1-${demos.length}`, label: 'jump' },
                    { key: 'Tab', label: 'focus' },
                    { key: 't', label: `theme: ${state.theme}` },
                    { key: '^C', label: 'quit' },
                ]} />
            </Col>
        );
    };
}, { name: 'App' });
