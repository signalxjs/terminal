# @sigx/terminal

SignalX Terminal — a TUI framework with TSX support. Build interactive terminal applications using the same component model and reactive signals as SignalX.

## 📚 Documentation

Full guides, API reference and live examples → **<https://sigx.dev/terminal/>**

## Install

```bash
npm install @sigx/terminal @sigx/reactivity @sigx/runtime-core
```

The SignalX core packages (`@sigx/reactivity`, `@sigx/runtime-core`, 0.6.x) are
**peer dependencies**, so your app shares one reactivity engine across all
`@sigx/*` packages. npm 7+ installs peers automatically; listing them
explicitly works everywhere.

## Quick taste

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

Built-in elements (`<box>`, `<text>`, `<br>`), components (`Input`, `Button`,
`Select`, `Checkbox`, `ProgressBar`) and focus/keyboard utilities are documented
in full on the docs site → <https://sigx.dev/terminal/>.

## Part of SignalX

- [`sigx`](https://sigx.dev/core/) — reactivity, runtime-core, DOM renderer, SSR, Vite plugin.
- [`@sigx/cli`](https://sigx.dev/cli/) — the `sigx` CLI and `create-sigx` scaffolder.

## License

[MIT](https://github.com/signalxjs/terminal/blob/main/LICENSE)
