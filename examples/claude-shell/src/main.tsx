/** @jsxImportSource @sigx/runtime-core */
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
    resolveColor, getOutputTarget, setTheme, listThemes, getTheme,
} from '@sigx/terminal';
import { LOGO_ROWS, LOGO_PALETTE } from './logo';
import { COMMANDS, MODELS, FAKE_REPLIES } from './commands';

const Shell = component(() => {
    const input = signal({ value: '' });
    const phase = signal({ thinking: false, model: 'fable-5' });
    const views = createViewStack<'shell' | 'model'>('shell');
    let offEsc: (() => void) | null = null;
    let replyTimer: ReturnType<typeof setTimeout> | null = null;

    const transcriptHeader = () => {
        printStatic(renderPixelArt(LOGO_ROWS, LOGO_PALETTE).join('\n'));
        printStatic(`${paintToken('sigx shell', 'accent')} ${paintToken('v0.1.0', 'dim')}`);
        printStatic(paintToken(`${phase.model} · ${process.cwd()}`, 'dim'));
        printStatic('');
        printStatic(`${paintToken('Welcome!', 'success')} Type a message, or ${paintToken('/', 'accent')} for commands.`);
    };

    const respond = (prompt: string) => {
        printStatic('');
        printStatic(`${paintToken('❯', 'accent')} ${prompt}`);
        phase.thinking = true;
        let i = 0;
        const step = () => {
            if (i === 0) printStatic('');
            if (i < FAKE_REPLIES.length) {
                printStatic(paintToken(FAKE_REPLIES[i], i === 0 ? 'fg' : 'dim'));
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
                printStatic('');
                for (const c of COMMANDS) {
                    printStatic(`  ${paintToken(c.value, 'accent')}  ${paintToken(c.description ?? '', 'dim')}`);
                }
                break;
            case '/model':
                views.push('model');
                break;
            case '/theme': {
                const themes = listThemes().filter((t) => t !== 'neutral');
                const next = themes[(themes.indexOf(getTheme()) + 1) % themes.length];
                setTheme(next);
                printStatic(paintToken(`theme → ${next}`, 'dim'));
                break;
            }
            case '/clear':
                printStatic('\n' + paintToken('─'.repeat(40), 'dim') + '\n');
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
        const cols = getOutputTarget().columns;
        const suggestions = input.value.startsWith('/')
            ? COMMANDS.filter((c) => c.value.startsWith(input.value.trim().split(/\s/)[0]))
            : [];

        if (views.current() === 'model') {
            return (
                <box>
                    <Divider width={Math.min(cols, 80)} label="model" />
                    <Select
                        label=" Pick a model "
                        autofocus
                        showDescription
                        model={() => phase.model}
                        options={MODELS}
                        onSubmit={(value: string) => {
                            phase.model = value;
                            printStatic(paintToken(`model → ${value}`, 'dim'));
                            views.pop();
                        }}
                    />
                    <KeyHints hints={[
                        { key: '↑/↓', label: 'choose' },
                        { key: '↵', label: 'select' },
                        { key: 'esc', label: 'back' },
                    ]} />
                </box>
            );
        }

        return (
            <box>
                <Divider width={Math.min(cols, 120)} />
                <TextArea
                    autofocus
                    model={() => input.value}
                    placeholder="message, or / for commands"
                    maxRows={8}
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
            </box>
        );
    };
}, { name: 'Shell' });

if (!process.stdin.isTTY) {
    process.stderr.write('\n  The shell needs an interactive terminal (TTY).\n' +
        '  Run it directly: node --import tsx src/main.tsx\n\n');
    process.exit(1);
}

defineApp(<Shell />).mount({ mode: 'inline' }, terminalMount);
