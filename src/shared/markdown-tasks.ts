/** GFM task list line: `- [ ]`, `* [x]`, `+ [ ]` with optional text */
export const TASK_LINE_RE = /^(\s*[-*+]\s*\[)([ xX])(\])(.*)$/;

export function isTaskLine(line: string): boolean {
  return TASK_LINE_RE.test(line);
}

export function collectTaskLineIndices(body: string): number[] {
  const lines = body.split('\n');
  const indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isTaskLine(lines[i])) indices.push(i);
  }
  return indices;
}

export function toggleTaskLine(body: string, bodyLine: number): string | null {
  const lines = body.split('\n');
  if (bodyLine < 0 || bodyLine >= lines.length) return null;

  const match = lines[bodyLine].match(TASK_LINE_RE);
  if (!match) return null;

  const newState = match[2].toLowerCase() === 'x' ? ' ' : 'x';
  lines[bodyLine] = `${match[1]}${newState}${match[3]}${match[4]}`;
  return lines.join('\n');
}
