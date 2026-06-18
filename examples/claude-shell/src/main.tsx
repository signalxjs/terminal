// An assistant shell in the Claude Code shape — the full interactive kit:
//
//     node --import tsx src/main.tsx     (needs a real terminal)
//
// - pixel logo + header printed ONCE into scrollback (printStatic)
// - conversation scrolls into native scrollback; only the input area is live
// - the input grows as you type (wraps, \↵ or Ctrl+J for newlines)
// - type `/` for command intellisense (↑/↓ · Tab/Enter accept · Esc dismiss)
// - /model pushes a picker view — Esc pops back to the shell
import {
    defineApp, component, signal, onMounted, onUnmounted, terminalMount, exitTerminal,
    TextArea, SuggestionList, Select, Divider, KeyHints, Shimmer,
    renderPixelArt, createViewStack, onKey, isEsc, printStatic, paintToken,
    getTerminalSize, layoutText, setTheme, listThemes, getTheme, Spacer, Col } from '@sigx/terminal';
import { LOGO_ROWS, LOGO_PALETTE } from './logo';
import { COMMANDS, MODELS, FAKE_REPLIES } from './commands';

const Shell = component(() => {
    const input = signal({ value: '' });
    const phase = signal({ thinking: false, model: 'fable-5' });
    // Lines printed into the transcript so far — drives the bottom anchor:
    // until the conversation fills the viewport, blank filler rows above the
    // input pin it to the bottom of the screen (the Claude Code look).
    const transcript = signal({ lines: 0 });
    const views = createViewStack<'shell' | 'model'>('shell');
    let offEsc: (() => void) | null = null;
    let replyTimer: ReturnType<typeof setTimeout> | null = null;

    const say = (text = '') => {
        // ORDER MATTERS: bump the counter FIRST. The signal write re-renders
        // this component synchronously, shrinking the filler in the tree —
        // so printStatic's immediate repaint uses the already-shrunk region
        // and the transcript never pushes the viewport into a spurious
        // scroll (which would creep lines off the top on every message).
        transcript.lines += text.split('\n').length;
        printStatic(text);
    };

    const transcriptHeader = () => {
        say(renderPixelArt(LOGO_ROWS, LOGO_PALETTE).join('\n'));
        say(`${paintToken('sigx shell', 'accent')} ${paintToken('v0.1.0', 'dim')}`);
        say(paintToken(`${phase.model} · ${process.cwd()}`, 'dim'));
        say('');
        say(`${paintToken('Welcome!', 'success')} Type a message, or ${paintToken('/', 'accent')} for commands.`);
    };

    const respond = (prompt: string) => {
        say('');
        say(`${paintToken('❯', 'accent')} ${prompt}`);
        phase.thinking = true;
        let i = 0;
        const step = () => {
            if (i === 0) say('');
            if (i < FAKE_REPLIES.length) {
                say(paintToken(FAKE_REPLIES[i], i === 0 ? 'fg' : 'dim'));
                i++;
                replyTimer = setTimeout(step, 350);
            } else {
                phase.thinking = false;
                replyTimer = null;
            }
        };
        replyTimer = setTimeout(step, 700);
    };

    const runCommand = (cmd: string) => {
        input.value = '';
        switch (cmd) {
            case '/help':
                say('');
                for (const c of COMMANDS) {
                    say(`  ${paintToken(c.value, 'accent')}  ${paintToken(c.description ?? '', 'dim')}`);
                }
                break;
            case '/model':
                views.push('model');
                break;
            case '/theme': {
                const themes = listThemes().filter((t) => t !== 'neutral');
                const next = themes[(themes.indexOf(getTheme()) + 1) % themes.length];
                setTheme(next);
                say(paintToken(`theme → ${next}`, 'dim'));
                break;
            }
            case '/clear':
                say('\n' + paintToken('─'.repeat(40), 'dim') + '\n');
                break;
            case '/quit':
                exitTerminal();
                process.exit(0);
        }
    };

    const submit = (text: string) => {
        const trimmed = text.trim();
        input.value = '';
        if (!trimmed) return;
        if (trimmed.startsWith('/')) {
            runCommand(trimmed.split(/\s/)[0]);
            return;
        }
        respond(trimmed);
    };

    onMounted(() => {
        transcriptHeader();
        // View layer: Esc pops a pushed view. When suggestions are open their
        // overlay handler consumes Esc first; at the root Esc does nothing.
        offEsc = onKey((key) => {
            if (isEsc(key) && views.depth() > 1) {
                views.pop();
                return true;
            }
        }, { layer: 'view' });
    });
    onUnmounted(() => {
        offEsc?.();
        if (replyTimer) clearTimeout(replyTimer);
    });

    return () => {
        const { columns: cols, rows } = getTerminalSize(); // reactive: resizes re-render
        const suggestions = input.value.startsWith('/')
            ? COMMANDS.filter((c) => c.value.startsWith(input.value.trim().split(/\s/)[0]))
            : [];

        // Bottom anchor: until the transcript fills the viewport, blank rows
        // above the input area pin it to the bottom of the screen. Once the
        // conversation is taller than the window the filler is 0 and natural
        // scrollback flow takes over. The input area's height is measured
        // with the same layout the TextArea uses, so growth while typing
        // shrinks the gap instead of pushing the transcript off-screen.
        const MAX_INPUT_ROWS = 8;
        const innerWidth = Math.max(4, Math.max(20, cols - 4) - 2);
        const inputRows = Math.min(MAX_INPUT_ROWS, layoutText(input.value, innerWidth).rows.length);
        const mkGap = (chromeRows: number) => {
            const filler = Math.max(0, rows - transcript.lines - chromeRows - 1 /* slack */);
            return filler > 0 ? [<Spacer size={filler} />] : [];
        };

        if (views.current() === 'model') {
            // divider + bordered select (options + 2) + description + hints
            const gap = mkGap(1 + MODELS.length + 2 + 1 + 1);
            return (
                <Col>
                    {gap}
                    <Divider width={Math.min(cols, 80)} label="model" />
                    <Select
                        label=" Pick a model "
                        autofocus
                        showDescription
                        model={() => phase.model}
                        options={MODELS}
                        onSubmit={(value: string) => {
                            phase.model = value;
                            say(paintToken(`model → ${value}`, 'dim'));
                            views.pop();
                        }}
                    />
                    <KeyHints hints={[
                        { key: '↑/↓', label: 'choose' },
                        { key: '↵', label: 'select' },
                        { key: 'esc', label: 'back' },
                    ]} />
                </Col>
            );
        }

        const gap = mkGap(1 /* divider */ + inputRows + suggestions.length + 1 /* hints */);
        return (
            <Col>
                {gap}
                <Divider width={Math.min(cols, 120)} />
                <TextArea
                    autofocus
                    model={() => input.value}
                    placeholder="message, or / for commands"
                    maxRows={MAX_INPUT_ROWS}
                    onSubmit={submit}
                />
                {suggestions.length > 0 && <SuggestionList
                    items={suggestions}
                    onAccept={runCommand}
                    onDismiss={() => { input.value = ''; }}
                />}
                {phase.thinking
                    ? <Shimmer text="thinking…" />
                    : <KeyHints hints={[
                        { key: '/', label: 'commands' },
                        { key: '\\↵', label: 'newline' },
                        { key: 'esc', label: 'back' },
                        { key: '^C', label: 'quit' },
                    ]} />}
            </Col>
        );
    };
}, { name: 'Shell' });

if (!process.stdin.isTTY) {
    process.stderr.write('\n  The shell needs an interactive terminal (TTY).\n' +
        '  Run it directly: node --import tsx src/main.tsx\n\n');
    process.exit(1);
}

defineApp(<Shell />).mount({ mode: 'inline', clearConsole: true }, terminalMount);
