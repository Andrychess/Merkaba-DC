import { useState } from 'react';
import type { FileNode } from '@shared/types';
import { formatSpaceDisplay } from '@shared/spaces';
import { useAppStore } from '../stores/appStore';
import { IconFolder, IconChevron } from './Icons';
import { NoteTypeIcon } from './NoteTypeIcon';
import { ContextMenu } from './ContextMenu';
import { getNoteColorHex } from '@shared/note-colors';

interface ArchiveTreeItemProps {
  node: FileNode;
  depth: number;
}

function ArchiveTreeItem({ node, depth }: ArchiveTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const openFile = useAppStore((s) => s.openFile);
  const activeFile = useAppStore((s) => s.activeFile);
  const moveItem = useAppStore((s) => s.moveItem);
  const refreshArchiveTree = useAppStore((s) => s.refreshArchiveTree);
  const activeSpace = useAppStore((s) => s.activeSpace);
  const spaceSymbols = useAppStore((s) => s.spaceSymbols);
  const enrichFileTree = useAppStore((s) => s.enrichFileTree);

  const isActive = node.type === 'file' && node.path === activeFile;
  const colorHex = node.type === 'file' ? getNoteColorHex(node.color) : null;

  const handleClick = () => {
    if (node.type === 'folder') {
      setExpanded(!expanded);
    } else {
      openFile(node.path);
    }
  };

  const handleRestore = async (target: string) => {
    await moveItem(node.path, target);
    await refreshArchiveTree();
    await enrichFileTree();
    setContextMenu(null);
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <div>
      <div
        className={`group flex items-center gap-2 mx-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-all duration-100 relative ${
          isActive
            ? 'bg-merkaba-accent-soft text-merkaba-text'
            : 'text-merkaba-muted hover:bg-merkaba-hover hover:text-merkaba-text'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {(isActive || colorHex) && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
            style={{ backgroundColor: colorHex ?? '#f43f5e' }}
          />
        )}

        {node.type === 'folder' ? (
          <>
            <IconChevron expanded={expanded} className="w-3 h-3 shrink-0 opacity-60" />
            <IconFolder className="w-4 h-4 shrink-0 text-merkaba-muted" />
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <NoteTypeIcon
              noteType={node.noteType}
              colorId={node.color}
              active={isActive}
            />
          </>
        )}

        <span className="truncate flex-1">{node.name}</span>
      </div>

      <ContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={closeContextMenu}
        minWidth={200}
      >
        <button
          className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            void handleRestore(activeSpace);
          }}
        >
          Восстановить в «{formatSpaceDisplay(activeSpace, spaceSymbols)}»
        </button>
        <button
          className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            void handleRestore('notes');
          }}
        >
          Восстановить в notes
        </button>
      </ContextMenu>

      {node.type === 'folder' &&
        expanded &&
        node.children?.map((child) => (
          <ArchiveTreeItem key={child.path} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

export function ArchivePanel() {
  const archiveTree = useAppStore((s) => s.archiveTree);
  const clearArchive = useAppStore((s) => s.clearArchive);
  const [clearing, setClearing] = useState(false);

  const hasItems = archiveTree.length > 0;

  const handleClear = async () => {
    if (!hasItems || clearing) return;
    const ok = confirm(
      'Очистить архив безвозвратно?\n\nВсе удалённые заметки и папки будут уничтожены. Восстановить их будет невозможно.'
    );
    if (!ok) return;

    setClearing(true);
    try {
      await clearArchive();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-merkaba-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-merkaba-muted leading-relaxed">
            Удалённые заметки и папки. ПКМ — восстановить.
          </p>
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasItems || clearing}
            title="Удалить все элементы архива безвозвратно"
            className="btn-ghost !text-xs !py-1.5 shrink-0 text-merkaba-muted hover:text-merkaba-accent disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
          >
            {clearing ? 'Очистка...' : 'Очистить архив'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {archiveTree.length === 0 ? (
          <p className="text-merkaba-muted text-sm px-4 py-8 text-center">Архив пуст</p>
        ) : (
          archiveTree.map((node) => (
            <ArchiveTreeItem key={node.path} node={node} depth={0} />
          ))
        )}
      </div>
    </div>
  );
}
