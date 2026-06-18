// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyPreviewInsert,
  bookmarkSelection,
  insertPlainTextPreservingBreaks,
  prepareEditorEdit,
  resolvePasteText,
  wrapSelection,
} from './contenteditable-commands';

function createEditor(html = '<p>Hello world</p>'): HTMLDivElement {
  const root = document.createElement('div');
  root.contentEditable = 'true';
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function setCaret(root: HTMLElement, node: Node, offset: number): void {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  bookmarkSelection(root);
}

describe('contenteditable-commands', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('вставляет текст в позицию курсора, а не в конец', () => {
    const root = createEditor('<p>Hello world</p>');
    const text = root.querySelector('p')!.firstChild!;
    setCaret(root, text, 5);

    root.blur();
    prepareEditorEdit(root);
    insertPlainTextPreservingBreaks(root, ' brave');

    expect(root.textContent).toBe('Hello brave world');
    expect(root.textContent).not.toBe('Hello world brave');
  });

  it('восстанавливает курсор после blur и оборачивает выделение', () => {
    const root = createEditor('<p>Hello world</p>');
    const text = root.querySelector('p')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    bookmarkSelection(root);

    root.blur();
    wrapSelection(root, '**', '**');

    expect(root.textContent).toBe('**Hello** world');
  });

  it('вставляет markdown-обёртку в место курсора после потери фокуса', () => {
    const root = createEditor('<p>abc</p>');
    const text = root.querySelector('p')!.firstChild!;
    setCaret(root, text, 1);

    root.blur();
    applyPreviewInsert(root, '*', '*');

    expect(root.textContent).toBe('a**bc');
    const sel = window.getSelection();
    expect(sel?.focusOffset).toBe(1);
  });

  it('вставляет однострочный текст без переноса строки', () => {
    const root = createEditor('<p>Hello world</p>');
    const text = root.querySelector('p')!.firstChild!;
    setCaret(root, text, 5);

    insertPlainTextPreservingBreaks(root, 'paste');
    expect(root.textContent).toBe('Hellopaste world');
    expect(root.querySelectorAll('br').length).toBe(0);
  });

  it('resolvePasteText предпочитает plain и не добавляет перенос из HTML', () => {
    const resolved = resolvePasteText('слово', '<html><body><p>слово</p></body></html>');
    expect(resolved).toBe('слово');
    expect(resolved.includes('\n')).toBe(false);
  });

  it('игнорирует завершающий перевод строки при однострочной вставке', () => {
    const root = createEditor('<p>ab</p>');
    const text = root.querySelector('p')!.firstChild!;
    setCaret(root, text, 1);

    insertPlainTextPreservingBreaks(root, 'X\n');
    expect(root.textContent).toBe('aXb');
  });
});
