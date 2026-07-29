import { component, signal, onMounted, onUnmounted, Text, Spacer, Col, Row, type Define } from '@sigx/terminal';
import {
    Sparkline, Meter, Trend, BarChart, DetailList, StatusGrid,
    commonScale, type StatusCell, type StatusTone,
} from '@sigx/terminal';

const WINDOW = 24;
/** How often the "poll" lands. A real dashboard ticks about this fast. */
const POLL_MS = 250;

/**
 * A caption line. `Text` is inline, so a bare one directly after a `Spacer`
 * lands ON the spacer's blank line instead of below it — the `Col` makes it a
 * block of its own.
 */
const Caption = component<Define.Slot<'default'>>(({ slots }) => {
    return () => <Col><Text color="dim">{slots.default?.()}</Text></Col>;
}, { name: 'Caption' });

/** Smooth, deterministic wobble — organic enough to watch, same every run. */
const wave = (t: number, period: number, phase = 0) => Math.sin((t / period + phase) * Math.PI * 2);

/** Request rate: a slow swell with a faster ripple on top. */
function reqAt(t: number): number {
    return Math.round(320 + 180 * wave(t, 47) + 60 * wave(t, 11, 0.3));
}

/** Latency: mostly calm, with a periodic spike that trails off. */
function latencyAt(t: number): number {
    const spike = Math.max(0, wave(t, 61, 0.25)) ** 6;
    return Math.round(14 + 8 * wave(t, 17, 0.6) + 130 * spike);
}

/** Every ~30th poll never comes back — so the gap glyph is visible live. */
const isGap = (t: number) => t % 31 === 0 || t % 31 === 1;

const sampleAt = (t: number, at: (t: number) => number): number | null =>
    isGap(t) ? null : at(t);

const seed = (at: (t: number) => number): (number | null)[] =>
    Array.from({ length: WINDOW }, (_, i) => sampleAt(i, at));

const TONES: StatusTone[] = ['ok', 'ok', 'danger', 'ok', 'ok', 'warn', 'ok', 'idle'];
const HOT = [{ at: 0.75, color: 'warn' }, { at: 0.92, color: 'danger' }];

export const MetricsDemo = component(() => {
    const state = signal({
        t: WINDOW,
        reqs: seed(reqAt),
        latency: seed(latencyAt),
    });

    let timer: ReturnType<typeof setInterval> | null = null;
    onMounted(() => {
        timer = setInterval(() => {
            const t = state.t + 1;
            state.t = t;
            // Replaced wholesale rather than mutated: the signal tracks the
            // array identity, and a dashboard's history is a window anyway.
            state.reqs = [...state.reqs.slice(1), sampleAt(t, reqAt)];
            state.latency = [...state.latency.slice(1), sampleAt(t, latencyAt)];
        }, POLL_MS);
    });
    onUnmounted(() => { if (timer) clearInterval(timer); });

    return () => {
        const { t, reqs, latency } = state;
        const last = <T,>(xs: T[]) => xs[xs.length - 1]!;
        const reqNow = last(reqs);
        const reqPrev = reqs[reqs.length - 2] ?? null;
        const msNow = last(latency);
        const msPrev = latency[latency.length - 2] ?? null;

        // Percentiles straight out of the live window. `commonScale`'s `clip`
        // is a quantile, so it does the work — and scaling the panel to p99
        // rather than the max is exactly why a spike doesn't flatten the rest.
        const finite = latency.filter((v): v is number => v !== null);
        const percentiles = [
            { label: 'p50', value: commonScale(finite, { clip: 0.5 }) },
            { label: 'p90', value: commonScale(finite, { clip: 0.9 }) },
            { label: 'p99', value: commonScale(finite, { clip: 0.99 }) },
        ];
        const scale = commonScale(percentiles.map((p) => p.value));

        // One shard drifts through the states, so the grid is not a still life.
        const shards: StatusCell[] = TONES.map((tone, i) => ({
            label: `p${i}`,
            tone: i === (Math.floor(t / 8) % TONES.length) ? 'warn' : tone,
        }));

        const cpu = Math.round(46 + 34 * wave(t, 23));
        const memory = Math.round(70 + 22 * wave(t, 53, 0.4));
        const queue = Math.round(50 + 46 * wave(t, 13, 0.7));

        return (
            <Col>
                <Caption>Sparkline — live, zero-anchored, so a flat series stays flat.</Caption>
                <Caption>`·` is a gap, not a zero: watch the poll that never comes back.</Caption>
                <Spacer size={1} />
                <Sparkline values={reqs} width={WINDOW} label="req/s" value={`${reqNow ?? '—'}`} />
                <Sparkline
                    values={latency}
                    width={WINDOW}
                    label="latency"
                    value={`${msNow ?? '—'}ms`}
                    thresholds={HOT}
                />
                <Spacer size={1} />
                <Caption>…two rows deep, and in braille (two samples per cell):</Caption>
                <Sparkline values={latency} width={WINDOW} height={2} label="latency" thresholds={HOT} />
                <Sparkline values={latency} width={WINDOW} height={2} variant="braille" label="latency" />
                <Spacer size={1} />

                <Caption>Meter — a bare gauge. Thresholds colour it as it fills.</Caption>
                <Spacer size={1} />
                <Meter label="cpu" value={cpu} max={100} width={16} text={`${cpu}%`} thresholds={HOT} />
                <Meter label="memory" value={memory} max={100} width={16} text={`${memory}%`} thresholds={HOT} />
                <Meter label="queue" value={queue} max={100} width={16} text={`${queue}%`} thresholds={HOT} smooth />
                <Spacer size={1} />

                <Caption>BarChart — every bar on one scale, so they stay comparable.</Caption>
                <Spacer size={1} />
                <BarChart
                    items={percentiles}
                    scale={scale}
                    width={16}
                    format={(ms: number) => `${ms}ms`}
                    thresholds={HOT}
                />
                <Spacer size={1} />

                <Row gap={4}>
                    <Col>
                        <Caption>DetailList</Caption>
                        <Spacer size={1} />
                        <DetailList
                            rows={[
                                { label: 'cluster', value: 'eu-west-1' },
                                { label: 'silos', value: '24' },
                                { label: 'polls', value: String(t) },
                                { label: 'errors', value: '17', tone: 'danger' },
                            ]}
                        />
                    </Col>
                    <Col>
                        <Caption>Trend — polarity decides whether ▲ is bad news</Caption>
                        <Spacer size={1} />
                        <Trend value={`${reqNow ?? '—'} req/s`} current={reqNow} previous={reqPrev} polarity="higher-is-better" />
                        <Trend value={`${msNow ?? '—'}ms latency`} current={msNow} previous={msPrev} polarity="higher-is-worse" />
                        <Trend value="24 silos" current={24} previous={24} />
                    </Col>
                </Row>
                <Spacer size={1} />

                <Caption>StatusGrid — three states that mean different things</Caption>
                <Spacer size={1} />
                <StatusGrid cells={shards} perRow={4} legend="● claimed  ◆ contended  ○ UNCLAIMED  · idle" />
            </Col>
        );
    };
}, { name: 'MetricsDemo' });
