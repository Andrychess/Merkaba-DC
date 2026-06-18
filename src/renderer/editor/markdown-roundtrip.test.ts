import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from './markdown-roundtrip';

describe('markdown roundtrip blank lines', () => {
  it('preserves an empty line between paragraphs after preview html', () => {
    const html = '<h1>Title</h1><p>Line one</p><p><br></p><p>Line two</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('Line one');
    expect(md).toContain('Line two');
    expect(md).toMatch(/Line one\n\n\nLine two/);
  });

  it('preserves multiple empty lines', () => {
    const html = '<p>A</p><p><br></p><p><br></p><p>B</p>';
    const md = htmlToMarkdown(html);
    expect(md).toBe('A\n\n\n\nB');
  });

  it('does not lose blank lines when toggling modes on unchanged verse-like body', () => {
    const body = '# Title\n\nStanza one\n\n\nStanza two';
    const html = markdownToHtml(body);
    const back = htmlToMarkdown(html);
    expect(back).toBe(body);
  });
});
