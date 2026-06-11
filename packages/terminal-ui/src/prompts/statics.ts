/**
 * Static framing for prompt flows — plain permanent lines, no mount:
 *
 *   ┌ create sigx app          intro
 *   ◇ Project name · my-app    (prompt summaries land between)
 *   │ a note line              note
 *   └ Done — next: pnpm dev    outro
 *   ■ Cancelled.               cancel
 */
import { printStatic } from '@sigx/terminal-zero';
import { paintToken } from '@sigx/terminal-zero';

/** Open a prompt flow with a title bar. */
export function intro(title: string): void {
    printStatic(`${paintToken('┌', 'line')} ${paintToken(title, 'accent')}`);
}

/** Close a prompt flow. */
export function outro(message: string): void {
    printStatic(`${paintToken('└', 'line')} ${message}\n`);
}

/** An informational block inside a flow. */
export function note(message: string, title?: string): void {
    const lines: string[] = [];
    if (title) lines.push(`${paintToken('○', 'accent')} ${title}`);
    for (const line of message.split('\n')) {
        lines.push(`${paintToken('│', 'line')} ${paintToken(line, 'dim')}`);
    }
    printStatic(lines.join('\n'));
}

/** Announce a cancelled flow (pair with isCancel + process.exit). */
export function cancel(message: string): void {
    printStatic(`${paintToken('■', 'danger')} ${message}`);
}
