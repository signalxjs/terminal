/** @jsxImportSource @sigx/runtime-core */
import { component, Text, Heading, Col } from '@sigx/terminal';
import { Box, Row, Divider, Spacer, Card } from '@sigx/terminal';

export const LayoutDemo = component(() => {
    return () => (
        <Col>
            <Text color="dim">Layout primitives from terminal-zero + the Card from terminal-ui.</Text>
            <Spacer size={1} />
            <Heading>Typography</Heading>
            <Col>
                <Text color="dim">Inline spans compose: </Text>
                <Text color="accent" bold>bold accent</Text>
                <Text color="fg">, </Text>
                <Text color="success" italic>italic success</Text>
                <Text color="fg">, </Text>
                <Text color="warn" underline>underlined</Text>
                <Text color="fg">, </Text>
                <Text color="danger" lineThrough>struck</Text>
                <Text color="fg">, </Text>
                <Text faint>faint</Text>
                <Text color="fg"> and </Text>
                <Text inverse>inverse</Text>
                <Text color="fg">.</Text>
            </Col>
            <Spacer size={1} />
            <Box label="Themed Box" padX={1}>
                <Text color="fg">A themed Box defaults to a rounded line border.</Text>
            </Box>
            <Spacer size={1} />
            <Divider label="section" width={36} />
            <Spacer size={1} />
            <Card title="Card" dropShadow={true}>
                <Text color="fg">A Card is a padded panel with an optional title</Text>
                <br />
                <Text color="fg">and a themed drop shadow.</Text>
            </Card>
            <Spacer size={1} />
            <Divider label="Row" width={36} />
            <Spacer size={1} />
            <Row gap={2}>
                <Box label="left" padX={1}>
                    <Text color="fg">columns,</Text>
                </Box>
                <Box label="right" padX={1}>
                    <Text color="fg">side by side</Text>
                </Box>
            </Row>
            <Spacer size={1} />
            <Row gap={2} align="bottom">
                <Box padX={1}>
                    <Text color="fg">tall</Text>
                    <br />
                    <Text color="fg">column</Text>
                </Box>
                <Box padX={1}>
                    <Text color="dim">align="bottom"</Text>
                </Box>
            </Row>
        </Col>
    );
}, { name: 'LayoutDemo' });
