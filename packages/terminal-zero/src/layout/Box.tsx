/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor } from '../theme';

/**
 * Themed container. A thin wrapper over the renderer's `<box>` that resolves
 * token-named colors and defaults to a rounded `line` border with a themed
 * drop shadow. Skins compose this; raw `<box>` stays available for the renderer.
 */
export const Box = component<
    Define.Prop<'border', 'single' | 'double' | 'rounded' | 'thick' | 'none', false> &
    Define.Prop<'borderColor', string, false> &
    Define.Prop<'backgroundColor', string, false> &
    Define.Prop<'label', string, false> &
    Define.Prop<'labelColor', string, false> &
    Define.Prop<'padX', number, false> &
    Define.Prop<'dropShadow', boolean, false> &
    Define.Slot<'default'>
>(({ props, slots }) => {
    return () => (
        <box
            border={props.border ?? 'rounded'}
            borderColor={resolveColor(props.borderColor ?? 'line')}
            backgroundColor={props.backgroundColor ? resolveColor(props.backgroundColor) : undefined}
            label={props.label}
            labelColor={resolveColor(props.labelColor ?? 'accent')}
            padX={props.padX}
            dropShadow={props.dropShadow}
            shadowColor={resolveColor('shadow')}
        >
            {slots.default?.()}
        </box>
    );
}, { name: 'Box' });

export default Box;
