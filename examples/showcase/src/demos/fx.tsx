/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted } from '@sigx/terminal';
import { resolveColor, Gradient, Shimmer, Banner, Spinner, ProgressBar, SPINNERS } from '@sigx/terminal';

export const FxDemo = component(() => {
    const state = signal({ pct: 35 });
    let timer: ReturnType<typeof setInterval> | null = null;

    onMounted(() => {
        timer = setInterval(() => {
            const next = state.pct + 3;
            state.pct = next > 100 ? 0 : next;
        }, 200);
    });
    onUnmounted(() => { if (timer) clearInterval(timer); });

    return () => (
        <box>
            <Banner text="SIGX" preset="sigx" />
            <box></box>
            <text color={resolveColor('dim')}>Gradient presets (sigx follows the theme — press t):</text>
            <box><Gradient text="sigx — accent → info → success" preset="sigx" /></box>
            <box><Gradient text="rainbow — all the colors, all the time" preset="rainbow" /></box>
            <box><Gradient text="sunset — warm and easy" preset="sunset" /></box>
            <box><Gradient text="ocean — cool and calm" preset="ocean" /></box>
            <box><Gradient text="fire — maximum hype" preset="fire" /></box>
            <box></box>
            <box><Gradient text="★ animated rainbow scrolling through this line ★" preset="rainbow" animate /></box>
            <box><Shimmer text="Thinking… resolving dependencies… almost there…" /></box>
            <box></box>
            <text color={resolveColor('dim')}>Spinner variants:</text>
            {Object.keys(SPINNERS).map((variant) => (
                <Spinner variant={variant} label={variant} />
            ))}
            <box></box>
            <text color={resolveColor('dim')}>ProgressBar variants (solid / gradient / rainbow, smooth edges):</text>
            <box><ProgressBar value={state.pct} width={32} /></box>
            <box><ProgressBar value={state.pct} width={32} variant="gradient" smooth /></box>
            <box><ProgressBar value={state.pct} width={32} variant="rainbow" smooth /></box>
        </box>
    );
}, { name: 'FxDemo' });
