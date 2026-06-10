/** @jsxImportSource @sigx/runtime-core */
import { component, signal } from '@sigx/terminal';
import { Input, Checkbox, Select, Radio, resolveColor } from '@sigx/terminal';

export const FormsDemo = component(() => {
    const name = signal('');
    const agree = signal(false);
    const fruit = signal('apple');
    const size = signal('m');

    return () => (
        <box>
            <text color={resolveColor('dim')}>Tab between fields. Type in the input; Space toggles; ↑/↓ or j/k in lists.</text>
            <box></box>
            <Input model={name} label="Name" placeholder="type your name…" />
            <box></box>
            <Checkbox model={agree} label="I agree to the terms" />
            <box></box>
            <Select
                label="Fruit"
                model={fruit}
                options={[
                    { label: 'Apple', value: 'apple' },
                    { label: 'Banana', value: 'banana' },
                    { label: 'Cherry', value: 'cherry' },
                ]}
            />
            <box></box>
            <Radio
                label="Size"
                model={size}
                options={[
                    { label: 'Small', value: 's' },
                    { label: 'Medium', value: 'm' },
                    { label: 'Large', value: 'l' },
                ]}
            />
            <box></box>
            <text color={resolveColor('fg')}>Hello </text>
            <text color={resolveColor('accent')}>{name.value || 'stranger'}</text>
            <text color={resolveColor('fg')}> — {agree.value ? 'agreed' : 'not agreed'}, {fruit.value}/{size.value}</text>
        </box>
    );
}, { name: 'FormsDemo' });
