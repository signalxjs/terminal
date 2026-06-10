/** @jsxImportSource @sigx/runtime-core */
// Inline mode demo. Run directly in a terminal:
//
//     node --import tsx src/main.tsx
//
// The counter ticks in place below your shell prompt — scrollback above stays
// intact. It exits by itself after 10 ticks (or Ctrl+C), leaving the final
// frame in scrollback with the cursor below it. Pipe it (`| cat`) to see the
// non-TTY fallback: a single plain-text final frame.
import { defineApp, component, signal, onMounted, onUnmounted, terminalMount, exitTerminal } from '@sigx/terminal';

const Counter = component(() => {
    const state = signal({ n: 0 });
    let timer: ReturnType<typeof setInterval> | null = null;

    onMounted(() => {
        timer = setInterval(() => {
            state.n++;
            if (state.n >= 10) {
                exitTerminal();
                process.exit(0);
            }
        }, 300);
    });
    onUnmounted(() => { if (timer) clearInterval(timer); });

    return () => (
        <box border="rounded" padX={1} label="inline counter">
            <text color="cyan">tick {String(state.n)} / 10</text>
            <br />
            <text color="gray">Ctrl+C to quit early — the frame persists either way</text>
        </box>
    );
});

defineApp(<Counter />).mount({ mode: 'inline' }, terminalMount);
