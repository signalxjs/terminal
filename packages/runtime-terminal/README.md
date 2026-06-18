# @sigx/runtime-terminal

The terminal renderer and built-in UI components for SignalX — `Button`,
`Input`, `Select`, `Checkbox` and `ProgressBar`. The interactive ones are
focusable, with two-way `model` binding where it makes sense. Most apps use
these via the [`@sigx/terminal`](https://sigx.dev/terminal/) entry point.

## 📚 Documentation

Full guides, API reference and live examples → **<https://sigx.dev/terminal/>**

## Quick taste

With `"jsxImportSource": "@sigx/terminal"` set in your `tsconfig.json`, write
plain TSX — no per-file pragma:

```tsx
import { signal, renderTerminal, Checkbox } from '@sigx/terminal';

const state = signal({ enabled: true });

renderTerminal(
    <Checkbox model={() => state.enabled} label="Enabled" />,
    { clearConsole: true }
);
```

Component props, events and the full renderer API are documented on the docs
site → <https://sigx.dev/terminal/>.

## Part of SignalX

- [`@sigx/terminal`](https://sigx.dev/terminal/) — public TUI entry point.
- [`sigx`](https://sigx.dev/core/) — reactivity, runtime-core, DOM renderer, SSR, Vite plugin.

## License

[MIT](https://github.com/signalxjs/terminal/blob/main/LICENSE)
