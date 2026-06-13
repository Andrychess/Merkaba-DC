/** Поиск в contenteditable (режим «Просмотр») через API Chromium */
export function findInEditable(
  query: string,
  options?: { backwards?: boolean; wrap?: boolean }
): boolean {
  if (!query.trim()) return false;
  return window.find(query, false, options?.backwards ?? false, options?.wrap ?? true, false, false, false);
}

export function replaceSelectionInEditable(replacement: string): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;

  const range = sel.getRangeAt(0);
  range.deleteContents();
  const text = document.createTextNode(replacement);
  range.insertNode(text);
  range.setStartAfter(text);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}
