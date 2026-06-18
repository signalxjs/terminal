import { component, signal, Text, Spacer, Col } from '@sigx/terminal';
import { Button } from '@sigx/terminal';

export const ButtonsDemo = component(() => {
    const state = signal({ clicks: 0 });
    return () => (
        <Col>
            <Text color="dim">Press Tab to focus a button, then Enter or Space to click.</Text>
            <Spacer size={1} />
            <Button label="Primary Action" onClick={() => { state.clicks++; }} />
            <Button label="Second Button" onClick={() => { state.clicks++; }} />
            <Button label="With Drop Shadow" dropShadow={true} onClick={() => { state.clicks++; }} />
            <Spacer size={1} />
            <Text color="fg">Total clicks: </Text>
            <Text color="success">{String(state.clicks)}</Text>
        </Col>
    );
}, { name: 'ButtonsDemo' });
