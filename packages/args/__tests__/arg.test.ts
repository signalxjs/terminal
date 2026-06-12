import { describe, expect, it } from 'vitest';
import { a, command, DefinitionError } from '../src/index';

describe('arg builders', () => {
    it('produces the matching def for each factory', () => {
        expect(a.string()['~def']).toEqual({ type: 'string' });
        expect(a.number()['~def']).toEqual({ type: 'number' });
        expect(a.boolean()['~def']).toEqual({ type: 'boolean' });
        expect(a.enum(['dev', 'prod'])['~def']).toEqual({ type: 'enum', options: ['dev', 'prod'] });
        expect(a.positional()['~def']).toEqual({ type: 'positional' });
        expect(a.rest()['~def']).toEqual({ type: 'rest' });
    });

    it('patches the def per refiner', () => {
        expect(a.number().required()['~def']).toEqual({ type: 'number', required: true });
        expect(a.string().default('x')['~def']).toEqual({ type: 'string', default: 'x' });
        expect(a.number().multiple()['~def']).toEqual({ type: 'number', multiple: true });
        expect(a.boolean().negatable(false)['~def']).toEqual({ type: 'boolean', negatable: false });
        expect(a.string().describe('docs')['~def']).toEqual({ type: 'string', description: 'docs' });
        expect(a.string().hidden()['~def']).toEqual({ type: 'string', hidden: true });
        expect(a.string().valueHint('file')['~def']).toEqual({ type: 'string', valueHint: 'file' });
        expect(a.positional().default('main.ts')['~def']).toEqual({ type: 'positional', default: 'main.ts' });
    });

    it('accumulates aliases across calls', () => {
        expect(a.boolean().alias('f').alias('hard', 'force2')['~def']).toEqual({
            type: 'boolean',
            alias: ['f', 'hard', 'force2']
        });
    });

    it('is immutable — refining a shared base does not mutate it', () => {
        const port = a.number().alias('p');
        const requiredPort = port.required().describe('Port');
        expect(port['~def']).toEqual({ type: 'number', alias: ['p'] });
        expect(requiredPort['~def']).toEqual({
            type: 'number',
            alias: ['p'],
            required: true,
            description: 'Port'
        });
    });

    it('rejects required+default at runtime for untyped callers', () => {
        // The compile-time this-guard forbids this chain; untyped (JS) callers
        // still hit the validateArgs backstop inside .args().
        const bad = (a.number().required() as unknown as ReturnType<typeof a.number>).default(1);
        expect(() => command('x').args({ port: bad })).toThrow(DefinitionError);
    });

    it('rejects an enum default outside its options at runtime', () => {
        const bad = a.enum(['a']).default('b' as 'a');
        expect(() => command('x').args({ mode: bad })).toThrow(DefinitionError);
    });
});
