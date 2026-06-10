import type { TerminalNode } from './index.js';
// Side-effect import so the augmentation target module resolves even when no
// other file in this package imports '@sigx/runtime-core' by its bare name.
import '@sigx/runtime-core';

/**
 * Module augmentation for Terminal platform.
 * When @sigx/runtime-terminal is imported, these types automatically extend the core types.
 */
declare module '@sigx/runtime-core' {
    /** Terminal platform sets TerminalNode as the default element type */
    interface PlatformTypes {
        element: TerminalNode;
    }
}

// Export to make this a module
export { };
