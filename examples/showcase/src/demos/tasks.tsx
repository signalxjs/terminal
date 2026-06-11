/** @jsxImportSource @sigx/runtime-core */
import { component, signal, onMounted, onUnmounted } from '@sigx/terminal';
import { resolveColor, TaskList, createLogStore, type TaskItem } from '@sigx/terminal';

const FAKE_OUTPUT = [
    'Analyzing dependencies',
    'Downloading specs repository',
    'Downloading FBLazyVector (0.74.1)\rDownloading FBLazyVector (0.74.1) — 45%\rDownloading FBLazyVector (0.74.1) — done',
    'Installing FBLazyVector (0.74.1)',
    'Installing RCT-Folly (2024.01.01.00)',
    'Installing React-Core (0.74.1)',
    'Generating Pods project',
    'Integrating client project',
    'Pod installation complete!',
];

export const TasksDemo = component(() => {
    const store = createLogStore();
    const state = signal({
        tasks: [
            { id: 'deps', label: 'Resolve dependencies', status: 'success', detail: '0.8s' },
            { id: 'pods', label: 'Install pods', status: 'running' },
            { id: 'gradle', label: 'Build android', status: 'pending' },
            { id: 'sign', label: 'Sign artifacts', status: 'pending' },
        ] as TaskItem[],
    });

    let timer: ReturnType<typeof setInterval> | null = null;
    let line = 0;

    onMounted(() => {
        timer = setInterval(() => {
            store.push(FAKE_OUTPUT[line % FAKE_OUTPUT.length] + '\n');
            line++;
            if (line % FAKE_OUTPUT.length === 0) {
                // Cycle: complete the running task, start the next, loop around.
                const tasks = state.tasks;
                const running = tasks.findIndex((t) => t.status === 'running');
                if (running >= 0) {
                    tasks[running].status = 'success';
                    tasks[running].detail = '2.1s';
                    const next = (running + 1) % tasks.length;
                    tasks[next].status = 'running';
                    tasks[next].detail = undefined;
                    store.clear();
                }
            }
        }, 350);
    });
    onUnmounted(() => { if (timer) clearInterval(timer); });

    return () => (
        <box>
            <text color={resolveColor('dim')}>Build pipeline: spinner per task, log tail under the running one.</text>
            <box></box>
            <TaskList tasks={state.tasks} log={store} logHeight={5} />
            <box></box>
            <text color={resolveColor('dim')}>Tree variant:</text>
            <TaskList tasks={state.tasks} variant="tree" />
        </box>
    );
}, { name: 'TasksDemo' });
