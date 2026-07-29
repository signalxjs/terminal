/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { boxChrome, ellipsize, getTerminalSize, resolveColor } from '@sigx/terminal-zero';
import { Gradient } from '../fx/Gradient';
import { KeyHints, type KeyHint } from '../navigation/KeyHints';
import { StatusBar, type StatusItem } from '../navigation/StatusBar';
import type { TabOption } from '../navigation/Tabs';

/** The area left for a `<Shell>` body once the frame has drawn its chrome. */
export interface ShellPane {
    /** Columns available to the body, inside the frame's borders and padding. */
    width: number;
    /** Rows available to the body. */
    height: number;
}

/** One row of chrome-or-more, carrying what it costs. */
interface Segment {
    rows: number;
    node: unknown;
}

/**
 * A dashboard frame with exactly one job: own the chrome and tell the body
 * what is left.
 *
 * ```tsx
 * <Shell title="sigx actors" version="0.1.0" tabs={TABS} activeTab={tab.value} status={STATUS}>
 *     {(pane) => <DataTable width={pane.width} height={pane.height} columns={COLS} rows={rows} />}
 * </Shell>
 * ```
 *
 * The body is a scoped slot receiving `{ width, height }` — the content box
 * inside the frame. That is the whole point of the component: `getTerminalSize()`
 * reports the *terminal*, and what a body needs is that minus whatever chrome
 * the frame drew, which is a private detail of the frame's own layout. Without
 * this, every caller hardcodes a guess (`rows - 12`, `rows - 13`, `- 4`) that is
 * wrong the moment the frame changes shape.
 *
 * ## A budget, not a reservation
 *
 * `pane` is the **maximum** a body may emit, not an enforced box. The renderer's
 * layout is content-driven end to end — there is no clipping primitive and no
 * way to measure an opaque child — so `<Shell>` cannot hold the box on the
 * body's behalf. A body that emits fewer rows leaves the frame short; one that
 * emits more pushes the footer off the bottom (the renderer clamps a fullscreen
 * frame to the viewport, so the damage stops there rather than shearing the
 * screen). Comply by fitting content to the pane, which `fitLines(lines, pane)`
 * (`@sigx/terminal-zero`) does in one call.
 *
 * ## What this deliberately does not do
 *
 * No state, no key handling, no lifecycle. Tab switching, a command palette, a
 * view stack, single-key shortcuts, exit ordering and the non-TTY fallback are
 * all a few lines in the app, and every app wants to vary them — bundling them
 * is what turns a frame into a cage. `activeTab` is a plain value rather than a
 * `Model` precisely because nothing here ever writes it: it marks the current
 * chip, and the app owns the signal and switches the body itself.
 */
export const Shell = component<
    Define.Prop<'title', string, false> &
    Define.Prop<'version', string, false> &
    Define.Prop<'subtitle', string, false> &
    Define.Prop<'header', 'boxed' | 'plain' | 'gradient', false> &
    Define.Prop<'tabs', TabOption[], false> &
    Define.Prop<'activeTab', string, false> &
    Define.Prop<'body', 'boxed' | 'plain', false> &
    Define.Prop<'bodyTitle', string, false> &
    Define.Prop<'status', StatusItem[], false> &
    Define.Prop<'hints', KeyHint[], false> &
    Define.Slot<'default', ShellPane>
