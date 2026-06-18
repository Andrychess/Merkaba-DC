import MarkdownIt from 'markdown-it';
// @ts-expect-error нет типов
import markdownItCheckbox from 'markdown-it-checkbox';
import TurndownService from 'turndown';
// @ts-expect-error нет типов
import { gfm } from 'turndown-plugin-gfm';
import { collectTaskLineIndices } from '@shared/markdown-tasks';
import { substituteWikiLinks } from '@shared/wiki-links';
import { splitFrontmatter, joinFrontmatter } from '@shared/frontmatter';

/** Один Enter = новая строка (важно для стихов и заметок) */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: true,
}).use(markdownItCheckbox);

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
});

turndown.use(gfm);

turndown.addRule('lineBreak', {
  filter: 'br',
  replacement: () => '\n',
});

turndown.addRule('divBlock', {
  filter: (node) => {
    if (node.nodeName !== 'DIV') return false;
    const el = node as HTMLElement;
    return !el.closest('pre') && !el.classList.contains('code-block');
  },
  replacement: (content) => {
    const trimmed = content.trim();
    if (!trimmed) return '\n';
    return `\n\n${trimmed}\n\n`;
  },
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

export { splitFrontmatter, joinFrontmatter };

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'UL',
  'OL',
  'PRE',
  'HR',
  'TABLE',
]);

function isEmptyBlockElement(el: HTMLElement): boolean {
  if (el.getAttribute('data-merkaba-blank') === '1') return true;
  if (!BLOCK_TAGS.has(el.tagName)) return false;
  if (el.closest('pre')) return false;
  const html = el.innerHTML.trim().toLowerCase();
  if (!html || html === '<br>' || html === '<br/>') return true;
  return !(el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
}

function splitBodyPreservingBlankLines(body: string): { text: string; blankLinesBefore: number }[] {
  if (!body.trim()) return [];

  const parts = body.split(/\n{2,}/);
  const gaps = body.match(/\n{2,}/g) ?? [];

  return parts.map((text, index) => ({
    text,
    blankLinesBefore: index === 0 ? 0 : Math.max(0, (gaps[index - 1]?.length ?? 2) - 2),
  }));
}

function annotateTaskItems(html: string, body: string): string {
  const taskLines = collectTaskLineIndices(body);
  if (taskLines.length === 0) return html;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  const items = wrapper.querySelectorAll('li');
  let taskIndex = 0;

  for (const li of items) {
    const hasCheckbox = li.querySelector('input[type="checkbox"]');
    if (!hasCheckbox) continue;
    if (taskLines[taskIndex] !== undefined) {
      li.setAttribute('data-body-line', String(taskLines[taskIndex]));
    }
    taskIndex++;
  }

  return wrapper.innerHTML;
}

function renderMarkdownSegment(text: string): string {
  const withLinks = substituteWikiLinks(text);
  return md.render(withLinks).trim();
}

const BLANK_LINE_PLACEHOLDER = '<span data-merkaba-blank="1"></span>';

function markBlankBlocks(html: string): string {
  const emptyBlock =
    /<(?:p|div)(?:\s[^>]*)?>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/(?:p|div)>/gi;
  return html.replace(emptyBlock, BLANK_LINE_PLACEHOLDER);
}

function turndownBlock(html: string): string {
  return turndown.turndown(html).trim();
}

function joinMarkdownChunks(chunks: string[]): string {
  let result = '';
  let pendingExtraNewlines = 0;

  for (const chunk of chunks) {
    if (chunk === '') {
      pendingExtraNewlines++;
      continue;
    }

    if (result.length > 0) {
      result += '\n\n' + '\n'.repeat(pendingExtraNewlines);
    }
    pendingExtraNewlines = 0;
    result += chunk;
  }

  if (pendingExtraNewlines > 0 && result.length > 0) {
    result += '\n'.repeat(2 + pendingExtraNewlines);
  }

  return result.replace(/[ \t]+\n/g, '\n').replace(/\s+$/, '');
}

/** contenteditable часто даёт div на каждую строку — нормализуем перед turndown */
function htmlBlocksToMarkdown(html: string): string {
  const normalized = markBlankBlocks(html.replace(/\u00a0/g, ' '));

  const wrapper = document.createElement('div');
  wrapper.innerHTML = normalized;

  const chunks: string[] = [];

  for (const child of Array.from(wrapper.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').trim();
      if (text) chunks.push(text);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as HTMLElement;
    if (el.getAttribute('data-merkaba-blank') === '1') {
      chunks.push('');
      continue;
    }

    if (!BLOCK_TAGS.has(el.tagName)) {
      const piece = turndownBlock(el.outerHTML);
      if (piece) chunks.push(piece);
      continue;
    }

    if (isEmptyBlockElement(el)) {
      chunks.push('');
      continue;
    }

    const piece = turndownBlock(el.outerHTML);
    if (piece) chunks.push(piece);
  }

  if (chunks.length === 0) return turndown.turndown(normalized).trim();
  return joinMarkdownChunks(chunks);
}

export function markdownToHtml(body: string): string {
  const segments = splitBodyPreservingBlankLines(body);
  const htmlParts: string[] = [];

  for (const segment of segments) {
    for (let i = 0; i < segment.blankLinesBefore; i++) {
      htmlParts.push(BLANK_LINE_PLACEHOLDER);
    }
    if (segment.text.trim()) {
      htmlParts.push(renderMarkdownSegment(segment.text));
    }
  }

  const html = htmlParts.join('\n');
  return annotateTaskItems(html, body);
}

export function htmlToMarkdown(html: string): string {
  return htmlBlocksToMarkdown(html);
}
