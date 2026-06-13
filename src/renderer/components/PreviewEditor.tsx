import {

  useEffect,

  useImperativeHandle,

  useRef,

  forwardRef,

  useCallback,

} from 'react';

import { useAppStore } from '../stores/appStore';

import { flattenMdPaths, resolveWikiLinkTarget } from '@shared/wiki-links';

import { markdownToHtml, htmlToMarkdown } from '../editor/markdown-roundtrip';

import {

  applyPreviewFormat,

  applyPreviewInsert,

  focusEditable,

  focusAfterTitleHeading,

  breakOutOfHeadingOnEnter,

  insertPlainTextPreservingBreaks,

  insertWikiLinkAtSelection,

} from '../editor/contenteditable-commands';

import { findInEditable, replaceSelectionInEditable } from '../editor/find-in-document';



export interface PreviewEditorHandle {

  insertMarkdown: (before: string, after: string) => void;

  applyFormat: (action: string) => void;

  insertWikiLink: (targetPath: string) => void;

  focus: () => void;

  focusBodyStart: () => void;

  findNext: (query: string) => boolean;

  findPrevious: (query: string) => boolean;

  replaceOne: (query: string, replacement: string) => boolean;

  replaceAll: (query: string, replacement: string) => boolean;

}



interface PreviewEditorProps {

  body: string;

  fontSize: number;

  isVisible: boolean;

  onChange: (body: string) => void;

  onCheckboxToggle?: (line: number) => void;

}



