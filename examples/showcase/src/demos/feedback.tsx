/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted } from '@sigx/terminal';
import { ProgressBar, Spinner, Badge, resolveColor } from '@sigx/terminal';

export const FeedbackDemo = component(() => {
    const state = signal({ pct: 20, done: false });
    let timer: ReturnType<typeof setInterval> | null = null;

    onMounted(() => {
        timer = setInterval(() => {
            const next = state.pct + 4;
            state.pct = next > 100 ? 0 : next;
            state.done = state.pct >= 96;
        }, 200);
    });
    onUnmounted(() => { if (timer) clearInterval(timer); });

    return () => (
        <box>
            <text color={resolveColor('dim')}>Live progress + an animated spinner.</text>
            <box></box>
            <ProgressBar value={state.pct} max={100} width={28} />
            <box></box>
            <Spinner label={state.done ? 'Complete' : 'Working…'} done={state.done} />
            <box></box>
            <text color={resolveColor('dim')}>Badges:</text>
            <Badge label="solid" variant="solid" />
            <Badge label="accent" variant="accent" />
            <Badge label="bracket" variant="bracket" />
            <Badge label="error" variant="solid" color="danger" />
            <Badge label="ok" variant="solid" color="success" />
        </box>
    );
}, { name: 'FeedbackDemo' });
