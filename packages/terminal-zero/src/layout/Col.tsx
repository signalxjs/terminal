/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';

/**
 * Vertical stack. The renderer already lays block children out top-to-bottom,
 * so `Col` is a borderless grouping box — useful as a single root for a list of
 * components. For side-by-side columns, see `Row`.
 */
export const Col = component<Define.Slot<'default'>>(({ slots }) => {
    return () => <box>{slots.default?.()}</box>;
}, { name: 'Col' });

export default Col;
