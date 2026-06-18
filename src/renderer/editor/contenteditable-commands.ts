const BODY_BLOCK_TAGS = new Set(['P', 'DIV', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'LI']);
const FORMAT_BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);

interface SelectionBookmark {
  root: HTMLElement;
  startPath: number[];
  startOffset: number;
  endPath: number[];
  endOffset: number;
}

let lastBookmark: SelectionBookmark | null = null;

function nodePath(root: Node, target: Node): number[] | null {
  const path: number[] = [];
  let current: Node | null = target;
  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.from(parent.childNodes).indexOf(current as ChildNode));
    current = parent;
  }
  return current === root ? path : null;
}

function nodeAtPath(root: Node, path: number[]): Node | null {
  let node: Node = root;
  for (const index of path) {
    if (index < 0 || index >= node.childNodes.length) return null;
    node = node.childNodes[index]!;
  }
  return node;
}

function maxOffset(node: Node, offset: number): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return Math.min(offset, (node.textContent ?? '').length);
  }
  return Math.min(offset, node.childNodes.length);
}

export function bookmarkSelection(root: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return;

  const startPath = nodePath(root, range.startContainer);
  const endPath = nodePath(root, range.endContainer);
  if (!startPath || !endPath) return;

  lastBookmark = {
    root,
    startPath,
    startOffset: range.startOffset,
    endPath,
    endOffset: range.endOffset,
  };
}

function restoreBookmark(root: HTMLElement): boolean {
  if (!lastBookmark || lastBookmark.root !== root) return false;

  const startNode = nodeAtPath(root, lastBookmark.startPath);
  const endNode = nodeAtPath(root, lastBookmark.endPath);
  if (!startNode || !endNode) return false;

  try {
    const range = document.createRange();
    range.setStart(startNode, maxOffset(startNode, lastBookmark.startOffset));
    range.setEnd(endNode, maxOffset(endNode, lastBookmark.endOffset));
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  } catch {
    return false;
  }
}

function placeCaretAtEndOfBlock(block: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(block);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function defaultCaretBlock(root: HTMLElement): HTMLElement {
  const ruledRow = root.querySelector('.ruled-row');
  if (ruledRow instanceof HTMLElement) {
    return ruledRow;
  }

  const h1 = root.querySelector('h1');
  if (h1) {
    let sibling = h1.nextElementSibling;
    while (sibling) {
      if (BODY_BLOCK_TAGS.has(sibling.tagName)) {
        return sibling as HTMLElement;
      }
      sibling = sibling.nextElementSibling;
    }
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    h1.insertAdjacentElement('afterend', p);
    return p;
  }

  const lastBlock = root.querySelector('p, div, ul, ol, blockquote, pre, h2, h3, h4, h5, h6');
  if (lastBlock instanceof HTMLElement) return lastBlock;

  const p = document.createElement('p');
  p.innerHTML = '<br>';
  root.appendChild(p);
  return p;
}

/** Фокус + восстановление курсора перед любой правкой */
export function prepareEditorEdit(root: HTMLElement | null): boolean {
  if (!root) return false;

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (root.contains(range.commonAncestorContainer)) {
      bookmarkSelection(root);
      return true;
    }
  }

  root.focus({ preventScroll: true });

  if (restoreBookmark(root)) {
    return true;
  }

  placeCaretAtEndOfBlock(defaultCaretBlock(root));
  bookmarkSelection(root);
  return true;
}

export function focusEditable(root: HTMLElement | null): void {
  prepareEditorEdit(root);
}

