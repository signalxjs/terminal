/** @jsxImportSource @sigx/runtime-core */
import { component, signal } from '@sigx/terminal';
import { Button, resolveColor } from '@sigx/terminal';

export const ButtonsDemo = component(() => {
    const state = signal({ clicks: 0 });
    return () => (
        <box>
            <text color={resolveColor('dim')}>Press Tab to focus a button, then Enter or Space to click.</text>
            <box></box>
            <Button label="Primary Action" onClick={() => { state.clicks++; }} />
            <Button label="Second Button" onClick={() => { state.clicks++; }} />
            <Button label="With Drop Shadow" dropShadow={true} onClick={() => { state.clicks++; }} />
            <box></box>
            <text color={resolveColor('fg')}>Total clicks: </text>
            <text color={resolveColor('success')}>{String(state.clicks)}</text>
        </box>
    );
}, { name: 'ButtonsDemo' });
