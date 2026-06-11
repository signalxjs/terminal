/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';

/**
 * Horizontal layout: each slot child renders as a column, merged side by side
 * (the renderer pads every column to its own display width and zips the lines).
 * `gap` is the spacing between columns (default 2); `align` places shorter
 * columns at the top (default), center, or bottom. A row wider than the
 * terminal clips at the right edge — put the column that must stay intact
 * leftmost.
 */
export const Row = component<
    Define.Slot<'default'> &
    Define.Prop<'gap', number, false> &
    Define.Prop<'align', 'top' | 'center' | 'bottom', false>
>(({ props, slots }) => {
    return () => (
        <row gap={props.gap ?? 2} align={props.align ?? 'top'}>
            {slots.default?.()}
        </row>
    );
}, { name: 'Row' });

export default Row;
