/** @jsxImportSource @sigx/runtime-core */
import { defineApp, terminalMount } from '@sigx/terminal';
import { App } from './App';

// The showcase needs an interactive terminal (TTY) so the renderer can put
// stdin into raw mode and receive each keypress immediately. If stdin is piped
// (which `pnpm --filter … start` can do on Windows), keys are line-buffered by
// the terminal instead — Tab appears to do nothing and Enter scrolls/redraws
// the screen. Fail loudly with the fix rather than render a dead UI.
if (!process.stdin.isTTY) {
    process.stderr.write(
        '\n  The showcase needs an interactive terminal (TTY) for keyboard input,\n' +
        '  but stdin is not a TTY here (it is being piped).\n\n' +
        '  Run it directly in your terminal:\n\n' +
        '      cd examples/showcase\n' +
        '      node --import tsx src/main.tsx\n\n' +
        '  (Launching via `pnpm --filter … start` can swallow the TTY on Windows.)\n\n',
    );
    process.exit(1);
}

// The showcase owns the whole screen, so opt into the full-viewport themed
// canvas. Small/inline apps would omit `fullscreen` and only their own lines
// get backed. The canvas itself is automatic — importing @sigx/terminal (which
// re-exports @sigx/terminal-ui) calls applyThemeCanvas() on load.
defineApp(<App />).mount({ clearConsole: true, fullscreen: true }, terminalMount);
