import {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useCallback,
  type CSSProperties,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { useAppStore } from '../stores/appStore';
import { flattenMdPaths, resolveWikiLinkTarget } from '@shared/wiki-links';
import { createTiptapExtensions } from '../editor/tiptap-setup';
import { findInEditable, replaceSelectionInEditable } from '../editor/find-in-document';

export interface PreviewEditorHandle {
  insertMarkdown: (before: string, after: string) => void;
  applyFormat: (action: string) => void;
  insertWikiLink: (targetPath: string) => void;
  focus: () => void;
  focusBodyStart: () => void;
  getBody: () => string;
  findNext: (query: string) => boolean;
  findPrevious: (query: string) => boolean;
  replaceOne: (query: string, replacement: string) => boolean;
  replaceAll: (query: string, replacement: string) => boolean;
}

interface PreviewEditorProps {
  body: string;
  fontSize: number;
  isVisible: boolean;
  showRuledLines: boolean;
  onChange: (body: string) => void;
  onCheckboxToggle?: (line: number) => void;
}

export const PreviewEditor = forwardRef<PreviewEditorHandle, PreviewEditorProps>(
  function PreviewEditor({ body, fontSize, isVisible, showRuledLines, onChange }, ref) {
    const lastEmitted = useRef(body);
    const openFile = useAppStore((s) => s.openFile);
    const setStatusMessage = useAppStore((s) => s.setStatusMessage);
    const fileTree = useAppStore((s) => s.fileTree);
    const archiveTree = useAppStore((s) => s.archiveTree);
    const activeFile = useAppStore((s) => s.activeFile);
    const prevFile = useRef(activeFile);
    const prevVisible = useRef(isVisible);
    const prevRuled = useRef(showRuledLines);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const editor = useEditor({
      extensions: createTiptapExtensions(),
      content: body || '',
      contentType: 'markdown',
      editable: isVisible,
      editorProps: {
        attributes: {
          class: 'tiptap writing-surface outline-none',
          spellcheck: 'true',
        },
      },
      onUpdate: ({ editor: ed }) => {
        const markdown = ed.getMarkdown();
        if (markdown === lastEmitted.current) return;
        lastEmitted.current = markdown;
        onChangeRef.current(markdown);
      },
    });

    useEffect(() => {
      editor?.setEditable(isVisible);
    }, [editor, isVisible]);

    useEffect(() => {
      if (!editor) return;

      const becameVisible = isVisible && !prevVisible.current;
      const fileChanged = activeFile !== prevFile.current;
      const ruledChanged = showRuledLines !== prevRuled.current;

      prevVisible.current = isVisible;
      prevFile.current = activeFile;
      prevRuled.current = showRuledLines;

      if (!isVisible && !fileChanged && !ruledChanged) return;

      const current = editor.getMarkdown();
      if (
        fileChanged ||
        ruledChanged ||
        becameVisible ||
        (body !== lastEmitted.current && body !== current)
      ) {
        editor.commands.setContent(body || '', { contentType: 'markdown', emitUpdate: false });
        lastEmitted.current = body;
      }
    }, [editor, body, activeFile, isVisible, showRuledLines]);

    const runFormat = useCallback(
      (action: string) => {
        if (!editor) return;
        const chain = editor.chain().focus();

        switch (action) {
          case 'bold':
            chain.toggleBold().run();
            return;
          case 'italic':
            chain.toggleItalic().run();
            return;
          case 'strikethrough':
            chain.toggleStrike().run();
            return;
          case 'heading1':
            chain.toggleHeading({ level: 1 }).run();
            return;
          case 'heading2':
            chain.toggleHeading({ level: 2 }).run();
            return;
          case 'heading3':
            chain.toggleHeading({ level: 3 }).run();
            return;
          case 'list':
            chain.toggleBulletList().run();
            return;
          case 'ordered':
            chain.toggleOrderedList().run();
            return;
          case 'checkbox':
            chain.toggleTaskList().run();
            return;
          case 'quote':
            chain.toggleBlockquote().run();
            return;
          case 'code':
            chain.toggleCode().run();
            return;
          case 'link': {
            const url = window.prompt('URL ссылки', 'https://');
            if (url) chain.setLink({ href: url }).run();
            return;
          }
          case 'alignLeft':
            chain.setTextAlign('left').run();
            return;
          case 'alignCenter':
            chain.setTextAlign('center').run();
            return;
          case 'alignRight':
            chain.setTextAlign('right').run();
            return;
          case 'alignJustify':
            chain.setTextAlign('justify').run();
            return;
          default:
            return;
        }
      },
      [editor]
    );

    useImperativeHandle(
      ref,
      () => ({
        insertMarkdown: (before: string, after: string) => {
          if (!editor) return;
          const { from, to } = editor.state.selection;
          const selected = editor.state.doc.textBetween(from, to, '');
          editor
            .chain()
            .focus()
            .insertContent(`${before}${selected}${after}`, { contentType: 'markdown' })
            .run();
        },
        applyFormat: runFormat,
        insertWikiLink: (targetPath: string) => {
          if (!editor) return;
          const link = targetPath.replace(/\.md$/i, '');
          editor.chain().focus().insertContent(`[[${link}]]`).run();
        },
        focus: () => editor?.commands.focus(),
        focusBodyStart: () => {
          if (!editor) return;
          const { doc } = editor.state;
          let afterTitle = 0;
          let seenTitle = false;

          doc.descendants((node, pos) => {
            if (seenTitle) return false;
            if (node.type.name === 'heading' && node.attrs.level === 1) {
              seenTitle = true;
              afterTitle = pos + node.nodeSize;
              return false;
            }
            return undefined;
          });

          const safePos = Math.min(Math.max(afterTitle, 1), doc.content.size - 1);
          const tr = editor.state.tr.setSelection(TextSelection.create(doc, safePos));
          editor.view.dispatch(tr);
          editor.commands.focus();
        },
        getBody: () => editor?.getMarkdown() ?? '',
        findNext: (query: string) => {
          editor?.commands.focus();
          return findInEditable(query, { backwards: false, wrap: true });
        },
        findPrevious: (query: string) => {
          editor?.commands.focus();
          return findInEditable(query, { backwards: true, wrap: true });
        },
        replaceOne: (query: string, replacement: string) => {
          editor?.commands.focus();
          if (!replaceSelectionInEditable(replacement)) {
            return findInEditable(query, { backwards: false, wrap: true });
          }
          const markdown = editor?.getMarkdown();
          if (markdown !== undefined) {
            lastEmitted.current = markdown;
            onChangeRef.current(markdown);
          }
          return true;
        },
        replaceAll: (query: string, replacement: string) => {
          if (!editor || !query) return false;
          editor.commands.focus();

          let count = 0;
          let guard = 0;
          const root = editor.view.dom;
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

          const markdown = editor.getMarkdown();
          lastEmitted.current = markdown;
          onChangeRef.current(markdown);
          return count > 0;
        },
      }),
      [editor, runFormat]
    );

    const handleWikiClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('wiki-link')) return;

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
    };

    const sheetClass = showRuledLines
      ? 'notebook-sheet editor-ruled tiptap-sheet'
      : 'markdown-preview tiptap-sheet';

    return (
      <div className={showRuledLines ? 'notebook-page h-full overflow-y-auto' : 'h-full overflow-y-auto'}>
        <div
          className={sheetClass}
          style={
            {
              fontSize: `${fontSize}px`,
              '--editor-font-size': `${fontSize}px`,
            } as CSSProperties
          }
          onClick={handleWikiClick}
        >
          <EditorContent editor={editor} className="tiptap-editor-host" />
        </div>
      </div>
    );
  }
);
