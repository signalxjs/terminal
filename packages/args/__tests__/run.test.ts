import { afterEach, describe, expect, it } from 'vitest';
import { ParseError, defineCommand, runCommand, runMain } from '../src/index';

function io() {
    const out: string[] = [];
    const err: string[] = [];
    return {
        out,
        err,
        opts: { stdout: (t: string) => out.push(t), stderr: (t: string) => err.push(t) }
    };
}

afterEach(() => {
    process.exitCode = undefined;
});

describe('runMain', () => {
    const makeRoot = (sink: { calls: unknown[] }) =>
        defineCommand({
            meta: { name: 'sigx', version: '1.2.3', description: 'sigx cli' },
            subCommands: {
                dev: defineCommand({
                    description: 'dev server',
                    args: {
                        port: { type: 'number', alias: 'p', required: true },
                        host: { type: 'string', default: 'localhost' }
                    },
                    run(ctx) {
                        sink.calls.push(ctx.args);
                    }
                })
            }
        });

    it('dispatches to a nested run with typed args', async () => {
        const sink = { calls: [] as unknown[] };
        const { opts } = io();
        await runMain(makeRoot(sink), { rawArgs: ['dev', '-p', '3000'], ...opts });
        expect(sink.calls).toEqual([{ port: 3000, host: 'localhost', _: [] }]);
        expect(process.exitCode).toBe(0);
    });

    it('prints --version at the root', async () => {
        const sink = { calls: [] as unknown[] };
        const { out, opts } = io();
        await runMain(makeRoot(sink), { rawArgs: ['--version'], ...opts });
        expect(out).toEqual(['1.2.3']);
        expect(process.exitCode).toBe(0);
    });

    it('does not hijack --version after a subcommand token', async () => {
        const sink = { calls: [] as unknown[] };
        const { out, err, opts } = io();
        await runMain(makeRoot(sink), { rawArgs: ['dev', '--version'], ...opts });
        expect(out).toEqual([]);
        expect(err[0]).toBe("error: Unknown flag '--version'");
        expect(process.exitCode).toBe(1);
    });

    it('renders root help with --help', async () => {
        const sink = { calls: [] as unknown[] };
        const { out, opts } = io();
        await runMain(makeRoot(sink), { rawArgs: ['--help'], ...opts });
        expect(out.join('\n')).toContain('sigx — sigx cli (v1.2.3)');
        expect(out.join('\n')).toContain('dev');
        expect(process.exitCode).toBe(0);
    });

    it('renders subcommand help even when required args are missing', async () => {
        const sink = { calls: [] as unknown[] };
        const { out, opts } = io();
        await runMain(makeRoot(sink), { rawArgs: ['dev', '--help'], ...opts });
        expect(out.join('\n')).toContain('sigx dev — dev server');
        expect(out.join('\n')).toContain('--port');
        expect(sink.calls).toEqual([]);
        expect(process.exitCode).toBe(0);
    });

    it('prints help with exit code 1 for a bare group command', async () => {
        const sink = { calls: [] as unknown[] };
        const { out, opts } = io();
        await runMain(makeRoot(sink), { rawArgs: [], ...opts });
        expect(out.join('\n')).toContain('COMMANDS');
        expect(process.exitCode).toBe(1);
    });

    it('reports parse errors with a usage hint on stderr', async () => {
        const sink = { calls: [] as unknown[] };
        const { err, opts } = io();
        await runMain(makeRoot(sink), { rawArgs: ['dev'], ...opts });
        expect(err[0]).toBe('error: Missing required flag --port');
        expect(err[1]).toBe("Run 'sigx dev --help' for usage.");
        expect(process.exitCode).toBe(1);
    });

    it('reports unknown commands', async () => {
        const sink = { calls: [] as unknown[] };
        const { err, opts } = io();
        await runMain(makeRoot(sink), { rawArgs: ['nope'], ...opts });
        expect(err[0]).toBe("error: Unknown command 'nope'");
        expect(process.exitCode).toBe(1);
    });

    it('respects an exit code set by the handler itself', async () => {
        const cmd = defineCommand({
            meta: { name: 'soft' },
            run() {
                process.exitCode = 2;
            }
        });
        const { opts } = io();
        await runMain(cmd, { rawArgs: [], ...opts });
        expect(process.exitCode).toBe(2);
    });

    it('turns handler throws into exit code 1', async () => {
        const cmd = defineCommand({
            meta: { name: 'boom' },
            run() {
                throw new Error('kaput');
            }
        });
        const { err, opts } = io();
        await runMain(cmd, { rawArgs: [], ...opts });
        expect(err).toEqual(['error: kaput']);
        expect(process.exitCode).toBe(1);
    });
});

describe('runCommand', () => {
    it('returns the context and runs the handler', async () => {
        let ran = false;
        const cmd = defineCommand({
            meta: { name: 'x' },
            args: { entry: { type: 'positional' } },
            run() {
                ran = true;
            }
        });
        const ctx = await runCommand(cmd, { rawArgs: ['main.ts'] });
        expect(ran).toBe(true);
        expect(ctx.args).toEqual({ entry: 'main.ts', _: [] });
        expect(ctx.path).toEqual(['x']);
        expect(ctx.rawArgs).toEqual(['main.ts']);
    });

    it('propagates ParseError instead of printing', async () => {
        const cmd = defineCommand({ meta: { name: 'x' }, args: { port: { type: 'number', required: true } }, run() {} });
        await expect(runCommand(cmd, { rawArgs: [] })).rejects.toBeInstanceOf(ParseError);
    });

    it('exposes unknown flags when allowed', async () => {
        const cmd = defineCommand({ meta: { name: 'x' }, allowUnknownFlags: true, run() {} });
        const ctx = await runCommand(cmd, { rawArgs: ['--mystery'] });
        expect(ctx.unknownFlags).toEqual(['--mystery']);
    });
});
