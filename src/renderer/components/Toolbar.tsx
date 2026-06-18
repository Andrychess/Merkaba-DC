import { keepEditorFocus } from '@renderer/utils/focus';

interface ToolbarProps {
  mode: 'source' | 'preview';
  onInsert: (before: string, after: string, action?: string) => void;
  onFormat?: (action: string) => void;
}

const groups = [
  [
    { action: 'bold', icon: 'B', title: 'Жирный (Ctrl+B)', before: '**', after: '**', bold: true },
    { action: 'italic', icon: 'I', title: 'Курсив (Ctrl+I)', before: '*', after: '*', italic: true },
  ],
  [
    { action: 'alignLeft', icon: '⫷', title: 'По левому краю (режим просмотра)', formatOnly: true },
    { action: 'alignCenter', icon: '≡', title: 'По центру (режим просмотра)', formatOnly: true },
    { action: 'alignRight', icon: '⫸', title: 'По правому краю (режим просмотра)', formatOnly: true },
    { action: 'alignJustify', icon: '▥', title: 'По ширине (режим просмотра)', formatOnly: true },
  ],
  [
    { action: 'heading1', icon: 'H1', title: 'Заголовок 1 (Ctrl+Alt+1)', before: '# ', after: '' },
    { action: 'heading2', icon: 'H2', title: 'Заголовок 2 (Ctrl+Alt+2)', before: '## ', after: '' },
    { action: 'heading3', icon: 'H3', title: 'Заголовок 3 (Ctrl+Alt+3)', before: '### ', after: '' },
  ],
  [
    { action: 'list', icon: '•', title: 'Список (Ctrl+Shift+8)', before: '- ', after: '' },
    { action: 'ordered', icon: '1.', title: 'Нумерованный (Ctrl+Shift+7)', before: '1. ', after: '' },
    { action: 'checkbox', icon: '☐', title: 'Чекбокс (Ctrl+Shift+9)', before: '- [ ] ', after: '' },
  ],
  [
    { action: 'link', icon: '🔗', title: 'Ссылка (Ctrl+K)', before: '[', after: '](url)' },
    { action: 'code', icon: '</>', title: 'Код (Ctrl+`)', before: '`', after: '`' },
    { action: 'quote', icon: '❝', title: 'Цитата (Ctrl+Shift+.)', before: '> ', after: '' },
  ],
];

export function Toolbar({ mode, onInsert, onFormat }: ToolbarProps) {
  const handleClick = (
    action: string,
    before: string,
    after: string,
    formatOnly?: boolean
  ) => {
    if (formatOnly) {
      if (mode === 'preview' && onFormat) {
        onFormat(action);
      }
      return;
    }
    if (mode === 'preview' && onFormat) {
      onFormat(action);
      return;
    }
    onInsert(before, after, action);
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <div className="w-px h-5 bg-merkaba-border mx-1" />}
          {group.map((tool) => (
            <button
              key={tool.action}
              type="button"
              onMouseDown={mode === 'preview' ? keepEditorFocus : undefined}
              onClick={() =>
                handleClick(
                  tool.action,
                  'before' in tool ? tool.before : '',
                  'after' in tool ? tool.after : '',
                  'formatOnly' in tool ? tool.formatOnly : false
                )
              }
              title={tool.title}
              className={`w-7 h-7 flex items-center justify-center rounded-md text-xs
                         text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover
                         transition-all duration-100 font-mono shrink-0
                         ${'bold' in tool && tool.bold ? 'font-bold' : ''}
                         ${'italic' in tool && tool.italic ? 'italic' : ''}`}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
