/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, signal, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor,
    getOutputTarget, GLYPHS, READY_DELAY_MS,
    layoutText, cursorToRowCol, insertAt, deleteBefore, deleteAt,
    moveLeft, moveRight, moveVertical, moveLineStart, moveLineEnd,
    type TextBufferState,
} from '@sigx/terminal-zero';

const DEL = String.fromCharCode(127);
const BS = String.fromCharCode(8);
const ESC = String.fromCharCode(27);

/**
 * Growing multi-line text input — the Claude-style prompt box. Soft-wraps to
 * `width`, grows from one row up to `maxRows` (then scrolls internally,
 * keeping the cursor visible), with a movable block cursor.
 *
 * Keys (while focused): printable characters and paste chunks insert at the
 * cursor; ←/→/↑/↓ move (↑/↓ keep a sticky goal column); Home/End jump within
 * the visual row; Backspace/Delete edit around the cursor. Enter (`\r`)
 * submits — unless the text ends with `\`, which is stripped and replaced by
 * a newline (continuation). A bare `\n` (Ctrl+J) always inserts a newline.
 * NOTE: this deliberately diverges from the prompt engine's `isEnter` (which
 * treats `\r` and `\n` alike) — an editor needs the distinction.
 *
 * Paste chunks containing escape sequences keep only the printable prefix
 * (bracketed-paste mode is not implemented).
 */
export const TextArea = component<
    Define.Model<string> &
    Define.Prop<'placeholder', string, false> &
    Define.Prop<'promptGlyph', string, false> &
    Define.Prop<'width', number, false> &
    Define.Prop<'maxRows', number, false> &
    Define.Prop<'autofocus', boolean, false> &
    Define.Event<'input', string> &
    Define.Event<'submit', string>
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false;
    const isFocused = () => focusState.activeId === id;
    const state = signal({ cursor: 0, goalCol: -1 });

    const getValue = () => props.model?.value ?? '';
    const innerWidth = () => Math.max(4, (props.width || Math.max(20, getOutputTarget().columns - 4)) - 2);

    const buf = (): TextBufferState => {
        const text = getValue();
        return { text, cursor: Math.min(state.cursor, [...text].length) };
    };
    const apply = (next: TextBufferState, emitInput: boolean) => {
        if (props.model) props.model.value = next.text;
        state.cursor = next.cursor;
        if (emitInput) emit('input', next.text);
    };

    const handleKey = (key: string): boolean | void => {
        if (!isFocused() || !isReady) return;
        const width = innerWidth();

        if (key === '\r') {
            const text = getValue();
            if (text.endsWith('\\')) {
                // Continuation: strip the backslash, insert a newline.
                const chars = [...text];
                const stripped = { text: chars.slice(0, -1).join(''), cursor: Math.min(buf().cursor, chars.length - 1) };
                apply(insertAt(stripped, '\n'), true);
                state.goalCol = -1;
                return true;
            }
            emit('submit', text);
            return true;
        }
        if (key === '\n') { // Ctrl+J — always a newline
            apply(insertAt(buf(), '\n'), true);
            state.goalCol = -1;
            return true;
        }
        if (key === DEL || key === BS) {
            apply(deleteBefore(buf()), true);
            state.goalCol = -1;
            return true;
        }
        if (key === ESC + '[3~') { // forward delete
            apply(deleteAt(buf()), true);
            state.goalCol = -1;
            return true;
        }
        if (key === ESC + '[D') {
            apply(moveLeft(buf()), false);
            state.goalCol = -1;
            return true;
        }
        if (key === ESC + '[C') {
            apply(moveRight(buf()), false);
            state.goalCol = -1;
            return true;
        }
        if (key === ESC + '[A' || key === ESC + '[B') {
            const dir = key === ESC + '[A' ? -1 : 1;
            const r = moveVertical(buf(), width, dir, state.goalCol >= 0 ? state.goalCol : undefined);
            apply(r.state, false);
            state.goalCol = r.goalCol;
            return true;
        }
        if (key === ESC + '[H' || key === ESC + '[1~') {
            apply(moveLineStart(buf(), width), false);
            state.goalCol = -1;
            return true;
        }
        if (key === ESC + '[F' || key === ESC + '[4~') {
            apply(moveLineEnd(buf(), width), false);
            state.goalCol = -1;
            return true;
        }
        // Printable characters and paste chunks. A chunk starting with ESC is
        // a key sequence (handled above or not ours); a mixed chunk keeps only
        // the printable prefix.
        if (key.length >= 1 && key.charCodeAt(0) !== 27) {
            let chunk = key.replace(/\r\n|\r/g, '\n');
            const escIdx = chunk.indexOf(ESC);
            if (escIdx >= 0) chunk = chunk.slice(0, escIdx);
            // Strip control bytes except newline.
            chunk = [...chunk].filter((ch) => ch === '\n' || ch >= ' ').join('');
            if (chunk.length === 0) return;
            apply(insertAt(buf(), chunk), true);
            state.goalCol = -1;
            return true;
        }
    };

    let keyCleanup: (() => void) | null = null;

    onMounted(() => {
        registerFocusable(id);
        if (props.autofocus) focus(id);
        keyCleanup = onKey(handleKey);
        setTimeout(() => { isReady = true; }, READY_DELAY_MS);
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
        unregisterFocusable(id);
    });

    return () => {
        const focused = isFocused();
        const width = innerWidth();
        const maxRows = Math.max(1, props.maxRows || 6);
        const glyph = props.promptGlyph || GLYPHS.cursor;
        const text = getValue();
        const cursor = Math.min(state.cursor, [...text].length);

        const layout = layoutText(text, width);
        const pos = cursorToRowCol(layout, cursor);

        // Window the rows so the cursor row is always visible.
        const totalRows = layout.rows.length;
        const visible = Math.min(totalRows, maxRows);
        let top = 0;
        if (totalRows > maxRows) {
            top = Math.min(Math.max(0, pos.row - maxRows + 1), totalRows - maxRows);
            if (pos.row < top) top = pos.row;
        }

        const rows = [];
        for (let r = top; r < top + visible; r++) {
            const row = layout.rows[r];
            const prefix = r === 0
                ? <text color={resolveColor(focused ? 'accent' : 'dim')}>{glyph} </text>
                : <text>{'  '}</text>;

            let body;
            if (focused && r === pos.row) {
                // Split the row around the cursor; invert the glyph under it.
                const chars = [...row.text];
                const at = cursor - row.start;
                const before = chars.slice(0, at).join('');
                const under = at < chars.length ? chars[at] : ' ';
                const after = at < chars.length ? chars.slice(at + 1).join('') : '';
                body = (
                    <text>
                        <text color={resolveColor('fg')}>{before}</text>
                        <text backgroundColor={resolveColor('accent')} color={resolveColor('accentText')}>{under}</text>
                        <text color={resolveColor('fg')}>{after}</text>
                    </text>
                );
            } else {
                body = <text color={resolveColor('fg')}>{row.text}</text>;
            }

            const isPlaceholderRow = r === 0 && text.length === 0 && props.placeholder;
            rows.push(
                <box>
                    {prefix}
                    {body}
                    {isPlaceholderRow && <text color={resolveColor('dim')}>{props.placeholder}</text>}
                </box>,
            );
        }

        return <box>{rows}</box>;
    };
}, { name: 'TextArea' });

export default TextArea;
