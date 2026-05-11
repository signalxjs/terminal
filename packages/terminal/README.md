# @sigx/terminal

SignalX Terminal — a TUI framework with TSX support. Build interactive terminal applications using the same component model and reactive signals as SignalX.

## Install

```bash
npm install @sigx/terminal
```

## Usage

```tsx
/** @jsxImportSource @sigx/terminal */
import { component, signal, defineApp, Input, Button } from '@sigx/terminal';

const App = component(() => {
  const name = signal('');

  return () => (
    <box border="single" borderColor="cyan" label="Greeting">
      <Input model={() => name} label="Name" autofocus />
      <br />
      <text color="green">Hello, {name.value || 'world'}!</text>
      <br />
      <Button label="Exit" onClick={() => process.exit(0)} />
    </box>
  );
});

defineApp(<App />).mount({ clearConsole: true });
```

## Built-in Elements

- `<box>` — Container with optional borders (`single`, `double`, `rounded`), colors, shadows, and labels
- `<text>` — Text with ANSI color support
- `<br>` — Line break

## Components

| Component | Description |
|---|---|
| `Input` | Text input with model binding |
| `Button` | Clickable button |
| `Select` | Option list with keyboard navigation |
| `Checkbox` | Toggle checkbox |
| `ProgressBar` | Visual progress indicator |

## Utilities

- `onKey(handler)` — Subscribe to keyboard events
- `focusNext()` / `focusPrev()` — Programmatic focus management

## Documentation

Full documentation and guides are available at the [SignalX repository](https://github.com/signalxjs/core).

## License

[MIT](https://github.com/signalxjs/core/blob/main/LICENSE)