function blockElement(node: Node | null, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  if (current?.nodeType === Node.TEXT_NODE) current = current.parentNode;
  while (current && current !== root) {
    if (current instanceof HTMLElement && FORMAT_BLOCK_TAGS.has(current.tagName)) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function selectBlockContents(block: HTMLElement, collapseToEnd = false): void {
  const range = document.createRange();
  range.selectNodeContents(block);
  range.collapse(collapseToEnd);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function applyBlockTag(root: HTMLElement, tagName: string): void {
  if (!prepareEditorEdit(root)) return;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const block = blockElement(sel.anchorNode, root) ?? defaultCaretBlock(root);
  if (block.tagName.toLowerCase() === tagName.toLowerCase()) return;

  const next = document.createElement(tagName);
  next.innerHTML = block.innerHTML || '<br>';
  block.replaceWith(next);
  selectBlockContents(next, true);
  bookmarkSelection(root);
}

export function execFormat(command: string, value?: string): boolean {
  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

export function insertPlainTextPreservingBreaks(root: HTMLElement, text: string): void {
  if (!prepareEditorEdit(root)) return;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const lines = normalized.split('\n');
  while (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (lines.length === 1) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    if (typeof document.execCommand === 'function') {
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('insertText', false, lines[0]);
    } else {
      const node = document.createTextNode(lines[0]);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    bookmarkSelection(root);
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      fragment.appendChild(document.createElement('br'));
    }
    if (lines[i].length > 0) {
      fragment.appendChild(document.createTextNode(lines[i]));
    }
  }

  if (!fragment.childNodes.length) {
    fragment.appendChild(document.createTextNode(''));
  }

  range.insertNode(fragment);

  const last = fragment.lastChild;
  if (last) {
    range.setStartAfter(last);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  bookmarkSelection(root);
}

/** Текст из буфера: plain приоритетнее HTML (у HTML лишние переносы от <p>). */
export function resolvePasteText(plain: string, html: string): string {
  if (plain) {
    return plain.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }
  if (html) {
    return extractTextWithBreaksFromHtml(html);
  }
  return '';
}

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
      const chunk = walk(child);
      if (!chunk) continue;
      if (out && blockTags.has((child as HTMLElement).tagName ?? '') && !out.endsWith('\n')) {
        out += '\n';
      }
      out += chunk;
    }

    if (blockTags.has(el.tagName) && out && !out.endsWith('\n')) {
      out += '\n';
    }

    return out;
  };

  return walk(doc.body).replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

export function wrapSelection(root: HTMLElement, before: string, after: string): void {
  if (!prepareEditorEdit(root)) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);

  if (range.collapsed) {
    const marker = document.createTextNode(`${before}${after}`);
    range.insertNode(marker);
    const pos = before.length;
    range.setStart(marker, pos);
    range.setEnd(marker, pos);
    selection.removeAllRanges();
    selection.addRange(range);
    bookmarkSelection(root);
    return;
  }

  const selected = range.extractContents();
  const beforeNode = document.createTextNode(before);
  const afterNode = document.createTextNode(after);
  const holder = document.createDocumentFragment();
  holder.appendChild(beforeNode);
  holder.appendChild(selected);
  holder.appendChild(afterNode);
  range.insertNode(holder);

  range.setStartAfter(beforeNode);
  range.setEndBefore(afterNode);
  selection.removeAllRanges();
  selection.addRange(range);
  bookmarkSelection(root);
}

export function applyPreviewFormat(root: HTMLElement, action: string): void {
  if (!prepareEditorEdit(root)) return;

  switch (action) {
    case 'bold':
      execFormat('bold');
      break;
    case 'italic':
      execFormat('italic');
      break;
    case 'heading1':
      applyBlockTag(root, 'h1');
      break;
    case 'heading2':
      applyBlockTag(root, 'h2');
      break;
    case 'heading3':
      applyBlockTag(root, 'h3');
      break;
    case 'list': {
      const block = blockElement(window.getSelection()?.anchorNode ?? null, root);
      if (block) selectBlockContents(block, false);
      execFormat('insertUnorderedList');
      break;
    }
    case 'ordered': {
      const block = blockElement(window.getSelection()?.anchorNode ?? null, root);
      if (block) selectBlockContents(block, false);
      execFormat('insertOrderedList');
      break;
    }
    case 'checkbox':
      insertPlainTextPreservingBreaks(root, '- [ ] ');
      break;
    case 'link': {
      const url = window.prompt('URL ссылки', 'https://');
      if (url) execFormat('createLink', url);
      break;
    }
    case 'code':
      wrapSelection(root, '`', '`');
      break;
    case 'quote':
      applyBlockTag(root, 'blockquote');
      break;
    case 'strikethrough':
      execFormat('strikeThrough');
      break;
    default:
      break;
  }

  bookmarkSelection(root);
}

export function applyPreviewInsert(root: HTMLElement, before: string, after: string): void {
  wrapSelection(root, before, after);
}

export function insertWikiLinkAtSelection(root: HTMLElement, targetPath: string): void {
  if (!prepareEditorEdit(root)) return;

  const link = targetPath.replace(/\.md$/i, '');
  const display = link.split('/').pop() || link;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const anchor = document.createElement('a');
  anchor.className = 'wiki-link';
  anchor.setAttribute('data-wiki', link);
  anchor.setAttribute('contenteditable', 'false');
  anchor.textContent = display;

  const space = document.createTextNode(' ');
  const fragment = document.createDocumentFragment();
  fragment.appendChild(anchor);
  fragment.appendChild(space);
  range.insertNode(fragment);

  range.setStartAfter(space);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  bookmarkSelection(root);
}

/** Курсор в обычный текст под заголовком H1 (не в сам заголовок) */
export function focusAfterTitleHeading(root: HTMLElement | null): void {
  if (!root) return;
  root.focus({ preventScroll: true });

  const h1 = root.querySelector('h1');
  if (!h1) {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    bookmarkSelection(root);
    return;
  }

  let block: HTMLElement | null = null;
  let sibling = h1.nextElementSibling;
  while (sibling) {
    if (BODY_BLOCK_TAGS.has(sibling.tagName)) {
      block = sibling as HTMLElement;
      break;
    }
    sibling = sibling.nextElementSibling;
  }

  if (!block) {
    block = document.createElement('p');
    block.innerHTML = '<br>';
    h1.insertAdjacentElement('afterend', block);
  }

  placeCaretAtEndOfBlock(block);
  bookmarkSelection(root);
}

/** Enter в заголовке — новый абзац обычного текста под ним */
export function breakOutOfHeadingOnEnter(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  let heading: HTMLElement | null = null;
  let node: Node | null = sel.anchorNode;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/i.test((node as HTMLElement).tagName)) {
      heading = node as HTMLElement;
      break;
    }
    node = node.parentNode;
  }
  if (!heading) return false;

  const range = sel.getRangeAt(0);
  const afterRange = range.cloneRange();
  if (heading.lastChild) {
    afterRange.setEndAfter(heading.lastChild);
  } else {
    afterRange.setEnd(heading, 0);
  }
  const tailFragment = afterRange.extractContents();

  const p = document.createElement('p');
  if (tailFragment.textContent?.trim()) {
    p.appendChild(tailFragment);
  } else {
    p.innerHTML = '<br>';
  }

  heading.insertAdjacentElement('afterend', p);

  const newRange = document.createRange();
  newRange.selectNodeContents(p);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
  bookmarkSelection(root);
  return true;
}
