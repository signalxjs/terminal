/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted, Text, Spacer } from '@sigx/terminal';
import { ProgressBar, Spinner, Badge } from '@sigx/terminal';

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
            <Text color="dim">Live progress + an animated spinner.</Text>
            <Spacer size={1} />
            <ProgressBar value={state.pct} max={100} width={28} />
            <Spacer size={1} />
            <Spinner label={state.done ? 'Complete' : 'Working…'} done={state.done} />
            <Spacer size={1} />
            <Text color="dim">Badges:</Text>
            <Badge label="solid" variant="solid" />
            <Badge label="accent" variant="accent" />
            <Badge label="bracket" variant="bracket" />
            <Badge label="error" variant="solid" color="danger" />
            <Badge label="ok" variant="solid" color="success" />
        </box>
    );
}, { name: 'FeedbackDemo' });
