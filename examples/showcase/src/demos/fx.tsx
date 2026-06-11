/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted, Text, Spacer, Col } from '@sigx/terminal';
import { Gradient, Shimmer, Banner, Spinner, ProgressBar, SPINNERS, type SpinnerVariant } from '@sigx/terminal';

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
        <Col>
            <Banner text="SIGX" preset="sigx" />
            <Spacer size={1} />
            <Text color="dim">Gradient presets (sigx follows the theme — press t):</Text>
            <Col><Gradient text="sigx — accent → info → success" preset="sigx" /></Col>
            <Col><Gradient text="rainbow — all the colors, all the time" preset="rainbow" /></Col>
            <Col><Gradient text="sunset — warm and easy" preset="sunset" /></Col>
            <Col><Gradient text="ocean — cool and calm" preset="ocean" /></Col>
            <Col><Gradient text="fire — maximum hype" preset="fire" /></Col>
            <Spacer size={1} />
            <Col><Gradient text="★ animated rainbow scrolling through this line ★" preset="rainbow" animate /></Col>
            <Col><Shimmer text="Thinking… resolving dependencies… almost there…" /></Col>
            <Spacer size={1} />
            <Text color="dim">Spinner variants:</Text>
            {(Object.keys(SPINNERS) as SpinnerVariant[]).map((variant) => (
                <Spinner variant={variant} label={variant} />
            ))}
            <Spacer size={1} />
            <Text color="dim">ProgressBar variants (solid / gradient / rainbow, smooth edges):</Text>
            <Col><ProgressBar value={state.pct} width={32} /></Col>
            <Col><ProgressBar value={state.pct} width={32} variant="gradient" smooth /></Col>
            <Col><ProgressBar value={state.pct} width={32} variant="rainbow" smooth /></Col>
        </Col>
    );
}, { name: 'FxDemo' });
