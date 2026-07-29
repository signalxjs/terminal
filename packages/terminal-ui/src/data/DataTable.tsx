/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, signal, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor,
    getTerminalSize, hexToSGR, displayWidth, READY_DELAY_MS, GLYPHS,
    layoutTable, scrollWindow, moveCursor, sortRows, columnComparator,
    isUp, isDown, isLeft, isRight, isEnter, isPageUp, isPageDown, isHome, isEnd,
    type TableColumn,
} from '@sigx/terminal-zero';

export type SortDir = 'asc' | 'desc';
export interface SortState { key: string; dir: SortDir }

/**
 * A table with a cursor, a viewport and a sort — the shape a dashboard needs
 * and `Table` (a static text grid of `string[][]`) cannot be bent into.
 *
 * Columns are typed accessors, so the data stays the app's own objects and the
 * table never has to be re-flattened to re-sort it. Three behaviours are
 * deliberate and worth knowing:
 *
 * - **Shrinking takes space from the rightmost columns.** The left column is
 *   nearly always the identity, and a table whose identities are truncated to
 *   make room for a latency figure is unusable. Truncation is always marked
 *   with `…`, never silent.
 * - **Sorting breaks ties on identity.** A dashboard re-sorts every poll, and
 *   rows with equal values would otherwise swap places each time — motion that
 *   reads as activity when nothing has changed. Pass `identity` for a stable
 *   key; the row index is the fallback.
 * - **The cursor clamps and the window moves by one.** Holding ↓ stops at the
 *   bottom rather than wrapping, and stepping past the edge scrolls a row, not
 *   a screenful.
 *
 * Keys while focused: ↑/k ↓/j move, PgUp/PgDn page, Home/End jump to the ends,
 * Enter submits. With `sortable`: ←/→ pick the sort column, `r` reverses it.
 */
export const DataTable = component<
    Define.Prop<'columns', TableColumn<any>[], true> &
    Define.Prop<'rows', any[], false> &
    Define.Prop<'height', number, false> &
    Define.Prop<'width', number, false> &
    Define.Prop<'gap', number, false> &
    Define.Prop<'identity', (row: any) => string, false> &
    Define.Prop<'sortable', boolean, false> &
    Define.Prop<'sortKey', string, false> &
    Define.Prop<'sortDir', SortDir, false> &
    Define.Prop<'tone', (row: any) => string | undefined, false> &
    Define.Prop<'variant', 'plain' | 'ruled' | 'boxed', false> &
    Define.Prop<'title', string, false> &
    Define.Prop<'emptyText', string, false> &
    Define.Prop<'showFooter', boolean, false> &
    Define.Prop<'autofocus', boolean, false> &
    Define.Model<number> &
    Define.Event<'select', any> &
    Define.Event<'submit', any> &
    Define.Event<'sortChange', SortState>
