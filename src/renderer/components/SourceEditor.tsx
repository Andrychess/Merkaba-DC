import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { Compartment, EditorState, EditorSelection, Prec } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import {
  search,
  highlightSelectionMatches,
  setSearchQuery,
  findNext as cmFindNext,
  findPrevious as cmFindPrevious,
  replaceNext as cmReplaceNext,
  replaceAll as cmReplaceAll,
  SearchQuery,
} from '@codemirror/search';
import {
  wrapSelection,
  insertLink,
  prefixLines,
  toggleHeading,
} from '../editor/markdown-keymap';
import { getTextBodyCursorOffset } from '@shared/note-heading';

function applySearchQuery(view: EditorView, query: string, replace = '') {
  setSearchQuery(view, new SearchQuery({ search: query, replace }));
}

interface SourceEditorProps {
  content: string;
  onChange: (content: string) => void;
  fontSize: number;
  isVisible: boolean;
  showLineNumbers: boolean;
  showRuledLines: boolean;
}

export interface SourceEditorHandle {
  insertMarkdown: (before: string, after: string) => void;
  insertLink: () => void;
  insertWikiLink: (targetPath: string) => void;
  focus: () => void;
  focusBodyStart: () => void;
  getBody: () => string;
  findNext: (query: string) => boolean;
  findPrevious: (query: string) => boolean;
  replaceOne: (query: string, replacement: string) => boolean;
  replaceAll: (query: string, replacement: string) => boolean;
}

const markdownFormatKeymap = keymap.of([
  { key: 'Mod-b', run: wrapSelection('**', '**'), preventDefault: true },
  { key: 'Mod-i', run: wrapSelection('*', '*'), preventDefault: true },
  { key: 'Mod-k', run: insertLink, preventDefault: true },
  { key: 'Mod-`', run: wrapSelection('`', '`'), preventDefault: true },
  { key: 'Mod-Shift-x', run: wrapSelection('~~', '~~'), preventDefault: true },
  { key: 'Mod-Shift-8', run: prefixLines('- '), preventDefault: true },
  { key: 'Mod-Shift-7', run: prefixLines('1. '), preventDefault: true },
  { key: 'Mod-Shift-9', run: prefixLines('- [ ] '), preventDefault: true },
  { key: 'Mod-Alt-1', run: toggleHeading(1), preventDefault: true },
  { key: 'Mod-Alt-2', run: toggleHeading(2), preventDefault: true },
  { key: 'Mod-Alt-3', run: toggleHeading(3), preventDefault: true },
  { key: 'Mod-Shift-.', run: prefixLines('> '), preventDefault: true },
]);

const lineUiCompartment = new Compartment();

function lineUiExtensions(enabled: boolean) {
  if (!enabled) return [];
  return [lineNumbers(), highlightActiveLine()];
}

export const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(
  function SourceEditor({ content, onChange, fontSize, isVisible, showLineNumbers, showRuledLines }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useImperativeHandle(ref, () => ({
      insertMarkdown: (before: string, after: string) => {
        const view = viewRef.current;
        if (!view) return;
        wrapSelection(before, after)(view);
      },
      insertLink: () => {
        const view = viewRef.current;
        if (!view) return;
        insertLink(view);
      },
      insertWikiLink: (targetPath: string) => {
        const view = viewRef.current;
        if (!view) return;
        const link = targetPath.replace(/\.md$/i, '');
        const text = `[[${link}]] `;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: EditorSelection.cursor(from + text.length),
        });
      },
      focus: () => viewRef.current?.focus(),
      focusBodyStart: () => {
        const view = viewRef.current;
        if (!view) return;
        const pos = getTextBodyCursorOffset(view.state.doc.toString());
        view.dispatch({
          selection: EditorSelection.cursor(pos),
          scrollIntoView: true,
        });
        view.focus();
      },
      getBody: () => viewRef.current?.state.doc.toString() ?? '',
      findNext: (query: string) => {
        const view = viewRef.current;
        if (!view || !query) return false;
        applySearchQuery(view, query);
        return cmFindNext(view);
      },
      findPrevious: (query: string) => {
        const view = viewRef.current;
        if (!view || !query) return false;
        applySearchQuery(view, query);
        return cmFindPrevious(view);
      },
      replaceOne: (query: string, replacement: string) => {
        const view = viewRef.current;
        if (!view || !query) return false;
        applySearchQuery(view, query, replacement);
        return cmReplaceNext(view);
      },
      replaceAll: (query: string, replacement: string) => {
        const view = viewRef.current;
        if (!view || !query) return false;
        applySearchQuery(view, query, replacement);
        return cmReplaceAll(view);
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      });

      const state = EditorState.create({
        doc: content,
        extensions: [
          lineUiCompartment.of(lineUiExtensions(showLineNumbers)),
          drawSelection(),
          history(),
          Prec.highest(markdownFormatKeymap),
          Prec.highest(
            keymap.of([
              { key: 'Mod-f', run: () => true, preventDefault: true },
              { key: 'Mod-h', run: () => true, preventDefault: true },
            ])
          ),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown({ base: markdownLanguage }),
          syntaxHighlighting(defaultHighlightStyle),
          search({ top: false }),
          highlightSelectionMatches(),
          updateListener,
          EditorView.theme({
            '&': { height: '100%', fontSize: 'var(--source-editor-font-size, 14px)' },
            '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', Consolas, monospace" },
            '.cm-content': { padding: '16px 0' },
            '.cm-line': { padding: '0 16px 0 8px' },
          }),
          EditorView.lineWrapping,
        ],
      });

      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: lineUiCompartment.reconfigure(lineUiExtensions(showLineNumbers)),
      });
    }, [showLineNumbers]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.style.setProperty('--source-editor-font-size', `${fontSize}px`);
      el.style.setProperty('--editor-font-size', `${fontSize}px`);
    }, [fontSize]);

    useEffect(() => {
      if (!isVisible) return;
      const view = viewRef.current;
      if (!view) return;
      if (view.hasFocus) return;
      const current = view.state.doc.toString();
      if (current !== content) {
        const sel = view.state.selection.main;
        view.dispatch({
          changes: { from: 0, to: current.length, insert: content },
          selection: EditorSelection.single(
            Math.min(sel.from, content.length),
            Math.min(sel.to, content.length)
          ),
        });
      }
    }, [content, isVisible]);

    return (
      <div
        ref={containerRef}
        className={`source-editor-host h-full${showRuledLines ? ' editor-ruled' : ''}`}
      />
    );
  }
);
