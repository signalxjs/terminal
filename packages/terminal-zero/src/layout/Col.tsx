/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';

/**
 * Vertical stack. The renderer already lays block children out top-to-bottom,
 * so `Col` is a borderless grouping box — useful as a single root for a list of
 * components. (A horizontal `Row` is intentionally omitted: the line-based
 * renderer can't place bordered boxes side by side.)
 */
export const Col = component<Define.Slot<'default'>>(({ slots }) => {
    return () => <box>{slots.default?.()}</box>;
}, { name: 'Col' });

export default Col;
