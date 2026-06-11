/** @jsxImportSource @sigx/runtime-core */
import { component } from '@sigx/terminal';
import { Box, Row, Divider, Spacer, Card, resolveColor } from '@sigx/terminal';

export const LayoutDemo = component(() => {
    return () => (
        <box>
            <text color={resolveColor('dim')}>Layout primitives from terminal-zero + the Card from terminal-ui.</text>
            <Spacer size={1} />
            <Box label="Themed Box" padX={1}>
                <text color={resolveColor('fg')}>A themed Box defaults to a rounded line border.</text>
            </Box>
            <Spacer size={1} />
            <Divider label="section" width={36} />
            <Spacer size={1} />
            <Card title="Card" dropShadow={true}>
                <text color={resolveColor('fg')}>A Card is a padded panel with an optional title</text>
                <br />
                <text color={resolveColor('fg')}>and a themed drop shadow.</text>
            </Card>
            <Spacer size={1} />
            <Divider label="Row" width={36} />
            <Spacer size={1} />
            <Row gap={2}>
                <Box label="left" padX={1}>
                    <text color={resolveColor('fg')}>columns,</text>
                </Box>
                <Box label="right" padX={1}>
                    <text color={resolveColor('fg')}>side by side</text>
                </Box>
            </Row>
            <Spacer size={1} />
            <Row gap={2} align="bottom">
                <Box padX={1}>
                    <text color={resolveColor('fg')}>tall</text>
                    <br />
                    <text color={resolveColor('fg')}>column</text>
                </Box>
                <Box padX={1}>
                    <text color={resolveColor('dim')}>align="bottom"</text>
                </Box>
            </Row>
        </box>
    );
}, { name: 'LayoutDemo' });