>(({ props, slots }) => {
    return () => {
        // Reactive read — resizes re-render the frame, and the pane with it.
        const { columns, rows } = getTerminalSize();

        // Chrome is built as segments that each carry their own row cost, and
        // the pane is what is left after summing them. Deriving the height from
        // a separate constant beside the JSX is exactly the drift this
        // component exists to remove: a row can only be spent by pushing a
        // segment, and a segment always declares what it costs.
        const above: Segment[] = [];
        const below: Segment[] = [];

        const headerStyle = props.header ?? 'boxed';
        const title = props.title ?? '';
        const raw = props.version ? `${title} v${props.version}` : title;

        // Chrome text is fitted to what it has room for. The renderer already
        // truncates every painted line to the terminal width, so an over-long
        // heading cannot wrap and cannot break the row accounting — but it
        // would be cut mid-word with no sign it had been. Marking the cut is
        // the same rule the rest of the library follows.
        if (title) {
            if (headerStyle === 'boxed') {
                const inner = columns - boxChrome({ border: true, padX: 1 }).cols;
                above.push({
                    rows: 3, // 2 border + 1 content
                    node: (
                        <box border="thick" borderColor={resolveColor('accent')} padX={1}>
                            <text color={resolveColor('accent')}>{ellipsize(raw, inner)}</text>
                        </box>
                    ),
                });
            } else {
                const heading = ellipsize(raw, columns);
                above.push(headerStyle === 'gradient'
                    ? { rows: 1, node: <Gradient text={heading} preset="sigx" /> }
                    : { rows: 1, node: <box><text color={resolveColor('accent')}>{heading}</text></box> });
            }
        }

        if (props.subtitle) {
            above.push({
                rows: 1,
                node: (
                    <box>
                        <text color={resolveColor('dim')}>{ellipsize(props.subtitle, columns)}</text>
                    </box>
                ),
            });
        }

        // A one-tab strip says nothing, so it is not drawn — and the row it
        // would have cost goes to the body.
        const tabs = props.tabs ?? [];
        if (tabs.length > 1) {
            const current = props.activeTab ?? tabs[0]?.value;
            above.push({
                rows: 1,
                node: (
                    <box>
                        {tabs.map((tab, i) => {
                            const on = tab.value === current;
                            return (
                                <text
                                    backgroundColor={resolveColor(on ? 'accent' : 'accentSoft')}
                                    color={resolveColor(on ? 'accentText' : 'dim')}
                                > {i + 1} {tab.label} </text>
                            );
                        })}
                    </box>
                ),
            });
        }

        // Emptiness, not presence: an app that builds its footer conditionally
        // passes `[]`, and charging a row for a footer with nothing in it would
        // shrink the pane to draw a blank line.
        if (props.status?.length) below.push({ rows: 1, node: <StatusBar items={props.status} /> });
        if (props.hints?.length) below.push({ rows: 1, node: <KeyHints hints={props.hints} /> });

        // A `<Spacer size={0}>` still renders one row, so a blank line has to be
        // omitted rather than sized away.
        if (above.length) above.push({ rows: 1, node: <box><text> </text></box> });
        if (below.length) below.unshift({ rows: 1, node: <box><text> </text></box> });

        // One object, spread onto the body `<box>` *and* measured by
        // `boxChrome`: the pane the body is handed and the box drawn around it
        // are the same fact, not two that have to be kept in agreement.
        const boxed = (props.body ?? 'boxed') === 'boxed';
        const bodyBox = { border: 'rounded', padX: 1, dropShadow: true } as const;
        const bodyChrome = boxed ? boxChrome(bodyBox) : boxChrome({});

        const spent = [...above, ...below].reduce((n, s) => n + s.rows, bodyChrome.rows);
        const pane: ShellPane = {
            width: Math.max(1, columns - bodyChrome.cols),
            height: Math.max(1, rows - spent),
        };

        const content = slots.default?.(pane);

        return (
            <box>
                {above.map((s) => s.node)}
                {boxed
                    ? (
                        // `bodyTitle` is fitted to the pane because `drawBox`
                        // widens the box to `label.length + 2` when the label
                        // is longer than the content — which would push the
                        // right border and shadow past the terminal edge, where
                        // the renderer's width clamp cuts them off.
                        <box
                            {...bodyBox}
                            borderColor={resolveColor('line')}
                            label={props.bodyTitle ? ellipsize(props.bodyTitle, pane.width) : undefined}
                            labelColor={resolveColor('accent')}
                            shadowColor={resolveColor('shadow')}
                        >
                            {content}
                        </box>
                    )
                    : <box>{content}</box>}
                {below.map((s) => s.node)}
            </box>
        );
    };
}, { name: 'Shell' });

export default Shell;
