import { useCallback, useEffect, useRef, useState } from 'react';
import type { MusicData, MusicRow, MusicRowKind } from '@shared/note-types';
import {
  DEFAULT_MUSIC_CHORD_FONT,
  DEFAULT_MUSIC_LINE_HEIGHT,
  DEFAULT_MUSIC_LYRIC_FONT,
  createMusicRow,
  formatMusicTextToRows,
  inferMusicRowKind,
  parseMusicBody,
  reformatMusicData,
  serializeMusicBody,
} from '@shared/note-types';
import { keepEditorFocus } from '@renderer/utils/focus';

interface MusicEditorProps {
  body: string;
  title: string | null;
  fontSize: number;
  onChange: (body: string) => void;
  onTitleChange: (title: string) => void;
}

const SYNC_DEBOUNCE_MS = 450;
const SETTINGS_DEBOUNCE_MS = 300;

function extractTitleFromRows(rows: MusicRow[]): string | null {
  const titleRow = rows.find((r, i) => inferMusicRowKind(r, i) === 'title');
  if (!titleRow) return null;
  return titleRow.lyric.replace(/^#\s*/, '').trim() || null;
}

function rowKind(row: MusicRow, index: number): MusicRowKind {
  return inferMusicRowKind(row, index);
}

function reorderRows(rows: MusicRow[], from: number, to: number): MusicRow[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) {
    return rows;
  }
  const next = [...rows];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function findRowIndex(rows: MusicRow[], rowId: string | null): number {
  if (!rowId) return -1;
  return rows.findIndex((row) => row.id === rowId);
}

export function MusicEditor({ body, title, fontSize, onChange, onTitleChange }: MusicEditorProps) {
  const [data, setData] = useState<MusicData>(() => parseMusicBody(body));
  const [dragSectionIndex, setDragSectionIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lyricRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const activeRowId = useRef<string | null>(null);
  const lastBody = useRef(body);
  const latestDataRef = useRef(data);
  const pendingSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTitleSent = useRef(title);
  const rafRef = useRef<number | null>(null);
  const lastTick = useRef(0);

  const lyricSize = data.lyricFontSize ?? fontSize ?? DEFAULT_MUSIC_LYRIC_FONT;
  const chordSize = data.chordFontSize ?? DEFAULT_MUSIC_CHORD_FONT;
  const lineHeight = data.lineHeight ?? DEFAULT_MUSIC_LINE_HEIGHT;
  const rowGap = Math.round(6 + lyricSize * (lineHeight - 1) * 0.65);

  latestDataRef.current = data;

  const onChangeRef = useRef(onChange);
  const onTitleChangeRef = useRef(onTitleChange);
  onChangeRef.current = onChange;
  onTitleChangeRef.current = onTitleChange;

  const flushToParent = useCallback((next: MusicData) => {
    const serialized = serializeMusicBody(next);
    lastBody.current = serialized;
    onChangeRef.current(serialized);

    const resolvedTitle = extractTitleFromRows(next.rows);
    if (resolvedTitle && resolvedTitle !== lastTitleSent.current) {
      lastTitleSent.current = resolvedTitle;
      onTitleChangeRef.current(resolvedTitle);
    }
  }, []);

  const cancelPendingSync = useCallback(() => {
    if (pendingSyncRef.current) {
      clearTimeout(pendingSyncRef.current);
      pendingSyncRef.current = null;
    }
  }, []);

  const scheduleSync = useCallback(
    (delay = SYNC_DEBOUNCE_MS) => {
      cancelPendingSync();
      pendingSyncRef.current = setTimeout(() => {
        flushToParent(latestDataRef.current);
        pendingSyncRef.current = null;
      }, delay);
    },
    [cancelPendingSync, flushToParent]
  );

  const syncOut = useCallback(
    (next: MusicData, options?: { immediate?: boolean; debounceMs?: number }) => {
      setData(next);
      latestDataRef.current = next;

      if (options?.immediate) {
        cancelPendingSync();
        flushToParent(next);
        return;
      }

      scheduleSync(options?.debounceMs);
    },
    [cancelPendingSync, flushToParent, scheduleSync]
  );

  useEffect(() => {
    lastTitleSent.current = title;
  }, [title]);

  useEffect(() => {
    if (body === lastBody.current) return;

    const localSerialized = serializeMusicBody(latestDataRef.current);
    if (body === localSerialized) {
      lastBody.current = body;
      return;
    }

    cancelPendingSync();
    setData(parseMusicBody(body));
    lastBody.current = body;
  }, [body, cancelPendingSync]);

  useEffect(
    () => () => {
      if (pendingSyncRef.current) {
        clearTimeout(pendingSyncRef.current);
        pendingSyncRef.current = null;
        flushToParent(latestDataRef.current);
      }
    },
    [flushToParent]
  );

  useEffect(() => {
    if (!data.autoScroll) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = (ts: number) => {
      if (!lastTick.current) lastTick.current = ts;
      const delta = (ts - lastTick.current) / 1000;
      lastTick.current = ts;
      const el = scrollRef.current;
      if (el) {
        el.scrollTop += data.scrollSpeed * delta;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) {
          el.scrollTop = 0;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTick.current = 0;
    };
  }, [data.autoScroll, data.scrollSpeed]);

  const focusRow = (rowId: string) => {
    requestAnimationFrame(() => lyricRefs.current.get(rowId)?.focus());
  };

  const applyFormattedRows = (rows: MusicRow[]) => {
    syncOut({ ...data, rows }, { immediate: true });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text/plain');
    if (!pasted || !pasted.includes('\n')) return;

    e.preventDefault();
    applyFormattedRows(formatMusicTextToRows(pasted, title));
  };

  const handleAutoFormat = () => {
    const next = reformatMusicData(data, title);
    syncOut(next, { immediate: true });
  };

  const updateRow = (index: number, patch: Partial<MusicRow>) => {
    const rows = data.rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    const row = rows[index];
    const kind = row ? rowKind(row, index) : 'line';

    if (row && kind === 'line' && row.lyric.includes('\n')) {
      const flat = rows
        .flatMap((r, i) => {
          const k = rowKind(r, i);
          if (k === 'section') return [`## ${r.lyric.trim()}`];
          if (k === 'title') return [r.lyric.trim()];
          const lines: string[] = [];
          if (r.chord.trim()) lines.push(r.chord);
          if (r.lyric.trim()) lines.push(r.lyric);
          return lines;
        })
        .join('\n');
      applyFormattedRows(formatMusicTextToRows(flat, title));
      return;
    }

    syncOut({ ...data, rows });
  };

  const insertRow = (insertAt: number, row: MusicRow) => {
    const rows = [...data.rows];
    rows.splice(insertAt, 0, row);
    activeRowId.current = row.id ?? null;
    syncOut({ ...data, rows }, { immediate: true });
    if (row.id) focusRow(row.id);
  };

  const insertAfterFocusedRow = (): number => {
    const focusedIndex = findRowIndex(data.rows, activeRowId.current);
    if (focusedIndex >= 0) return focusedIndex;
    return Math.max(0, data.rows.length - 1);
  };

  const setActiveRow = (rowId: string) => {
    activeRowId.current = rowId;
  };

  const addLine = (afterIndex?: number) => {
    const row = createMusicRow('line');
    insertRow(afterIndex !== undefined ? afterIndex + 1 : insertAfterFocusedRow() + 1, row);
  };

  const addSection = (afterIndex?: number) => {
    const row = createMusicRow('section');
    insertRow(afterIndex !== undefined ? afterIndex + 1 : insertAfterFocusedRow() + 1, row);
  };

  const removeRow = (index: number) => {
    if (data.rows.length <= 1) return;
    if (rowKind(data.rows[index], index) === 'title') return;
    syncOut({ ...data, rows: data.rows.filter((_, i) => i !== index) }, { immediate: true });
  };

  const handleLyricKeyDown = (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;

    const kind = rowKind(data.rows[index], index);
    if (kind === 'section') return;

    e.preventDefault();
    addLine(index);
  };

  const toggleAutoScroll = () => {
    syncOut({ ...data, autoScroll: !data.autoScroll }, { immediate: true });
  };

  const setScrollSpeed = (speed: number) => {
    syncOut({ ...data, scrollSpeed: speed }, { debounceMs: SETTINGS_DEBOUNCE_MS });
  };

  const setLyricFontSize = (size: number) => {
    syncOut({ ...data, lyricFontSize: size }, { debounceMs: SETTINGS_DEBOUNCE_MS });
  };

  const setChordFontSize = (size: number) => {
    syncOut({ ...data, chordFontSize: size }, { debounceMs: SETTINGS_DEBOUNCE_MS });
  };

  const setLineHeight = (value: number) => {
    syncOut({ ...data, lineHeight: value }, { debounceMs: SETTINGS_DEBOUNCE_MS });
  };

  const minRowIndex = rowKind(data.rows[0], 0) === 'title' ? 1 : 0;

  const moveRowTo = (from: number, to: number) => {
    if (from === to || from < minRowIndex || to < minRowIndex) return;
    syncOut({ ...data, rows: reorderRows(data.rows, from, to) }, { immediate: true });
  };

  const moveSectionBy = (index: number, delta: -1 | 1) => {
    moveRowTo(index, index + delta);
  };

  const handleSectionDragStart = (index: number, e: React.DragEvent) => {
    setDragSectionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleRowDragOver = (index: number, e: React.DragEvent) => {
    if (dragSectionIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index < minRowIndex || index === dragSectionIndex) {
      setDropTargetIndex(null);
      return;
    }
    setDropTargetIndex(index);
  };

  const handleRowDrop = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragSectionIndex === null || index < minRowIndex) return;
    moveRowTo(dragSectionIndex, index);
    setDragSectionIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDragSectionIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div className="flex flex-col h-full" onPaste={handlePaste}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-merkaba-border bg-merkaba-sidebar/30 shrink-0">
        <button
          type="button"
          onMouseDown={keepEditorFocus}
          onClick={() => addLine()}
          className="btn-secondary !text-xs !py-1.5"
        >
          + Строка
        </button>
        <button
          type="button"
          onMouseDown={keepEditorFocus}
          onClick={() => addSection()}
          className="btn-secondary !text-xs !py-1.5"
          title="Добавить подзаголовок под строкой с курсором"
        >
          + Подзаголовок
        </button>
        <button
          type="button"
          onMouseDown={keepEditorFocus}
          onClick={handleAutoFormat}
          className="btn-secondary !text-xs !py-1.5"
          title="Разбить текст по строкам и распознать аккорды"
        >
          ⇅ По строкам
        </button>

        <div className="w-px h-5 bg-merkaba-border" />

        <label className="flex items-center gap-1.5 text-xs text-merkaba-muted" title="Размер текста">
          Текст
          <input
            type="range"
            min={12}
            max={36}
            value={lyricSize}
            onChange={(e) => setLyricFontSize(Number(e.target.value))}
            className="w-16 accent-merkaba-accent"
          />
          <span className="w-5 text-right tabular-nums text-merkaba-text">{lyricSize}</span>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-merkaba-muted" title="Размер аккордов">
          Аккорды
          <input
            type="range"
            min={10}
            max={28}
            value={chordSize}
            onChange={(e) => setChordFontSize(Number(e.target.value))}
            className="w-16 accent-merkaba-accent"
          />
          <span className="w-5 text-right tabular-nums text-merkaba-text">{chordSize}</span>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-merkaba-muted" title="Межстрочный интервал">
          Интервал
          <input
            type="range"
            min={12}
            max={25}
            step={1}
            value={Math.round(lineHeight * 10)}
            onChange={(e) => setLineHeight(Number(e.target.value) / 10)}
            className="w-16 accent-merkaba-accent"
          />
          <span className="w-7 text-right tabular-nums text-merkaba-text">{lineHeight.toFixed(1)}</span>
        </label>

        <div className="w-px h-5 bg-merkaba-border" />

        <button
          type="button"
          onMouseDown={keepEditorFocus}
          onClick={toggleAutoScroll}
          className={`btn-ghost !text-xs !py-1.5 ${data.autoScroll ? 'bg-merkaba-accent-soft text-merkaba-accent' : ''}`}
        >
          {data.autoScroll ? '⏸ Пауза' : '▶ Прокрутка'}
        </button>

        <label className="flex items-center gap-2 text-xs text-merkaba-muted">
          Скорость
          <input
            type="range"
            min={8}
            max={80}
            value={data.scrollSpeed}
            onChange={(e) => setScrollSpeed(Number(e.target.value))}
            className="w-20 accent-merkaba-accent"
          />
        </label>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 music-editor-scroll">
        <div className="max-w-3xl mx-auto flex flex-col" style={{ gap: `${rowGap}px` }}>
          {data.rows.map((row, index) => {
            const rowId = row.id ?? `row-${index}`;
            const kind = rowKind(row, index);
            const isTitle = kind === 'title';
            const isSection = kind === 'section';
            const showChord = kind === 'line';

            return (
              <div
                key={rowId}
                onDragOver={(e) => handleRowDragOver(index, e)}
                onDragLeave={() => setDropTargetIndex((prev) => (prev === index ? null : prev))}
                onDrop={(e) => handleRowDrop(index, e)}
                className={`group music-row relative ${
                  isSection ? 'music-section-row pt-2' : ''
                } ${dropTargetIndex === index ? 'music-row-drop-target' : ''} ${
                  dragSectionIndex === index ? 'opacity-50' : ''
                }`}
              >
                {isSection && (
                  <div className="absolute left-0 top-1 flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span
                      draggable
                      onDragStart={(e) => handleSectionDragStart(index, e)}
                      onDragEnd={handleDragEnd}
                      title="Перетащите подзаголовок"
                      className="music-drag-handle w-5 h-5 flex items-center justify-center text-merkaba-muted hover:text-merkaba-text cursor-grab active:cursor-grabbing select-none"
                    >
                      ⠿
                    </span>
                    <button
                      type="button"
                      onClick={() => moveSectionBy(index, -1)}
                      disabled={index <= minRowIndex}
                      className="w-5 h-4 text-[10px] text-merkaba-muted hover:text-merkaba-text disabled:opacity-25"
                      title="Выше"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSectionBy(index, 1)}
                      disabled={index >= data.rows.length - 1}
                      className="w-5 h-4 text-[10px] text-merkaba-muted hover:text-merkaba-text disabled:opacity-25"
                      title="Ниже"
                    >
                      ↓
                    </button>
                  </div>
                )}

                {!isTitle && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className={`absolute top-1 opacity-0 group-hover:opacity-100 w-6 h-6 text-merkaba-muted hover:text-merkaba-text transition-opacity ${
                      isSection ? 'right-0' : '-left-1'
                    }`}
                    title="Удалить"
                    tabIndex={-1}
                  >
                    ×
                  </button>
                )}

                <div className={isSection ? 'pl-7 pr-6' : 'pl-5'}>
                  {showChord && (
                    <textarea
                      value={row.chord}
                      onChange={(e) => updateRow(index, { chord: e.target.value })}
                      onFocus={() => setActiveRow(rowId)}
                      rows={1}
                      placeholder="Am    F    C    G"
                      className="music-chord-line w-full bg-transparent border-0 outline-none resize-none overflow-hidden font-mono text-merkaba-accent py-0.5"
                      style={{ fontSize: `${chordSize}px`, lineHeight }}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = `${el.scrollHeight}px`;
                      }}
                    />
                  )}

                  <textarea
                    ref={(el) => {
                      if (el) lyricRefs.current.set(rowId, el);
                      else lyricRefs.current.delete(rowId);
                    }}
                    value={row.lyric}
                    onChange={(e) => updateRow(index, { lyric: e.target.value })}
                    onFocus={() => setActiveRow(rowId)}
                    onKeyDown={(e) => handleLyricKeyDown(index, e)}
                    rows={Math.max(1, row.lyric.split('\n').length)}
                    placeholder={
                      isTitle
                        ? 'Название песни...'
                        : isSection
                          ? 'Куплет, припев, бридж...'
                          : 'Строка текста...'
                    }
                    className={`w-full bg-transparent border-0 outline-none resize-none ${
                      isTitle
                        ? 'font-bold text-merkaba-text'
                        : isSection
                          ? 'music-section-heading font-semibold uppercase tracking-widest text-merkaba-accent/80'
                          : 'text-merkaba-text/90'
                    }`}
                    style={{
                      fontSize: isTitle ? `${Math.round(lyricSize * 1.35)}px` : `${lyricSize}px`,
                      lineHeight,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
