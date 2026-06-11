import type { SuggestionItem } from '@sigx/terminal';

export const COMMANDS: SuggestionItem[] = [
    { value: '/help', description: 'list available commands' },
    { value: '/model', description: 'pick the model (Esc to go back)' },
    { value: '/theme', description: 'cycle the color theme' },
    { value: '/clear', description: 'print a separator into the transcript' },
    { value: '/quit', description: 'exit the shell' },
];

export const MODELS = [
    { label: 'fable-5', value: 'fable-5', description: 'newest, long-running work' },
    { label: 'opus-4.8', value: 'opus-4.8', description: 'deep reasoning' },
    { label: 'sonnet-4.6', value: 'sonnet-4.6', description: 'balanced' },
    { label: 'haiku-4.5', value: 'haiku-4.5', description: 'fastest' },
];

export const FAKE_REPLIES = [
    'Sure — looking at that now.',
    'The renderer composes every frame as plain lines, so the transcript',
    'above is just your terminal scrollback. The live region you are',
    'typing in repaints in place below it.',
];
