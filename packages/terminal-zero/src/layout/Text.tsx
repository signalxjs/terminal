/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor } from '../theme';

/**
 * Typography span — the token-aware way to write styled text without
 * touching `resolveColor` or raw `<text>`:
 *
 *     <Text color="dim">Scan with sigx-lynx-go:</Text>
 *     <Text color="danger" bold>failed</Text>
 *
 * `color`/`bg` accept theme tokens or `#hex`. Style flags map to terminal
 * SGR attributes (rendering depends on the emulator; all are gated off for
 * piped/CI output).
 *
 * NOTE — deliberately INLINE, unlike every other component: Text is a span
 * that composes inside a line (`<Text color="accent">{n}</Text> items`).
 * Standalone lines use `Heading` or wrap in a layout component.
 *
 * There is no `size`/`weight` enum: terminal cells have exactly one size;
 * weight is the `bold`/`faint` pair. This mirrors the daisy/lynx `Text`
 * shape (discrete props, no variant) minus what a terminal cannot do.
 */
export const Text = component<
    Define.Prop<'color', string, false> &
    Define.Prop<'bg', string, false> &
    Define.Prop<'bold', boolean, false> &
    Define.Prop<'faint', boolean, false> &
    Define.Prop<'italic', boolean, false> &
    Define.Prop<'underline', boolean, false> &
    Define.Prop<'lineThrough', boolean, false> &
    Define.Prop<'inverse', boolean, false> &
    Define.Slot<'default'>
>(({ props, slots }) => {
    return () => (
        <text
            color={props.color ? resolveColor(props.color) : undefined}
            backgroundColor={props.bg ? resolveColor(props.bg) : undefined}
            bold={props.bold}
            faint={props.faint}
            italic={props.italic}
            underline={props.underline}
            lineThrough={props.lineThrough}
            inverse={props.inverse}
        >
            {slots.default?.()}
        </text>
    );
}, { name: 'Text' });

/**
 * A standalone bold line — the terminal analog of a heading. Block element
 * (its own line), default color `fg`.
 */
export const Heading = component<
    Define.Prop<'color', string, false> &
    Define.Slot<'default'>
>(({ props, slots }) => {
    return () => (
        <box>
            <text bold color={resolveColor(props.color ?? 'fg')}>
                {slots.default?.()}
            </text>
        </box>
    );
}, { name: 'Heading' });

export default Text;
