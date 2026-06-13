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

/** contenteditable часто даёт div на каждую строку — нормализуем перед turndown */
function prepareEditableHtml(html: string): string {
  const normalized = html.replace(/\u00a0/g, ' ');

  const wrapper = document.createElement('div');
  wrapper.innerHTML = normalized;

  const blockTags = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'PRE', 'HR', 'TABLE']);

  const parts: string[] = [];
  for (const child of Array.from(wrapper.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text.trim()) parts.push(text);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as HTMLElement;
    if (blockTags.has(el.tagName)) {
      parts.push(el.outerHTML);
    } else {
      parts.push(el.outerHTML);
    }
  }

  if (parts.length === 0) return normalized;
  return parts.join('\n');
}

export function markdownToHtml(body: string): string {
  const withLinks = substituteWikiLinks(body);
  const html = md.render(withLinks);
  return annotateTaskItems(html, body);
}

export function htmlToMarkdown(html: string): string {
  const prepared = prepareEditableHtml(html);
  const markdown = turndown.turndown(prepared);
  return markdown
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\s+$/, '');
}
