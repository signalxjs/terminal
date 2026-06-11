/** @jsxImportSource @sigx/runtime-core */
import { component, signal } from '@sigx/terminal';
import { Input, Checkbox, Select, Radio, MultiSelect, Confirm, resolveColor } from '@sigx/terminal';

export const FormsDemo = component(() => {
    const name = signal('');
    const agree = signal(false);
    const fruit = signal('apple');
    const size = signal('m');
    const toppings = signal({ picked: ['cheese'] as string[] });
    const proceed = signal(true);

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
            <MultiSelect
                label="Toppings"
                model={() => toppings.picked}
                showHint
                options={[
                    { label: 'Cheese', value: 'cheese' },
                    { label: 'Basil', value: 'basil' },
                    { label: 'Mushrooms', value: 'mushrooms' },
                ]}
            />
            <box></box>
            <Confirm label="Proceed with the order?" model={() => proceed.value} />
            <box></box>
            <text color={resolveColor('fg')}>Hello </text>
            <text color={resolveColor('accent')}>{name.value || 'stranger'}</text>
            <text color={resolveColor('fg')}> — {agree.value ? 'agreed' : 'not agreed'}, {fruit.value}/{size.value}, [{toppings.picked.join('+') || 'plain'}], {proceed.value ? 'go' : 'hold'}</text>
        </box>
    );
}, { name: 'FormsDemo' });
