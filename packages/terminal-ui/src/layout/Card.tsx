/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor } from '@sigx/terminal-zero';

/** A rounded panel with horizontal padding, an optional title, and shadow. */
export const Card = component<
    Define.Prop<"title", string, false> &
    Define.Prop<"dropShadow", boolean, false> &
    Define.Slot<'default'>
>(({ props, slots }) => {
    return () => (
        <box
            border="rounded"
            borderColor={resolveColor('line')}
            label={props.title}
            labelColor={resolveColor('accent')}
            padX={1}
            dropShadow={props.dropShadow}
            shadowColor={resolveColor('shadow')}
        >
            {slots.default?.()}
        </box>
    );
}, { name: 'Card' });

export default Card;
