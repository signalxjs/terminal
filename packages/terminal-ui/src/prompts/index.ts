/**
 * Imperative, clack-style prompts: linear CLI wizards without a JSX step
 * machine. Each prompt mounts a one-shot inline UI, resolves on Enter, and
 * collapses into a permanent `◇ message · answer` line — a finished wizard
 * reads as a tidy transcript in scrollback.
 */
export { CANCEL, isCancel } from './cancel';
export { text, password, type TextOptions } from './text';
export { select, type SelectOptions, type PromptOption } from './select';
export { multiselect, type MultiSelectPromptOptions } from './multiselect';
export { confirm, type ConfirmOptions } from './confirm';
export { intro, outro, note, cancel } from './statics';
export { spinner, type SpinnerHandle } from './spinner';
export { __setInteractiveOverride } from './runPrompt';

import { CANCEL, isCancel } from './cancel';
import { text, password } from './text';
import { select } from './select';
import { multiselect } from './multiselect';
import { confirm } from './confirm';
import { intro, outro, note, cancel } from './statics';
import { spinner } from './spinner';

/** Namespace bundle for collision-free imports: `prompt.select(...)`. */
export const prompt = {
    text, password, select, multiselect, confirm,
    intro, outro, note, cancel, spinner,
    isCancel, CANCEL,
} as const;
