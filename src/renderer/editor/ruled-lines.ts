import MarkdownIt from 'markdown-it';
// @ts-expect-error нет типов
import markdownItCheckbox from 'markdown-it-checkbox';
import TurndownService from 'turndown';
import { substituteWikiLinks } from '@shared/wiki-links';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
}).use(markdownItCheckbox);

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});

turndown.addRule('wikiLink', {
  filter: (node) =>
    node.nodeName === 'A' && (node as HTMLElement).classList.contains('wiki-link'),
  replacement: (_content, node) => {
    const wiki = (node as HTMLElement).getAttribute('data-wiki') || '';
    return `[[${wiki}]]`;
  },
});

turndown.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content) => `~~${content}~~`,
});

export const RULED_LINE_HEIGHT_RATIO = 2;

function renderLineInline(text: string): string {
  const withLinks = substituteWikiLinks(text);
  return md.renderInline(withLinks);
}

function isEmptyRuledRow(el: HTMLElement): boolean {
  if (el.getAttribute('data-empty') === '1') return true;
  const html = el.innerHTML.trim().toLowerCase();
  if (!html || html === '<br>' || html === '<br/>') return true;
  return !(el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
}

function rowToMarkdownLine(row: HTMLElement): string {
  const heading = row.querySelector(':scope > h1, :scope > h2, :scope > h3');
  if (heading) {
    const level = Number(heading.tagName.charAt(1));
    const text = turndown.turndown(heading.innerHTML).trim();
    return `${'#'.repeat(level)} ${text}`;
  }

  const clone = row.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(document.createTextNode('\n')));
  return turndown.turndown(clone.innerHTML).replace(/\n+/g, ' ').trim();
}

/** Markdown → HTML: одна строка исходника = одна линия блокнота */
export function bodyToRuledHtml(body: string): string {
  if (!body) {
    return '<div class="ruled-row ruled-row--empty" data-empty="1"><br></div>';
  }

  const lines = body.split('\n');
  const parts: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      parts.push('<div class="ruled-row ruled-row--empty" data-empty="1"><br></div>');
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const inline = renderLineInline(heading[2]);
      parts.push(
        `<div class="ruled-row ruled-row--heading"><h${level}>${inline}</h${level}></div>`
      );
      continue;
    }

    const inline = renderLineInline(line);
    parts.push(`<div class="ruled-row">${inline || '<br>'}</div>`);
  }

  return parts.join('');
}

/** HTML блокнота → Markdown построчно */
export function ruledHtmlToBody(html: string): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  const rows = wrapper.querySelectorAll('.ruled-row');
  if (rows.length === 0) return '';

  const lines: string[] = [];
  for (const row of rows) {
    if (!(row instanceof HTMLElement)) continue;
    if (isEmptyRuledRow(row)) {
      lines.push('');
      continue;
    }
    lines.push(rowToMarkdownLine(row));
  }

  while (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}

