import { describe, expect, it } from 'vitest';
import { bodyToRuledHtml, ruledHtmlToBody } from './ruled-lines';

describe('ruled lines', () => {
  it('renders one ruled row per source line', () => {
    const html = bodyToRuledHtml('Line one\nLine two');
    expect(html.match(/class="ruled-row/g)?.length).toBe(2);
  });

  it('preserves blank lines', () => {
    const body = 'A\n\nB';
    const back = ruledHtmlToBody(bodyToRuledHtml(body));
    expect(back).toBe(body);
  });

  it('roundtrips verse-like text', () => {
    const body = '# Title\n\nStanza one\n\n\nStanza two';
    const back = ruledHtmlToBody(bodyToRuledHtml(body));
    expect(back).toBe(body);
  });

  it('roundtrips inline formatting', () => {
    const body = '**bold** and *italic*';
    const back = ruledHtmlToBody(bodyToRuledHtml(body));
    expect(back).toBe(body);
  });
});