>(({ props, emit }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false;
    const isFocused = () => focusState.activeId === id;

    // Never written during render — only from the key handler, so a repaint
    // can't feed back into the state it is painting.
    const state = signal({
        cursor: 0,
        offset: 0,
        sortKey: props.sortKey ?? '',
        sortDir: (props.sortDir ?? 'asc') as SortDir,
    });

    const cols = (): TableColumn<any>[] => props.columns || [];
    const sortableCols = () => cols().filter((column) => column.sortable !== false);
    // `0` is a real request (clamped to one row), not "unset"; a non-finite
    // height falls back to the default rather than poisoning the viewport
    // maths, which would otherwise try to slice an infinite window.
    const sizeProp = (value: number | undefined, fallback: number, floor: number) =>
        (typeof value === 'number' && Number.isFinite(value))
            ? Math.max(floor, Math.floor(value))
            : fallback;
    const getHeight = () => sizeProp(props.height, 10, 1);
    const identityOf = (row: any, index: number) =>
        props.identity ? props.identity(row) : String(index);

    /** Rows in display order — the single source both render and keys agree on. */
    const ordered = (): any[] => {
        const rows = props.rows || [];
        const column = cols().find((c) => c.key === state.sortKey);
        if (!column) return rows;
        const compare = columnComparator(column);
        const signed = state.sortDir === 'desc'
            ? (a: any, b: any) => -compare(a, b)
            : compare;
        // The tiebreak identity is carried alongside each row rather than
        // recomputed, so equal rows keep a stable order instead of shuffling
        // every poll — and duplicate rows keep distinct identities.
        const indexed = rows.map((row, index) => ({ row, id: identityOf(row, index) }));
        return sortRows(indexed, (a, b) => signed(a.row, b.row), (item) => item.id)
            .map((item) => item.row);
    };

    // A controlled cursor is still an index: anything non-finite or fractional
    // would flow straight into the viewport maths and come back out as NaN,
    // taking `select` (and the painted window) with it.
    const cursorOf = () => {
        const model = props.model?.value;
        if (typeof model === 'number' && Number.isFinite(model)) return Math.max(0, Math.floor(model));
        return state.cursor;
    };

    const setCursor = (next: number, total: number) => {
        const clamped = moveCursor(0, next, total);
        state.cursor = clamped;
        if (props.model) props.model.value = clamped;
        state.offset = scrollWindow(total, clamped, getHeight(), state.offset);
        const rows = ordered();
        if (rows.length > 0) emit('select', rows[clamped]);
    };

    const setSort = (key: string, dir: SortDir) => {
        state.sortKey = key;
        state.sortDir = dir;
        emit('sortChange', { key, dir });
    };

    const handleKey = (key: string) => {
        if (!isFocused() || !isReady) return;
        const total = (props.rows || []).length;
        const cursor = cursorOf();
        const page = getHeight();

        if (isUp(key) || key === 'k') return setCursor(moveCursor(cursor, -1, total), total);
        if (isDown(key) || key === 'j') return setCursor(moveCursor(cursor, 1, total), total);
        if (isPageUp(key)) return setCursor(moveCursor(cursor, -page, total), total);
        if (isPageDown(key)) return setCursor(moveCursor(cursor, page, total), total);
        if (isHome(key)) return setCursor(0, total);
        if (isEnd(key)) return setCursor(Math.max(0, total - 1), total);
        if (isEnter(key)) {
            const rows = ordered();
            if (rows.length > 0) emit('submit', rows[Math.min(cursor, rows.length - 1)]);
            return;
        }

        if (!props.sortable) return;
        const sortable = sortableCols();
        if (sortable.length === 0) return;

        if (isLeft(key) || isRight(key)) {
            const at = sortable.findIndex((column) => column.key === state.sortKey);
            const step = isRight(key) ? 1 : -1;
            // Wrapping here (unlike the row cursor) — a handful of columns is a
            // ring you cycle, not a list you scroll to the end of.
            const next = at < 0
                ? (step > 0 ? 0 : sortable.length - 1)
                : (at + step + sortable.length) % sortable.length;
            setSort(sortable[next]!.key, state.sortDir);
            return;
        }
        if (key === 'r') setSort(state.sortKey || sortable[0]!.key, state.sortDir === 'asc' ? 'desc' : 'asc');
    };

    let keyCleanup: (() => void) | null = null;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    onMounted(() => {
        registerFocusable(id);
        if (props.autofocus) focus(id);
        keyCleanup = onKey(handleKey);
        readyTimer = setTimeout(() => { isReady = true; }, READY_DELAY_MS);
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
        // Cleared, not left to fire: an unmount inside the debounce window
        // would otherwise wake up later and write to state nobody is painting.
        if (readyTimer) clearTimeout(readyTimer);
        unregisterFocusable(id);
    });

    return () => {
        const columns = cols();
        const rows = ordered();
        const total = rows.length;
        const focused = isFocused();
        const variant = props.variant || 'ruled';
        const height = getHeight();
        // One column goes to the cursor gutter; a boxed table also gives up its
        // border and inner padding.
        const chrome = 1 + (variant === 'boxed' ? 4 : 0);
        const width = sizeProp(
            props.width,
            Math.max(12, getTerminalSize().columns - chrome),
            1,
        );

        const cursor = Math.min(cursorOf(), Math.max(0, total - 1));
        const offset = scrollWindow(total, cursor, height, state.offset);
        const end = Math.min(total, offset + height);

        const dim = resolveColor('dim');
        const isSorted = (column: TableColumn<any>) =>
            !!props.sortable && column.sortable !== false && column.key === state.sortKey;

        // The sort marker lives INSIDE the header text, so the column widths
        // account for it. Reserved as a blank on every sortable column even
        // when it is not the active one — otherwise picking a sort column would
        // resize the table under the cursor.
        const laidColumns = !props.sortable ? columns : columns.map((column) => {
            if (column.sortable === false) return column;
            const slot = !isSorted(column) ? ' ' : state.sortDir === 'asc' ? GLYPHS.up : GLYPHS.down;
            return { ...column, header: column.header + slot };
        });

        const table = layoutTable(laidColumns, rows, { width, gap: props.gap });

        const headerCells = table.headerCells.flatMap((cell, i) => {
            const active = isSorted(columns[i]!);
            const node = <text color={active ? resolveColor('accent') : dim} bold>{cell}</text>;
            return i > 0 ? [<text color={dim}>{' '.repeat(table.gap)}</text>, node] : [node];
        });

        const lineWidth = table.rows.reduce(
            (widest, row) => Math.max(widest, displayWidth(row)),
            displayWidth(table.header),
        );

        const body: any[] = [];
        if (total === 0) {
            body.push(<box><text color={dim}> {props.emptyText ?? 'nothing to show'}</text></box>);
        }
        for (let i = offset; i < end; i++) {
            const selected = i === cursor && focused;
            const line = table.rows[i]!;
            const painted = paintRow(columns, rows[i], table.cells[i]!, table.gap, props.tone?.(rows[i]));
            body.push(
                <box>
                    <text color={resolveColor(selected ? 'accent' : 'faint')}>{selected ? GLYPHS.cursor : ' '}</text>
                    {selected
                        ? <text color={resolveColor('accentText')} backgroundColor={resolveColor('selSoft')}>{line}</text>
                        : <text>{painted}</text>}
                </box>,
            );
        }
        // Hold the frame height steady, so the panel below does not jump every
        // time a poll returns a shorter list.
        while (body.length < height) body.push(<box><text> </text></box>);

        const inner = (
            <box>
                <box><text> </text>{headerCells}</box>
                {variant === 'plain'
                    ? undefined
                    : <box><text color={dim}> {'─'.repeat(Math.max(1, lineWidth))}</text></box>}
                {body}
            </box>
        );

        const footer = props.showFooter === false ? undefined : (
            <box>
                <text color={dim}>
                    {total ? `  ${offset + 1}–${end}/${total}` : '  0/0'}
                    {state.sortKey ? ` · sorted by ${state.sortKey} ${state.sortDir}` : ''}
                </text>
            </box>
        );

        if (variant !== 'boxed') {
            return <box>{inner}{footer}</box>;
        }
        return (
            <box>
                <box
                    border="rounded"
                    borderColor={resolveColor(focused ? 'accent' : 'line')}
                    label={props.title}
                    labelColor={resolveColor(focused ? 'accent' : 'dim')}
                    padX={1}
                >
                    {inner}
                </box>
                {footer}
            </box>
        );
    };
}, { name: 'DataTable' });

/**
 * One row as a single SGR string. Per-cell colours are emitted run-length —
 * one text node per line rather than one per cell, so a re-sort patches one
 * prop per row instead of one per column.
 */
function paintRow(
    columns: readonly TableColumn<any>[],
    row: any,
    cells: readonly string[],
    gap: number,
    rowTone: string | undefined,
): string {
    const base = rowTone || 'fg';
    const sep = ' '.repeat(gap);
    let out = '';
    let last: string | null = null;
    let emitted = false;
    for (let i = 0; i < cells.length; i++) {
        if (i > 0) out += sep;
        const hex = resolveColor(columns[i]?.color?.(row) || base);
        if (hex !== last) {
            const sgr = hexToSGR(hex);
            if (sgr) {
                out += sgr;
                emitted = true;
            }
            last = hex;
        }
        out += cells[i];
    }
    // Trailing padding is dropped before the colour is closed: it is invisible
    // on its own, but it would extend any row highlight past the last
    // character. Default-fg rather than a full reset, which would clobber the
    // renderer's canvas background.
    const trimmed = out.trimEnd();
    return emitted ? trimmed + '\x1b[39m' : trimmed;
}

export default DataTable;
