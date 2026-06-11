/** @jsxImportSource @sigx/runtime-core */
// Simulated sigx-lynx build: the modern build-CLI look, end to end.
//
//     node --import tsx src/main.tsx          # live TaskList + streaming log tail
//     BUILD_SIM_FAIL=1 node --import tsx …    # step 3 fails → full log flushes to scrollback
//     node --import tsx src/main.tsx | cat    # non-TTY: plain ordered lines, no animation
//
// Each finished step collapses into a permanent `✔ label (1.2s)` line above
// the live region; the final frame persists in scrollback on exit.
import { defineApp, component, signal, onMounted, terminalMount, exitTerminal, Spacer } from '@sigx/terminal';
import { Gradient, TaskList, createLogStore, collapseTask, type TaskItem, type LogStore } from '@sigx/terminal';

interface Step {
    id: string;
    label: string;
    lines: string[];
    durationMs: number;
}

const STEPS: Step[] = [
    {
        id: 'deps',
        label: 'Resolve dependencies',
        durationMs: 900,
        lines: [
            'Reading lockfile',
            'Resolving 214 packages',
            'Fetching metadata\rFetching metadata — 60%\rFetching metadata — done',
            'All dependencies up to date',
        ],
    },
    {
        id: 'pods',
        label: 'pod install',
        durationMs: 2100,
        lines: [
            'Analyzing dependencies',
            'Downloading FBLazyVector\rDownloading FBLazyVector — 45%\rDownloading FBLazyVector (0.74.1) — done',
            'Installing FBLazyVector (0.74.1)',
            'Installing RCT-Folly (2024.01.01.00)',
            'Installing React-Core (0.74.1)',
            'Generating Pods project',
            'Integrating client project',
            'Pod installation complete! 28 dependencies.',
        ],
    },
    {
        id: 'gradle',
        label: 'gradle :app:assembleRelease',
        durationMs: 2400,
        lines: [
            '> Task :app:preBuild UP-TO-DATE',
            '> Task :app:compileReleaseKotlin',
            'warning: variable "tmp" is never used',
            '> Task :app:mergeReleaseResources',
            'Downloading AGP artifacts\rDownloading AGP artifacts — 80%\rDownloading AGP artifacts — done',
            '> Task :app:packageRelease',
            'BUILD SUCCESSFUL in 2s',
        ],
    },
    {
        id: 'sign',
        label: 'Sign artifacts',
        durationMs: 700,
        lines: [
            'Loading keystore release.jks',
            'Signing app-release.apk',
            'Verifying signature',
            'Done.',
        ],
    },
];

const FAIL_STEP = process.env.BUILD_SIM_FAIL ? 'gradle' : null;

const BuildSim = component(() => {
    const state = signal({
        tasks: STEPS.map((s, i): TaskItem => ({
            id: s.id,
            label: s.label,
            status: i === 0 ? 'running' : 'pending',
        })),
        store: createLogStore() as LogStore,
    });

    onMounted(() => {
        void runPipeline();
    });

    async function runPipeline() {
        for (let i = 0; i < STEPS.length; i++) {
            const step = STEPS[i];
            const failing = step.id === FAIL_STEP;
            const store = createLogStore();
            state.store = store;
            state.tasks[i].status = 'running';

            const started = Date.now();
            const interval = step.durationMs / step.lines.length;
            for (const line of step.lines) {
                store.push(line + '\n');
                await sleep(interval);
                if (failing && line.startsWith('warning:')) {
                    store.push('FAILURE: Build failed with an exception.\n');
                    store.push("* What went wrong: Execution failed for task ':app:compileReleaseKotlin'.\n");
                    break;
                }
            }
            store.end();

            const durationMs = Date.now() - started;
            collapseTask({ label: step.label, ok: !failing, durationMs, store });
            state.tasks[i].status = failing ? 'fail' : 'success';
            state.tasks[i].detail = formatMs(durationMs);

            if (failing) {
                for (let j = i + 1; j < STEPS.length; j++) state.tasks[j].status = 'skipped';
                break;
            }
        }
        await sleep(150);
        exitTerminal();
        process.exit(FAIL_STEP ? 1 : 0);
    }

    return () => (
        <box>
            <Gradient text="sigx lynx · build" preset="sigx" />
            <Spacer size={1} />
            <TaskList tasks={state.tasks} log={state.store} logHeight={5} />
        </box>
    );
}, { name: 'BuildSim' });

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function formatMs(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

defineApp(<BuildSim />).mount({ mode: 'inline' }, terminalMount);
