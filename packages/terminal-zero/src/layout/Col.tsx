/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';

/**
 * Vertical stack. The renderer already lays block children out top-to-bottom,
 * so `Col` is a borderless grouping box with optional spacing: `gap` inserts
 * that many blank rows BETWEEN children (not before or after) — the
 * component-layer replacement for `<box></box>` spacer hacks. For
 * side-by-side columns, see `Row`.
 */
export const Col = component<
    Define.Prop<'gap', number, false> &
    Define.Slot<'default'>
>(({ props, slots }) => {
    return () => {
        const children = slots.default?.();
        const gap = Math.max(0, props.gap ?? 0);
        if (!gap || !Array.isArray(children) || children.length < 2) {
            return <box>{children}</box>;
        }
        const spaced: unknown[] = [];
        children.forEach((child, i) => {
            if (i > 0) {
                for (let g = 0; g < gap; g++) {
                    spaced.push(<box><text> </text></box>);
                }
            }
            spaced.push(child);
        });
        return <box>{spaced}</box>;
    };
}, { name: 'Col' });

export default Col;
