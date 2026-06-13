import type { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';

export function wrapSelection(before: string, after: string = before) {
  return (view: EditorView): boolean => {
    const { state } = view;
    if (!state.selection.main.empty) {
      view.dispatch(
        state.changeByRange((range) => {
          const selected = state.sliceDoc(range.from, range.to);
          const insert = `${before}${selected}${after}`;
          return {
            changes: { from: range.from, to: range.to, insert },
            range: EditorSelection.cursor(range.from + insert.length),
          };
        })
      );
      return true;
    }

    view.dispatch(
      state.changeByRange((range) => {
        const insert = `${before}${after}`;
        return {
          changes: { from: range.from, to: range.to, insert },
          range: EditorSelection.cursor(range.from + before.length),
        };
      })
    );
    return true;
  };
}

export function insertLink(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  const selected = state.sliceDoc(range.from, range.to);
  const label = selected || 'текст';
  const insert = `[${label}](url)`;
  const cursor = selected
    ? range.from + insert.length
    : range.from + label.length + 3;

  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(cursor),
  });
  return true;
}

export function prefixLines(prefix: string) {
  return (view: EditorView): boolean => {
    const { state } = view;
    const changes: { from: number; to: number; insert: string }[] = [];
    const ranges: ReturnType<typeof EditorSelection.cursor>[] = [];

    for (const range of state.selection.ranges) {
      const fromLine = state.doc.lineAt(range.from).number;
      const toLine = state.doc.lineAt(range.to).number;

      for (let lineNum = fromLine; lineNum <= toLine; lineNum++) {
        const line = state.doc.line(lineNum);
        const text = line.text;
        const hasPrefix = text.startsWith(prefix);
        changes.push({
          from: line.from,
          to: line.from + (hasPrefix ? prefix.length : 0),
          insert: hasPrefix ? '' : prefix,
        });
      }

      ranges.push(EditorSelection.cursor(range.head));
    }

    view.dispatch({ changes, selection: EditorSelection.create(ranges) });
    return true;
  };
}

export function toggleHeading(level: number) {
  const prefix = '#'.repeat(level) + ' ';
  return (view: EditorView): boolean => {
    const { state } = view;
    const line = state.doc.lineAt(state.selection.main.from);
    const text = line.text;
    const headingMatch = text.match(/^#{1,6}\s+/);
    let newText: string;

    if (headingMatch && headingMatch[0].trim().length === level) {
      newText = text.slice(headingMatch[0].length);
    } else if (headingMatch) {
      newText = prefix + text.slice(headingMatch[0].length);
    } else {
      newText = prefix + text;
    }

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: newText },
      selection: EditorSelection.cursor(line.from + newText.length),
    });
    return true;
  };
}
