import { component, Text, Spacer, Col, Row } from '@sigx/terminal';
import {
    Sparkline, Meter, Trend, BarChart, DetailList, StatusGrid,
    commonScale, type StatusCell,
} from '@sigx/terminal';

/** A plausible request-rate history, with two polls that never came back. */
const reqs: (number | null)[] = [
    120, 138, 131, 155, 190, 260, 410, 380, 300, 250, 230, 210,
    205, null, null, 190, 240, 320, 500, 640, 610, 540, 470, 430,
];

/** Latency, where the shape matters far more than the absolute level. */
const latency: (number | null)[] = [
    9, 11, 10, 12, 14, 13, 15, 22, 41, 38, 30, 24,
    21, 19, 18, 20, 26, 44, 92, 130, 118, 96, 71, 58,
];

const percentiles = [
    { label: 'p50', value: 18 },
    { label: 'p90', value: 47 },
    { label: 'p99', value: 130 },
];

const shards: StatusCell[] = [
    { label: 'p0', tone: 'ok' }, { label: 'p1', tone: 'ok' },
    { label: 'p2', tone: 'danger' }, { label: 'p3', tone: 'ok' },
    { label: 'p4', tone: 'ok' }, { label: 'p5', tone: 'warn' },
    { label: 'p6', tone: 'ok' }, { label: 'p7', tone: 'idle' },
];

const HOT = [{ at: 0.75, color: 'warn' }, { at: 0.92, color: 'danger' }];

export const MetricsDemo = component(() => {
    return () => (
        <Col>
            {/* Text is inline: each caption line needs its own block. */}
            <Col><Text color="dim">Sparkline — zero-anchored, so a flat series looks flat.</Text></Col>
            <Col><Text color="dim">`·` is a gap, not a zero: those two polls never came back.</Text></Col>
            <Spacer size={1} />
            <Sparkline values={reqs} width={24} label="req/s" value="430" />
            <Sparkline values={latency} width={24} label="p99 ms" value="58ms" thresholds={HOT} />
            <Spacer size={1} />
            <Text color="dim">…two rows deep, and in braille (two samples per cell):</Text>
            <Sparkline values={latency} width={24} height={2} label="p99 ms" thresholds={HOT} />
            <Sparkline values={latency} width={24} height={2} variant="braille" label="p99 ms" />
            <Spacer size={1} />

            <Text color="dim">Meter — a bare gauge. Thresholds colour it as it fills.</Text>
            <Spacer size={1} />
            <Meter label="cpu" value={31} max={100} width={16} text="31%" thresholds={HOT} />
            <Meter label="memory" value={78} max={100} width={16} text="78%" thresholds={HOT} />
            <Meter label="queue" value={96} max={100} width={16} text="96%" thresholds={HOT} smooth />
            <Spacer size={1} />

            <Text color="dim">BarChart — every bar on one scale, so they are comparable.</Text>
            <Spacer size={1} />
            <BarChart
                items={percentiles}
                scale={commonScale(percentiles.map((p) => p.value))}
                width={16}
                format={(ms: number) => `${ms}ms`}
                thresholds={HOT}
            />
            <Spacer size={1} />

            <Row gap={4}>
                <Col>
                    <Text color="dim">DetailList</Text>
                    <Spacer size={1} />
                    <DetailList
                        rows={[
                            { label: 'cluster', value: 'eu-west-1' },
                            { label: 'silos', value: '24' },
                            { label: 'uptime', value: '3d 04:11' },
                            { label: 'errors', value: '17', tone: 'danger' },
                        ]}
                    />
                </Col>
                <Col>
                    <Text color="dim">Trend — polarity decides whether ▲ is bad news</Text>
                    <Spacer size={1} />
                    <Trend value="430 req/s" current={430} previous={470} polarity="higher-is-better" />
                    <Trend value="58ms p99" current={58} previous={41} polarity="higher-is-worse" />
                    <Trend value="24 silos" current={24} previous={24} />
                </Col>
            </Row>
            <Spacer size={1} />

            <Text color="dim">StatusGrid — three states that mean different things</Text>
            <Spacer size={1} />
            <StatusGrid cells={shards} perRow={4} legend="● claimed  ◆ contended  ○ UNCLAIMED  · idle" />
        </Col>
    );
}, { name: 'MetricsDemo' });
