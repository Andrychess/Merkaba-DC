import { describe, expect, it } from 'vitest';
import { isFormControlElement, isTypingTarget } from './focus';

describe('isFormControlElement', () => {
  it('detects input elements', () => {
    const input = document.createElement('input');
    input.type = 'range';
    expect(isFormControlElement(input)).toBe(true);
  });

  it('detects elements inside label wrapping input', () => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    label.appendChild(input);
    expect(isFormControlElement(label)).toBe(true);
  });

  it('returns false for plain buttons', () => {
    const button = document.createElement('button');
    expect(isFormControlElement(button)).toBe(false);
  });

  it('detects contenteditable elements', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    expect(isFormControlElement(editor)).toBe(true);
    expect(isTypingTarget(editor)).toBe(true);
  });
});

describe('isTypingTarget', () => {
  it('matches form controls', () => {
    const textarea = document.createElement('textarea');
    expect(isTypingTarget(textarea)).toBe(true);
  });
});