function getRuledRow(node: Node | null, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.classList.contains('ruled-row')) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function placeCaretAtStart(row: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(row);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function normalizeRuledRow(row: HTMLElement): void {
  if (isEmptyRuledRow(row)) {
    row.classList.add('ruled-row--empty');
    row.setAttribute('data-empty', '1');
    if (!row.innerHTML.trim()) row.innerHTML = '<br>';
  } else {
    row.classList.remove('ruled-row--empty');
    row.removeAttribute('data-empty');
  }
}

function firstRuledRow(root: HTMLElement): HTMLElement | null {
  return root.querySelector('.ruled-row');
}

function ensureRuledRow(root: HTMLElement): HTMLElement {
  const existing = firstRuledRow(root);
  if (existing) return existing;

  const row = document.createElement('div');
  row.className = 'ruled-row ruled-row--empty';
  row.setAttribute('data-empty', '1');
  row.innerHTML = '<br>';
  root.appendChild(row);
  return row;
}

/** Enter — новая строка блокнота (разделение текущей линии) */
export function insertRuledRowBreak(root: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  let row = getRuledRow(sel.anchorNode, root) ?? ensureRuledRow(root);

  const range = sel.getRangeAt(0);
  const afterRange = range.cloneRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  if (row.lastChild) {
    afterRange.setEndAfter(row.lastChild);
  } else {
    afterRange.setEnd(row, row.childNodes.length);
  }
  const tail = afterRange.extractContents();
  range.deleteContents();

  const newRow = document.createElement('div');
  newRow.className = 'ruled-row';
  if (!tail.textContent?.trim() && !tail.querySelector('*')) {
    newRow.innerHTML = '<br>';
  } else {
    newRow.appendChild(tail);
  }
  normalizeRuledRow(newRow);

  row.insertAdjacentElement('afterend', newRow);
  normalizeRuledRow(row);
  placeCaretAtStart(newRow);
}

/** Shift+Enter — пустая строка между линиями */
export function insertRuledBlankRow(root: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const row = getRuledRow(sel.anchorNode, root) ?? ensureRuledRow(root);
  const blank = document.createElement('div');
  blank.className = 'ruled-row ruled-row--empty';
  blank.setAttribute('data-empty', '1');
  blank.innerHTML = '<br>';
  row.insertAdjacentElement('afterend', blank);
  placeCaretAtStart(blank);
}

/** Enter в заголовке на строке блокнота — новая линия под заголовком */
export function breakOutOfRuledHeadingOnEnter(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  const row = getRuledRow(sel.anchorNode, root);
  if (!row?.classList.contains('ruled-row--heading')) return false;

  const heading = row.querySelector('h1,h2,h3,h4,h5,h6');
  if (!heading) return false;

  const range = sel.getRangeAt(0);
  const afterRange = range.cloneRange();
  if (heading.lastChild) {
    afterRange.setEndAfter(heading.lastChild);
  } else {
    afterRange.setEnd(heading, 0);
  }
  const tail = afterRange.extractContents();

  const newRow = document.createElement('div');
  newRow.className = 'ruled-row';
  if (tail.textContent?.trim() || tail.querySelector('*')) {
    newRow.appendChild(tail);
  } else {
    newRow.innerHTML = '<br>';
  }
  normalizeRuledRow(newRow);

  row.insertAdjacentElement('afterend', newRow);
  placeCaretAtStart(newRow);
  return true;
}

export function insertRuledPlainText(root: HTMLElement, text: string): void {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const lines = normalized.split('\n');
  while (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  if (lines.length === 0) return;

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  sel.getRangeAt(0).deleteContents();

  if (typeof document.execCommand === 'function') {
    document.execCommand('insertText', false, lines[0]);
  }

  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '') {
      insertRuledBlankRow(root);
      continue;
    }
    insertRuledRowBreak(root);
    if (typeof document.execCommand === 'function') {
      document.execCommand('insertText', false, lines[i]);
    }
  }
}

export function getRuledRowForNode(node: Node | null, root: HTMLElement): HTMLElement | null {
  return getRuledRow(node, root);
}

export function focusAfterRuledTitle(root: HTMLElement | null): void {
  if (!root) return;
  root.focus({ preventScroll: true });

  const titleRow = root.querySelector('.ruled-row--heading');
  if (!titleRow) {
    const first = ensureRuledRow(root);
    placeCaretAtStart(first);
    return;
  }

  let next = titleRow.nextElementSibling;
  while (next && !(next instanceof HTMLElement && next.classList.contains('ruled-row'))) {
    next = next.nextElementSibling;
  }

  let target = next instanceof HTMLElement ? next : null;
  if (!target) {
    target = document.createElement('div');
    target.className = 'ruled-row ruled-row--empty';
    target.setAttribute('data-empty', '1');
    target.innerHTML = '<br>';
    titleRow.insertAdjacentElement('afterend', target);
  }

  placeCaretAtStart(target);
}
