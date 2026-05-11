# @sigx/runtime-terminal

Terminal UI components for the Sigx runtime (demo/experimental).

## Components

- `Button` - a focusable, clickable control.
- `Input` - a focusable text input with two-way `model` binding.
- `ProgressBar` - a read-only progress indicator.
- `Checkbox` - a focusable checkbox with two-way `model` binding.

## `Checkbox` Usage

The `Checkbox` component uses two-way `model` binding. That means you can write:

```tsx
/** @jsxImportSource @sigx/terminal */
import { signal, renderTerminal, Checkbox } from '@sigx/terminal';

const state = signal({ enabled: true });

renderTerminal(
    <Checkbox model={() => state.enabled} label="Enabled" />,
    { clearConsole: true }
);
```

When the user presses Space or Enter while the `Checkbox` is focused, it will emit `update:modelValue` and `change` events in addition to toggling the visual state.

Props:

- `modelValue` (model) - boolean - current value (two-way binding via `model`).
- `label` - string - optional label to display.
- `autofocus` - boolean - focus on mount.
- `disabled` - boolean - disable interaction.

Events:

- `update:modelValue` - emitted when the value changes (used by `model`).
- `change` - emitted with the new value when toggled.
