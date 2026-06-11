/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';

/** Vertical gap of `size` blank lines (default 1). */
export const Spacer = component<
    Define.Prop<'size', number, false>
>(({ props }) => {
    return () => {
        const size = Math.max(1, props.size ?? 1);
        // A <box> already renders one line; each <br/> adds another — so
        // exactly `size` blank lines means size-1 breaks.
        const breaks = [];
        for (let i = 0; i < size - 1; i++) breaks.push(<br />);
        return <box>{breaks}</box>;
    };
}, { name: 'Spacer' });

export default Spacer;
