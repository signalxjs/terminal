import { describe, it, expect } from 'vitest';
import { effect } from '@sigx/reactivity';
import { createViewStack } from '../src/shared/viewStack';

describe('createViewStack', () => {
    it('push/current/depth', () => {
        const s = createViewStack<'a' | 'b' | 'c'>('a');
        expect(s.current()).toBe('a');
        expect(s.depth()).toBe(1);
        s.push('b');
        expect(s.current()).toBe('b');
        expect(s.depth()).toBe(2);
    });

    it('pop returns false at the root and stays', () => {
        const s = createViewStack('root');
        expect(s.pop()).toBe(false);
        expect(s.current()).toBe('root');
        s.push('child');
        expect(s.pop()).toBe(true);
        expect(s.current()).toBe('root');
    });

    it('replace swaps the top without growing depth', () => {
        const s = createViewStack<'a' | 'b' | 'c'>('a');
        s.push('b');
        s.replace('c');
        expect(s.current()).toBe('c');
        expect(s.depth()).toBe(2);
        s.pop();
        expect(s.current()).toBe('a');
    });

    it('current() is reactive', () => {
        const s = createViewStack<'a' | 'b'>('a');
        const seen: string[] = [];
        effect(() => { seen.push(s.current()); });
        s.push('b');
        s.pop();
        expect(seen).toEqual(['a', 'b', 'a']);
    });
});
