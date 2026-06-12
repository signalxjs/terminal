/**
 * Typed errors for @sigx/args.
 *
 * `ParseError` carries a machine-readable `code` plus structured `detail` so
 * hosts (e.g. a TUI shell) can render rich error UI without string parsing.
 * `DefinitionError` signals a programmer mistake in a command definition and
 * is thrown eagerly by `command(...).args()` and `parseArgs`.
 */

export type ParseErrorCode =
    | 'UNKNOWN_FLAG'
    | 'UNKNOWN_COMMAND'
    | 'MISSING_REQUIRED'
    | 'MISSING_VALUE'
    | 'INVALID_NUMBER'
    | 'INVALID_ENUM'
    | 'INVALID_BOOLEAN'
    | 'UNEXPECTED_POSITIONAL';

export interface ParseErrorDetail {
    /** Canonical arg key (or subcommand token for UNKNOWN_COMMAND). */
    arg?: string;
    /** The offending raw token or value. */
    received?: string;
    /** Human hint for what was expected, e.g. 'number' or 'dev|prod'. */
    expected?: string;
    /** Command path where the error occurred, e.g. ['sigx', 'dev']. */
    command?: string[];
}

export class ParseError extends Error {
    override readonly name = 'ParseError';
    constructor(
        readonly code: ParseErrorCode,
        message: string,
        readonly detail: ParseErrorDetail = {}
    ) {
        super(message);
    }
}

export class DefinitionError extends Error {
    override readonly name = 'DefinitionError';
}
