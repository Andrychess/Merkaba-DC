import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import { Markdown } from '@tiptap/markdown';

export function createTiptapExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
      defaultAlignment: 'left',
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        class: 'tiptap-link',
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Markdown.configure({
      indentation: {
        style: 'space',
        size: 2,
      },
      markedOptions: {
        gfm: true,
        breaks: true,
      },
    }),
  ];
}
