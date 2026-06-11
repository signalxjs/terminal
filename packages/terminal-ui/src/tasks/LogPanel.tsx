/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor, getTerminalSize, truncateToWidth } from '@sigx/terminal-zero';
import type { LogStore } from './logStore';

/**
 * Streaming log tail: the last `height` lines of a stream, dimmed, in
 * one of three variants:
 * - `bar`   — `│` gutter in the `line` color (default)
 * - `panel` — rounded bordered box with the title as its label
 * - `plain` — bare lines
 * Feed it a LogStore (preferred — reactive, `\r`-aware) or a plain `lines`
 * array. Follow-tail is inherent: it always shows the last `height` lines.
 * Lines are truncated escape-aware, so tool output containing its own ANSI
 * can't overflow the inline live region.
 */
export const LogPanel = component<
    Define.Prop<"store", LogStore, false> &
    Define.Prop<"lines", string[], false> &
    Define.Prop<"height", number, false> &
    Define.Prop<"width", number, false> &
    Define.Prop<"title", string, false> &
    Define.Prop<"variant", 'bar' | 'plain' | 'panel', false> &
    Define.Prop<"color", string, false>
>(({ props }) => {
    return () => {
        const height = props.height || 6;
        const width = props.width || Math.max(20, getTerminalSize().columns - 4);
        const variant = props.variant || 'bar';
        const textColor = resolveColor(props.color || 'dim');
        // Box borders keep the `line` token (drawn on the themed canvas), but
        // the bare bar/title glyphs render on the terminal's own background in
        // inline mode, where `line` can be near-invisible — use `dim`.
        const borderColor = resolveColor('line');
        const glyphColor = resolveColor('dim');

        const src = props.store
            ? props.store.tail(height)
            : (props.lines ?? []).slice(-height);

        if (variant === 'panel') {
            return (
                <box border="rounded" borderColor={borderColor} label={props.title} labelColor={resolveColor('accent')} padX={1}>
                    {src.flatMap((line, i) => {
                        const row = <text color={textColor}>{truncateToWidth(line, width - 4)}</text>;
                        return i > 0 ? [<br />, row] : [row];
                    })}
                    {src.length === 0 && <text color={resolveColor('faint')}>…</text>}
                </box>
            );
        }

        const gutter = variant === 'bar' ? 2 : 0;
        const rows = src.flatMap((line, i) => {
            const row = (
                <text>
                    {variant === 'bar' && <text color={glyphColor}>│ </text>}
                    <text color={textColor}>{truncateToWidth(line, width - gutter)}</text>
                </text>
            );
            return i > 0 ? [<br />, row] : [row];
        });

        return (
            <box>
                {props.title && [
                    <text color={glyphColor}>{variant === 'bar' ? '┌ ' : ''}</text>,
                    <text color={resolveColor('dim')}>{props.title}</text>,
                    <br />,
                ]}
                {rows}
            </box>
        );
    };
}, { name: 'LogPanel' });

export default LogPanel;
