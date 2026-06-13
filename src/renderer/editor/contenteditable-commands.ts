export function focusEditable(root: HTMLElement | null): void {
  if (!root) return;
  root.focus();
}

const BODY_BLOCK_TAGS = new Set(['P', 'DIV', 'UL', 'OL', 'BLOCKQUOTE', 'PRE']);

/** Курсор в обычный текст под заголовком H1 (не в сам заголовок) */
export function focusAfterTitleHeading(root: HTMLElement | null): void {
  if (!root) return;
  root.focus();

  const h1 = root.querySelector('h1');
  if (!h1) {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
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

  const range = document.createRange();
  range.selectNodeContents(block);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Enter в заголовке — новый абзац обычного текста под ним */
export function breakOutOfHeadingOnEnter(): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  let heading: HTMLElement | null = null;
  let node: Node | null = sel.anchorNode;
  while (node) {
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
  return true;
}

export function execFormat(command: string, value?: string): boolean {
  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

export function insertTextAtSelection(text: string): void {
  insertPlainTextPreservingBreaks(text);
}

/** Вставка plain text с сохранением переносов строк (как <br> в contenteditable) */
export function insertPlainTextPreservingBreaks(text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const fragment = document.createDocumentFragment();
  const lines = normalized.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      fragment.appendChild(document.createElement('br'));
    }
    if (lines[i].length > 0) {
      fragment.appendChild(document.createTextNode(lines[i]));
    }
  }

  range.insertNode(fragment);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function wrapSelection(before: string, after: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const selected = range.toString();
  const node = document.createTextNode(`${before}${selected}${after}`);
  range.deleteContents();
  range.insertNode(node);

  const start = node.length - after.length - (selected ? 0 : before.length);
  const end = node.length - after.length;
  range.setStart(node, Math.max(before.length, start));
  range.setEnd(node, Math.max(before.length, end));
  selection.removeAllRanges();
  selection.addRange(range);
}

export function applyPreviewFormat(action: string): void {
  switch (action) {
    case 'bold':
      execFormat('bold');
      break;
    case 'italic':
      execFormat('italic');
      break;
    case 'heading1':
      execFormat('formatBlock', 'h1');
      break;
    case 'heading2':
      execFormat('formatBlock', 'h2');
      break;
    case 'heading3':
      execFormat('formatBlock', 'h3');
      break;
    case 'list':
      execFormat('insertUnorderedList');
      break;
    case 'ordered':
      execFormat('insertOrderedList');
      break;
    case 'checkbox':
      insertTextAtSelection('- [ ] ');
      break;
    case 'link': {
      const url = window.prompt('URL ссылки', 'https://');
      if (url) execFormat('createLink', url);
      break;
    }
    case 'code':
      wrapSelection('`', '`');
      break;
    case 'quote':
      execFormat('formatBlock', 'blockquote');
      break;
    case 'strikethrough':
      execFormat('strikeThrough');
      break;
    default:
      break;
  }
}

export function applyPreviewInsert(before: string, after: string): void {
  wrapSelection(before, after);
}

export function insertWikiLinkAtSelection(targetPath: string): void {
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
  range.insertNode(space);
  range.insertNode(anchor);

  range.setStartAfter(space);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