export const PreviewEditor = forwardRef<PreviewEditorHandle, PreviewEditorProps>(

  function PreviewEditor({ body, fontSize, isVisible, onChange, onCheckboxToggle }, ref) {

    const editorRef = useRef<HTMLDivElement>(null);

    const lastSynced = useRef<string | null>(null);

    const openFile = useAppStore((s) => s.openFile);

    const setStatusMessage = useAppStore((s) => s.setStatusMessage);

    const fileTree = useAppStore((s) => s.fileTree);

    const archiveTree = useAppStore((s) => s.archiveTree);

    const activeFile = useAppStore((s) => s.activeFile);



    const syncFromEditor = useCallback(() => {

      const root = editorRef.current;

      if (!root) return;

      const nextBody = htmlToMarkdown(root.innerHTML);

      lastSynced.current = nextBody;

      onChange(nextBody);

    }, [onChange]);



    const loadBody = useCallback((value: string) => {

      if (editorRef.current) {

        editorRef.current.innerHTML = value ? markdownToHtml(value) : '<p><br></p>';

      }

      lastSynced.current = value;

    }, []);



    useImperativeHandle(ref, () => ({

      insertMarkdown: (before, after) => {

        focusEditable(editorRef.current);

        applyPreviewInsert(before, after);

        syncFromEditor();

      },

      applyFormat: (action) => {

        focusEditable(editorRef.current);

        applyPreviewFormat(action);

        syncFromEditor();

      },

      insertWikiLink: (targetPath) => {

        focusEditable(editorRef.current);

        insertWikiLinkAtSelection(targetPath);

        syncFromEditor();

      },

      focus: () => focusEditable(editorRef.current),

      focusBodyStart: () => {
        focusAfterTitleHeading(editorRef.current);
      },

      findNext: (query) => {

        focusEditable(editorRef.current);

        return findInEditable(query, { backwards: false, wrap: true });

      },

      findPrevious: (query) => {

        focusEditable(editorRef.current);

        return findInEditable(query, { backwards: true, wrap: true });

      },

      replaceOne: (query, replacement) => {

        focusEditable(editorRef.current);

        if (!replaceSelectionInEditable(replacement)) {

          return findInEditable(query, { backwards: false, wrap: true });

        }

        syncFromEditor();

        return true;

      },

      replaceAll: (query, replacement) => {

        focusEditable(editorRef.current);

        if (!query) return false;

        let count = 0;

        let guard = 0;

        const root = editorRef.current;

        if (!root) return false;

        const sel = window.getSelection();

        sel?.removeAllRanges();

        const range = document.createRange();

        range.selectNodeContents(root);

        sel?.addRange(range);

        sel?.collapseToStart();

        while (guard < 10_000 && findInEditable(query, { backwards: false, wrap: false })) {

          guard++;

          const before = root.textContent ?? '';

          if (replaceSelectionInEditable(replacement)) {

            count++;

          } else {

            break;

          }

          if ((root.textContent ?? '') === before) break;

        }

        syncFromEditor();

        return count > 0;

      },

    }));



    const prevFile = useRef(activeFile);

    const prevVisible = useRef(isVisible);



    useEffect(() => {

      const becameVisible = isVisible && !prevVisible.current;

      const fileChanged = activeFile !== prevFile.current;



      prevVisible.current = isVisible;

      prevFile.current = activeFile;



      if (!isVisible) return;



      if (becameVisible || fileChanged) {

        loadBody(body);

        return;

      }

      const root = editorRef.current;
      const isEditing =
        root != null &&
        (document.activeElement === root || root.contains(document.activeElement));
      if (isEditing) return;

      if (lastSynced.current !== null && body === lastSynced.current) return;

      loadBody(body);

    }, [isVisible, activeFile, body, loadBody]);



    useEffect(() => {

      return () => {

        const root = editorRef.current;

        if (!root) return;

        const nextBody = htmlToMarkdown(root.innerHTML);

        if (nextBody !== lastSynced.current) {

          onChange(nextBody);

        }

      };

    }, [onChange]);



    const handleInput = () => {

      syncFromEditor();

    };



    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (breakOutOfHeadingOnEnter()) {
          syncFromEditor();
          return;
        }
        if (e.shiftKey) {
          document.execCommand('insertParagraph');
        } else {
          document.execCommand('insertLineBreak');
        }
        syncFromEditor();
        return;
      }

      if (!e.ctrlKey && !e.metaKey) return;



      const key = e.key.toLowerCase();

      const withShift = e.shiftKey;

      const withAlt = e.altKey;



      const shortcuts: Record<string, string | undefined> = {

        b: 'bold',

        i: 'italic',

        k: 'link',

        '`': 'code',

      };



      if (!withShift && !withAlt && shortcuts[key]) {

        e.preventDefault();

        applyPreviewFormat(shortcuts[key]!);

        syncFromEditor();

        return;

      }



      if (withShift && key === 'x') {

        e.preventDefault();

        applyPreviewFormat('strikethrough');

        syncFromEditor();

        return;

      }



      if (withShift && key === '8') {

        e.preventDefault();

        applyPreviewFormat('list');

        syncFromEditor();

        return;

      }



      if (withShift && key === '7') {

        e.preventDefault();

        applyPreviewFormat('ordered');

        syncFromEditor();

        return;

      }



      if (withShift && key === '9') {

        e.preventDefault();

        applyPreviewFormat('checkbox');

        syncFromEditor();

        return;

      }



      if (withShift && key === '.') {

        e.preventDefault();

        applyPreviewFormat('quote');

        syncFromEditor();

        return;

      }



      if (withAlt && key === '1') {

        e.preventDefault();

        applyPreviewFormat('heading1');

        syncFromEditor();

        return;

      }



      if (withAlt && key === '2') {

        e.preventDefault();

        applyPreviewFormat('heading2');

        syncFromEditor();

        return;

      }



      if (withAlt && key === '3') {

        e.preventDefault();

        applyPreviewFormat('heading3');

        syncFromEditor();

      }

    };



    const handleClick = (e: React.MouseEvent) => {

      const target = e.target as HTMLElement;



      if (target.classList.contains('wiki-link')) {

        e.preventDefault();

        const wiki = target.getAttribute('data-wiki');

        if (!wiki) return;



        const paths = flattenMdPaths([...fileTree, ...archiveTree]);

        const resolved = resolveWikiLinkTarget(wiki, paths);

        if (resolved) {

          openFile(resolved);

        } else {

          setStatusMessage(`Заметка «${wiki}» не найдена`);

        }

        return;

      }



      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {

        e.preventDefault();

        const li = target.closest('li');

        if (!li || !onCheckboxToggle) return;



        const lineAttr = li.getAttribute('data-body-line');

        if (lineAttr !== null) {

          const input = target as HTMLInputElement;

          input.checked = !input.checked;

          onCheckboxToggle(parseInt(lineAttr, 10));

        }

      }

    };



    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const plain = e.clipboardData.getData('text/plain');
      const html = e.clipboardData.getData('text/html');

      if (html && !plain.includes('\n')) {
        insertPlainTextPreservingBreaks(extractTextWithBreaksFromHtml(html));
      } else {
        insertPlainTextPreservingBreaks(plain);
      }

      syncFromEditor();
    };



    return (

      <div

        ref={editorRef}

        contentEditable

        suppressContentEditableWarning

        spellCheck

        className="markdown-preview writing-surface h-full overflow-y-auto outline-none"

        style={{ fontSize: `${fontSize}px` }}

        onInput={handleInput}

        onKeyDown={handleKeyDown}

        onClick={handleClick}

        onPaste={handlePaste}

      />

    );

  }

);



function extractTextWithBreaksFromHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blockTags = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'BLOCKQUOTE']);

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    if (el.tagName === 'BR') return '\n';

    let out = '';
    for (const child of Array.from(el.childNodes)) {
      out += walk(child);
    }

    if (blockTags.has(el.tagName) && out && !out.endsWith('\n')) {
      out += '\n';
    }
    if (blockTags.has(el.tagName) && el.tagName !== 'LI') {
      out += '\n';
    }

    return out;
  };

  const text = walk(doc.body);
  return text.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}
