/** @jsxImportSource @sigx/runtime-core */
import { component, signal, Text, Spacer, Col } from '@sigx/terminal';
import { Input, Checkbox, Select, Radio, MultiSelect, Confirm } from '@sigx/terminal';

export const FormsDemo = component(() => {
    const name = signal('');
    const agree = signal(false);
    const fruit = signal('apple');
    const size = signal('m');
    const toppings = signal({ picked: ['cheese'] as string[] });
    const proceed = signal(true);

    return () => (
        <Col>
            <Text color="dim">Tab between fields. Type in the input; Space toggles; ↑/↓ or j/k in lists.</Text>
            <Spacer size={1} />
            <Input model={name} label="Name" placeholder="type your name…" />
            <Spacer size={1} />
            <Checkbox model={agree} label="I agree to the terms" />
            <Spacer size={1} />
            <Select
                label="Fruit"
                model={fruit}
                options={[
                    { label: 'Apple', value: 'apple' },
                    { label: 'Banana', value: 'banana' },
                    { label: 'Cherry', value: 'cherry' },
                ]}
            />
            <Spacer size={1} />
            <Radio
                label="Size"
                model={size}
                options={[
                    { label: 'Small', value: 's' },
                    { label: 'Medium', value: 'm' },
                    { label: 'Large', value: 'l' },
                ]}
            />
            <Spacer size={1} />
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
            <Spacer size={1} />
            <Confirm label="Proceed with the order?" model={() => proceed.value} />
            <Spacer size={1} />
            <Text color="fg">Hello </Text>
            <Text color="accent">{name.value || 'stranger'}</Text>
            <Text color="fg"> — {agree.value ? 'agreed' : 'not agreed'}, {fruit.value}/{size.value}, [{toppings.picked.join('+') || 'plain'}], {proceed.value ? 'go' : 'hold'}</Text>
        </Col>
    );
}, { name: 'FormsDemo' });
