/** @jsxImportSource @sigx/runtime-core */
// Static output demo — the CLI-command side of the framework. Run directly:
//
//     node --import tsx src/main.tsx
//
// A spinner stays live at the bottom while finished steps scroll permanently
// into history above it, two ways: explicitly via printStatic(), and via a
// raw console.log() that the inline mount auto-routes through static output
// (so library noise can't corrupt the frame).
import { defineApp, component, signal, onMounted, onUnmounted, terminalMount, exitTerminal, printStatic, Text } from '@sigx/terminal';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const STEPS = 6;

const Runner = component(() => {
    const state = signal({ frame: 0, step: 1, done: false });
    let spin: ReturnType<typeof setInterval> | null = null;
    let work: ReturnType<typeof setInterval> | null = null;

    onMounted(() => {
        spin = setInterval(() => { state.frame = (state.frame + 1) % FRAMES.length; }, 80);
        work = setInterval(() => {
            printStatic(`✔ step ${state.step}/${STEPS} finished`);
            if (state.step % 2 === 0) {
                console.log('  (a stray console.log — auto-routed, frame intact)');
            }
            state.step++;
            if (state.step > STEPS) {
                state.done = true;
                exitTerminal();
                process.exit(0);
            }
        }, 700);
    });
    onUnmounted(() => {
        if (spin) clearInterval(spin);
        if (work) clearInterval(work);
    });

    return () => state.done
        ? <Text color="success">✔ all {String(STEPS)} steps complete</Text>
        : <Text color="info">{FRAMES[state.frame]} working on step {String(state.step)}…</Text>;
});

defineApp(<Runner />).mount({ mode: 'inline' }, terminalMount);
