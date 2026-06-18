import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { NOTE_TYPES } from '@shared/note-types';
import { SourceEditor, type SourceEditorHandle } from './SourceEditor';
import { PreviewEditor, type PreviewEditorHandle } from './PreviewEditor';
import { DrawingEditor } from './DrawingEditor';
import { MusicEditor } from './MusicEditor';
import { Toolbar } from './Toolbar';
import { WikiLinkPicker } from './WikiLinkPicker';
import { NoteMetaPanel } from './NoteMetaPanel';
import { SaveIndicator } from './SaveIndicator';
import { FindReplaceBar } from './FindReplaceBar';
import { NoteCreateMenu } from './NoteCreateMenu';
import { IconFile } from './Icons';
import { registerEditorFlush } from '../editor/editor-flush';

export function Editor() {
  const activeFile = useAppStore((s) => s.activeFile);
  const openFiles = useAppStore((s) => s.openFiles);
  const editorMode = useAppStore((s) => s.editorMode);
  const config = useAppStore((s) => s.config);
  const updateContent = useAppStore((s) => s.updateContent);
  const updateNoteMeta = useAppStore((s) => s.updateNoteMeta);
  const setEditorMode = useAppStore((s) => s.setEditorMode);
  const createNewNote = useAppStore((s) => s.createNewNote);
  const setNoteColor = useAppStore((s) => s.setNoteColor);
  const sourceRef = useRef<SourceEditorHandle>(null);
  const previewRef = useRef<PreviewEditorHandle>(null);
  const documentFindToken = useAppStore((s) => s.documentFindToken);
  const documentFindMode = useAppStore((s) => s.documentFindMode);
  const editorBodyFocusToken = useAppStore((s) => s.editorBodyFocusToken);
  const appliedBodyFocusToken = useRef(0);

  const [findBarOpen, setFindBarOpen] = useState(false);
  const [findBarMode, setFindBarMode] = useState<'find' | 'replace'>('find');
  const [findQuery, setFindQuery] = useState('');
  const [findReplacement, setFindReplacement] = useState('');

  useEffect(() => {
    registerEditorFlush(() => {
      const path = useAppStore.getState().activeFile;
      if (!path) return null;
      const mode = useAppStore.getState().editorMode;
      const body =
        mode === 'preview'
          ? previewRef.current?.getBody()
          : sourceRef.current?.getBody();
      if (body === undefined) return null;
      return { path, body };
    });
    return () => registerEditorFlush(null);
  }, []);

  useEffect(() => {
    if (documentFindToken > 0 && activeFile) {
      setFindBarMode(documentFindMode);
      setFindBarOpen(true);
      if (editorMode === 'source') {
        sourceRef.current?.focus();
      } else {
        previewRef.current?.focus();
      }
    }
  }, [documentFindToken, documentFindMode, activeFile, editorMode]);

  const activeOpenFile = openFiles.find((f) => f.path === activeFile);

  useEffect(() => {
    if (
      editorBodyFocusToken === 0 ||
      editorBodyFocusToken === appliedBodyFocusToken.current ||
      !activeFile ||
      !activeOpenFile
    ) {
      return;
    }
    if ((activeOpenFile.meta.noteType ?? 'text') !== 'text') return;

    appliedBodyFocusToken.current = editorBodyFocusToken;

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (editorMode === 'source') {
          sourceRef.current?.focusBodyStart();
        } else {
          previewRef.current?.focusBodyStart();
        }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [editorBodyFocusToken, activeFile, activeOpenFile, editorMode]);

  if (!activeFile || !activeOpenFile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-merkaba-elevated border border-merkaba-border flex items-center justify-center">
            <IconFile className="w-8 h-8 text-merkaba-muted" />
          </div>
          <h2 className="text-lg font-semibold text-merkaba-text mb-2">Выберите заметку</h2>
          <p className="text-sm text-merkaba-muted mb-6 leading-relaxed">
            Откройте файл в сайдбаре или создайте новую заметку
          </p>
          <NoteCreateMenu onCreate={(type) => createNewNote(undefined, type)} />
          <p className="text-xs text-merkaba-muted mt-4">Ctrl+N — текстовая заметка</p>
        </div>
      </div>
    );
  }

  const noteType = activeOpenFile.meta.noteType ?? 'text';
  const typeLabel = NOTE_TYPES.find((t) => t.id === noteType)?.label ?? 'Текст';
  const isTextNote = noteType === 'text';

  const handleInsert = (before: string, after: string, action?: string) => {
    if (editorMode === 'source' && action === 'link') {
      sourceRef.current?.insertLink();
      return;
    }
    if (editorMode === 'source') {
      sourceRef.current?.insertMarkdown(before, after);
    } else {
      previewRef.current?.insertMarkdown(before, after);
    }
  };

  const handleFormat = (action: string) => {
    previewRef.current?.applyFormat(action);
  };

  const handleInsertWikiLink = (targetPath: string) => {
    if (editorMode === 'source') {
      sourceRef.current?.insertWikiLink(targetPath);
    } else {
      previewRef.current?.insertWikiLink(targetPath);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="relative z-20 shrink-0 bg-merkaba-sidebar/30 border-b border-merkaba-border">
        <div className="flex items-center gap-2 px-3 py-2 min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-merkaba-muted shrink-0 px-1.5 py-0.5 rounded-md bg-merkaba-elevated border border-merkaba-border">
            {typeLabel}
          </span>

          {isTextNote && (
            <>
              <div className="flex items-center gap-2 overflow-x-auto min-w-0 flex-1">
                <Toolbar
                  mode={editorMode}
                  onInsert={handleInsert}
                  onFormat={handleFormat}
                />
              </div>

              <div className="w-px h-5 bg-merkaba-border shrink-0" />

              <WikiLinkPicker
                activePath={activeFile}
                content={activeOpenFile.content}
                onInsert={handleInsertWikiLink}
              />

              <div className="w-px h-5 bg-merkaba-border shrink-0" />
            </>
          )}

          <NoteMetaPanel
            meta={activeOpenFile.meta}
            onColorChange={(colorId) => setNoteColor(activeFile, colorId)}
            onMetaChange={updateNoteMeta}
          />

          <SaveIndicator />

          <div className="ml-auto flex items-center gap-2 shrink-0">
            {isTextNote && (
              <>
                <div className="flex items-center bg-merkaba-elevated rounded-lg p-0.5 border border-merkaba-border">
                  <button
                    onClick={() => setEditorMode('preview')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      editorMode === 'preview'
                        ? 'bg-merkaba-accent text-white shadow-sm'
                        : 'text-merkaba-muted hover:text-merkaba-text'
                    }`}
                  >
                    Просмотр
                  </button>
                  <button
                    onClick={() => setEditorMode('source')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      editorMode === 'source'
                        ? 'bg-merkaba-accent text-white shadow-sm'
                        : 'text-merkaba-muted hover:text-merkaba-text'
                    }`}
                  >
                    Исходник
                  </button>
                </div>
                <kbd className="hidden md:inline text-[10px] text-merkaba-muted bg-merkaba-elevated px-1.5 py-0.5 rounded border border-merkaba-border">
                  Ctrl+E
                </kbd>
              </>
            )}
          </div>
        </div>
      </div>

      {isTextNote && (
        <div className="relative z-10 shrink-0">
          <FindReplaceBar
            open={findBarOpen}
            mode={findBarMode}
            editorMode={editorMode}
            query={findQuery}
            replacement={findReplacement}
            onQueryChange={setFindQuery}
            onReplacementChange={setFindReplacement}
            onClose={() => setFindBarOpen(false)}
            sourceRef={sourceRef}
            previewRef={previewRef}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 bg-merkaba-bg relative z-0">
        {noteType === 'drawing' && (
          <DrawingEditor body={activeOpenFile.body} onChange={updateContent} />
        )}

        {noteType === 'music' && (
          <MusicEditor
            body={activeOpenFile.body}
            title={activeOpenFile.meta.title}
            fontSize={config.fontSize}
            showRuledLines={config.showRuledLines}
            onChange={updateContent}
            onTitleChange={(title) => updateNoteMeta({ title })}
          />
        )}

        {isTextNote && (
          <>
            <div className={editorMode === 'source' ? 'absolute inset-0' : 'hidden'}>
              <SourceEditor
                ref={sourceRef}
                content={activeOpenFile.body}
                onChange={updateContent}
                fontSize={config.fontSize}
                isVisible={editorMode === 'source'}
                showLineNumbers={config.showLineNumbers}
                showRuledLines={config.showRuledLines}
              />
            </div>
            <div className={editorMode === 'preview' ? 'absolute inset-0' : 'hidden'}>
              <PreviewEditor
                ref={previewRef}
                body={activeOpenFile.body}
                fontSize={config.fontSize}
                isVisible={editorMode === 'preview'}
                showRuledLines={config.showRuledLines}
                onChange={updateContent}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
