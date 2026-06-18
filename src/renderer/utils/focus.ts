import type { MouseEvent as ReactMouseEvent } from 'react';

/** Поле ввода, слайдер или другой интерактивный контрол формы. */
export function isFormControlElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.matches('input, select, textarea')) return true;
  if (target.isContentEditable) return true;
  const label = target.closest('label');
  if (label?.querySelector('input, select, textarea')) return true;
  return false;
}

/** Пользователь редактирует текст — глобальные горячие клавиши не должны срабатывать. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return isFormControlElement(target);
}

/**
 * На панели инструментов: кнопки не забирают фокус у редактора,
 * но слайдеры и поля ввода работают как обычно.
 */
export function keepEditorFocus(e: ReactMouseEvent): void {
  if (isFormControlElement(e.target)) return;
  e.preventDefault();
}
