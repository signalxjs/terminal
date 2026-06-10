/**
 * Injectable output target: every byte the renderer emits goes through here.
 *
 * The default target wraps `process.stdout` with live dimension getters, so
 * resizes are always read fresh. Tests (and embedders) swap in a fake via
 * `setOutputTarget()` to capture frames without a real TTY.
 */

export interface OutputTarget {
    write(s: string): void;
    columns: number;
    rows: number;
    isTTY: boolean;
}

const stdoutTarget: OutputTarget = {
    write(s: string) {
        process.stdout.write(s);
    },
    get columns() {
        return process.stdout.columns || 80;
    },
    get rows() {
        return process.stdout.rows || 24;
    },
    get isTTY() {
        return !!process.stdout.isTTY;
    },
};

let target: OutputTarget = stdoutTarget;

/** Replace the output target (pass undefined to restore `process.stdout`). */
export function setOutputTarget(next?: OutputTarget): void {
    target = next ?? stdoutTarget;
}

export function getOutputTarget(): OutputTarget {
    return target;
}
