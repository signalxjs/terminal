/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import { resolveColor, GLYPHS, SPINNERS, getTick, subscribeTicker } from '@sigx/terminal-zero';
import { LogPanel } from './LogPanel';
import type { LogStore } from './logStore';

export type TaskStatus = 'pending' | 'running' | 'success' | 'fail' | 'skipped';

export interface TaskItem {
    id: string;
    label: string;
    status: TaskStatus;
    /** Optional dimmed suffix, e.g. a duration or a count. */
    detail?: string;
}

/**
 * Build-pipeline task list: one row per task with a status glyph (pending ◌,
 * running spinner, ✔/✖, skipped −), in `plain` or `tree` (├─/└─ guides)
 * variants. Pass a LogStore via `log` to stream a LogPanel tail under the
 * running task. Data-driven: mutate the `tasks` array in place (statuses are
 * reactive through the signal proxy).
 */
export const TaskList = component<
    Define.Prop<"tasks", TaskItem[], true> &
    Define.Prop<"variant", 'plain' | 'tree', false> &
    Define.Prop<"log", LogStore, false> &
    Define.Prop<"logHeight", number, false>
>(({ props }) => {
    let unsub: (() => void) | null = null;

    onMounted(() => { unsub = subscribeTicker(); });
    onUnmounted(() => { unsub?.(); });

    return () => {
        const tasks = props.tasks ?? [];
        const tree = props.variant === 'tree';
        const lineColor = resolveColor('line');

        const glyphFor = (status: TaskStatus): [string, string, string] => {
            // [glyph, glyph color token, label color token]
            switch (status) {
                case 'running': return [SPINNERS.dots[getTick() % SPINNERS.dots.length], 'accent', 'fg'];
                case 'success': return [GLYPHS.check, 'success', 'fg'];
                case 'fail': return [GLYPHS.cross, 'danger', 'danger'];
                case 'skipped': return ['−', 'dim', 'dim'];
                default: return ['◌', 'faint', 'dim'];
            }
        };

        return (
            <box>
                {tasks.flatMap((task, i) => {
                    const [glyph, glyphToken, labelToken] = glyphFor(task.status);
                    const guide = tree ? (i === tasks.length - 1 ? '└─ ' : '├─ ') : '';
                    const row = (
                        <text>
                            {tree && <text color={lineColor}>{guide}</text>}
                            <text color={resolveColor(glyphToken)}>{glyph}</text>
                            <text color={resolveColor(labelToken)}> {task.label}</text>
                            {task.detail && <text color={resolveColor('dim')}> ({task.detail})</text>}
                        </text>
                    );
                    const parts = i > 0 ? [<br />, row] : [row];
                    if (task.status === 'running' && props.log) {
                        parts.push(<LogPanel store={props.log} height={props.logHeight || 6} variant="bar" />);
                    }
                    return parts;
                })}
            </box>
        );
    };
}, { name: 'TaskList' });

export default TaskList;
