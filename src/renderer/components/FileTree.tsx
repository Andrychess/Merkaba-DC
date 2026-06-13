import { useEffect, useRef, useState } from 'react';
import type { FileNode } from '@shared/types';
import { getNoteColorHex } from '@shared/note-colors';
import { ROOT_DROP_ID } from '@shared/archive';
import { isArchivePath } from '@shared/archive';
import { formatSpaceDisplay, getSpaceChildren } from '@shared/spaces';
import { getNoteDisplayTitle, getNotePreview } from '@shared/note-heading';
import { useAppStore } from '../stores/appStore';
import { IconFolder, IconChevron, IconPlus, IconSearch, IconComposeNote, IconX } from './Icons';
import { NoteTypeIcon } from './NoteTypeIcon';
import { NoteColorPicker } from './NoteColorPicker';
import { SpaceSwitcher } from './SpaceSwitcher';
import { NoteCreateMenu } from './NoteCreateMenu';

const DRAG_PATH = 'application/x-merkaba-path';
const DRAG_TYPE = 'application/x-merkaba-type';

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  dragOverPath: string | null;
  onDragOverPath: (path: string | null) => void;
}

function FileTreeItem({ node, depth, dragOverPath, onDragOverPath }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(node.title || node.name);
  const openFileEntry = useAppStore((s) => s.openFiles.find((f) => f.path === node.path));
  const openFile = useAppStore((s) => s.openFile);
  const activeFile = useAppStore((s) => s.activeFile);
  const selectedFolder = useAppStore((s) => s.selectedFolder);
  const setSelectedFolder = useAppStore((s) => s.setSelectedFolder);
  const deleteFile = useAppStore((s) => s.deleteFile);
  const deleteFolder = useAppStore((s) => s.deleteFolder);
  const renameFile = useAppStore((s) => s.renameFile);
  const renameFolder = useAppStore((s) => s.renameFolder);
  const moveItem = useAppStore((s) => s.moveItem);
  const createNewNote = useAppStore((s) => s.createNewNote);
  const createNewFolder = useAppStore((s) => s.createNewFolder);
  const pinnedNotes = useAppStore((s) => s.pinnedNotes);
  const pinNote = useAppStore((s) => s.pinNote);
  const unpinNote = useAppStore((s) => s.unpinNote);
  const setNoteColor = useAppStore((s) => s.setNoteColor);
  const activeSpace = useAppStore((s) => s.activeSpace);

  const isActive = node.type === 'file' && node.path === activeFile;
  const isSelectedFolder = node.type === 'folder' && node.path === selectedFolder;
  const isDragOver = node.type === 'folder' && dragOverPath === node.path;
  const canMoveToRoot = node.path.includes('/') && node.path !== activeSpace;
  const isPinned = node.type === 'file' && pinnedNotes.includes(node.path);
  const colorHex = node.type === 'file' ? getNoteColorHex(node.color) : null;
  const noteType = openFileEntry?.meta.noteType ?? node.noteType ?? 'text';
  const displayTitle = openFileEntry
    ? getNoteDisplayTitle(openFileEntry.meta.title, openFileEntry.body, node.path)
    : (node.title || node.name);
  const displayPreview = openFileEntry
    ? getNotePreview(openFileEntry.body, noteType)
    : (node.preview ?? '');

  const handleClick = () => {
    if (node.type === 'folder') {
      setSelectedFolder(node.path);
      setExpanded(!expanded);
    } else {
      const parent = node.path.includes('/')
        ? node.path.slice(0, node.path.lastIndexOf('/'))
        : activeSpace;
      setSelectedFolder(parent);
      openFile(node.path);
    }
  };

  const canRenameFolder =
    node.type === 'folder' && !isArchivePath(node.path) && node.path !== 'attachments';

  const handleRename = async () => {
    if (newName && newName !== displayTitle) {
      if (node.type === 'folder') {
        await renameFolder(node.path, newName);
      } else {
        await renameFile(node.path, newName);
      }
    }
    setRenaming(false);
  };

  const handleArchiveFolder = async () => {
    if (!confirm(`Переместить папку «${node.name}» в архив?`)) return;
    await deleteFolder(node.path);
    setShowMenu(false);
  };

  const handleArchiveFile = async () => {
    if (!confirm(`Переместить заметку «${displayTitle}» в архив?`)) return;
    await deleteFile(node.path);
    setShowMenu(false);
  };

  const handleMoveToRoot = async () => {
    await moveItem(node.path, activeSpace);
    setShowMenu(false);
  };

  const handlePinToggle = async () => {
    if (isPinned) {
      await unpinNote(node.path);
    } else {
      await pinNote(node.path);
    }
    setShowMenu(false);
  };

  const handleColorChange = async (colorId: string | null) => {
    await setNoteColor(node.path, colorId);
    setShowMenu(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_PATH, node.path);
    e.dataTransfer.setData(DRAG_TYPE, node.type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (node.type !== 'folder') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOverPath(node.path);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    onDragOverPath(null);
    const fromPath = e.dataTransfer.getData(DRAG_PATH);
    if (!fromPath || fromPath === node.path) return;
    await moveItem(fromPath, node.path);
    setExpanded(true);
  };

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => node.type === 'folder' && onDragOverPath(null)}
        onDrop={handleDrop}
        className={`group flex items-stretch mx-2 rounded-lg cursor-pointer text-sm transition-all duration-100 relative overflow-hidden ${
          node.type === 'file' ? (noteType === 'text' ? 'min-h-[58px]' : 'min-h-[44px]') : ''
        } ${
          isActive
            ? 'bg-merkaba-accent-soft text-merkaba-text'
            : isSelectedFolder
              ? 'bg-merkaba-hover text-merkaba-text ring-1 ring-merkaba-border-strong'
              : isDragOver
                ? 'bg-merkaba-accent/20 text-merkaba-text ring-1 ring-merkaba-accent/40'
                : 'text-merkaba-muted hover:bg-merkaba-hover hover:text-merkaba-text'
        }`}
        style={{ paddingLeft: node.type === 'folder' ? `${depth * 14 + 8}px` : `${depth * 14 + 4}px` }}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
      >
        {(isActive || colorHex) && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
            style={{ backgroundColor: colorHex ?? '#f43f5e' }}
          />
        )}

        {node.type === 'folder' ? (
          <div className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5">
            <IconChevron expanded={expanded} className="w-3 h-3 shrink-0 opacity-60" />
            <IconFolder className="w-4 h-4 shrink-0 text-amber-400/80" />
            {renaming ? (
              <input
                className="flex-1 bg-merkaba-bg border border-merkaba-accent/40 rounded-md px-2 py-0.5 text-sm outline-none"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate flex-1 py-0.5">{node.name}</span>
            )}
          </div>
        ) : renaming ? (
          <div className="flex-1 flex items-center px-3 py-2">
            <input
              className="w-full bg-merkaba-bg border border-merkaba-accent/40 rounded-md px-2 py-1 text-sm outline-none"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <>
            <div className="w-11 shrink-0 flex items-center justify-center self-stretch">
              <NoteTypeIcon
                noteType={noteType}
                colorId={node.color}
                active={isActive}
                className="w-5 h-5"
              />
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 px-3 py-2">
              <div className="font-semibold text-sm text-merkaba-text truncate leading-tight">
                {displayTitle}
              </div>
              {noteType === 'text' && (
                <div className="text-[11px] leading-snug text-merkaba-muted line-clamp-2">
                  {displayPreview || 'Нет текста'}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleArchiveFile();
              }}
              title="В архив"
              className="w-10 shrink-0 flex items-center justify-center self-stretch text-merkaba-muted hover:text-red-400 hover:bg-merkaba-hover/80 transition-colors"
            >
              <IconX className="w-4 h-4" />
            </button>
          </>
        )}

        {showMenu && (
          <div
            className="absolute right-0 top-full z-50 bg-merkaba-elevated border border-merkaba-border-strong rounded-xl shadow-panel py-1.5 min-w-[210px] animate-fade-in"
            onMouseLeave={() => setShowMenu(false)}
          >
            {node.type === 'file' && (
              <>
                <NoteColorPicker
                  value={node.color ?? null}
                  onChange={handleColorChange}
                />
                <button
                  className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm transition-colors"
                  onClick={(e) => { e.stopPropagation(); setRenaming(true); setShowMenu(false); }}
                >
                  Переименовать
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm transition-colors"
                  onClick={(e) => { e.stopPropagation(); handlePinToggle(); }}
                >
                  {isPinned ? 'Открепить' : 'Закрепить'}
                </button>
                {canMoveToRoot && (
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleMoveToRoot(); }}
                  >
                    Переместить в корень
                  </button>
                )}
                <button
                  className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm text-red-400 transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleArchiveFile(); }}
                >
                  В архив
                </button>
              </>
            )}
            {node.type === 'folder' && (
              <>
                {canRenameFolder && (
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenaming(true);
                      setShowMenu(false);
                    }}
                  >
                    Переименовать
                  </button>
                )}
                <button
                  className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm transition-colors"
                  onClick={(e) => { e.stopPropagation(); createNewNote(node.path); setShowMenu(false); }}
                >
                  Новая заметка
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm transition-colors"
                  onClick={(e) => { e.stopPropagation(); createNewFolder(node.path); setShowMenu(false); }}
                >
                  Новая подпапка
                </button>
                {canMoveToRoot && (
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleMoveToRoot(); }}
                  >
                    Переместить в корень
                  </button>
                )}
                <button
                  className="w-full text-left px-3 py-2 hover:bg-merkaba-hover text-sm text-red-400 transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleArchiveFolder(); }}
                >
                  В архив
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {node.type === 'folder' && expanded && node.children?.map((child) => (
        <FileTreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          dragOverPath={dragOverPath}
          onDragOverPath={onDragOverPath}
        />
      ))}
    </div>
  );
}

export function FileTree() {
  const fileTree = useAppStore((s) => s.fileTree);
  const activeSpace = useAppStore((s) => s.activeSpace);
  const spaceSymbols = useAppStore((s) => s.spaceSymbols);
  const selectedFolder = useAppStore((s) => s.selectedFolder);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const searchResults = useAppStore((s) => s.searchResults);
  const search = useAppStore((s) => s.search);
  const openFile = useAppStore((s) => s.openFile);
  const fileSearchFocusToken = useAppStore((s) => s.fileSearchFocusToken);
  const createNewNote = useAppStore((s) => s.createNewNote);
  const createNewFolder = useAppStore((s) => s.createNewFolder);
  const moveItem = useAppStore((s) => s.moveItem);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [searchPending, setSearchPending] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const folderLabel = selectedFolder === activeSpace
    ? formatSpaceDisplay(activeSpace, spaceSymbols)
    : selectedFolder.replace(`${activeSpace}/`, '');
  const isSearching = localQuery.trim().length > 0;
  const spaceChildren = getSpaceChildren(fileTree, activeSpace);

  useEffect(() => {
    if (!localQuery.trim()) {
      setSearchPending(false);
      search('');
      return;
    }
    setSearchPending(true);
    const timer = setTimeout(() => {
      search(localQuery).finally(() => setSearchPending(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 120);
    return () => clearTimeout(timer);
  }, [fileSearchFocusToken]);

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPath(ROOT_DROP_ID);
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPath(null);
    const fromPath = e.dataTransfer.getData(DRAG_PATH);
    if (!fromPath) return;
    await moveItem(fromPath, activeSpace);
  };

  return (
    <div className="flex flex-col h-full">
      <SpaceSwitcher fileTree={fileTree} />

      <div className="p-3 border-b border-merkaba-border shrink-0">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-merkaba-muted pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Поиск по заметкам... (Ctrl+Shift+F)"
            className="input-field !pl-10 !py-2 !rounded-xl"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {isSearching ? (
          <div className="px-2">
            {searchPending && (
              <p className="text-merkaba-muted text-sm px-3 py-8 text-center">Поиск...</p>
            )}
            {!searchPending && searchResults.length === 0 && (
              <p className="text-merkaba-muted text-sm px-3 py-8 text-center">Ничего не найдено</p>
            )}
            {searchResults.map((result) => (
              <button
                key={result.path}
                onClick={() => openFile(result.path)}
                className="w-full text-left px-3 py-2.5 mb-1 rounded-xl hover:bg-merkaba-hover transition-colors"
              >
                <div className="font-medium text-sm text-merkaba-text truncate">{result.title}</div>
                <div className="text-xs text-merkaba-muted truncate mt-0.5">{result.path}</div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div
              onDragOver={handleRootDragOver}
              onDragLeave={() => setDragOverPath(null)}
              onDrop={handleRootDrop}
              className={`mx-2 mb-2 px-3 py-2 rounded-lg border border-dashed text-xs transition-colors flex items-center gap-2 ${
                dragOverPath === ROOT_DROP_ID
                  ? 'border-merkaba-accent bg-merkaba-accent-soft text-merkaba-text'
                  : 'border-merkaba-border text-merkaba-muted'
              }`}
            >
              <span className="flex-1 min-w-0 leading-relaxed">
                Корень «{formatSpaceDisplay(activeSpace, spaceSymbols)}» — перетащите сюда
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  createNewNote(undefined, 'text');
                }}
                title="Новая текстовая заметка"
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover transition-colors"
              >
                <IconComposeNote className="w-4 h-4" />
              </button>
            </div>

            {spaceChildren.length === 0 ? (
              <p className="text-merkaba-muted text-sm px-4 py-6 text-center">
                В пространстве пока пусто
              </p>
            ) : (
              spaceChildren.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  dragOverPath={dragOverPath}
                  onDragOverPath={setDragOverPath}
                />
              ))
            )}
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t border-merkaba-border">
        <p className="text-[10px] text-merkaba-muted mb-2 truncate">
          Создание в: <span className="text-merkaba-text">{folderLabel}</span>
        </p>
        <div className="flex gap-2">
          <NoteCreateMenu
            onCreate={(type) => createNewNote(undefined, type)}
            className="btn-primary flex-1 !py-2 !text-xs"
            label="Заметка"
            placement="top"
          />
          <button
            onClick={() => createNewFolder()}
            className="btn-secondary flex-1"
          >
            <IconPlus className="w-3.5 h-3.5" />
            Папка
          </button>
        </div>
      </div>
    </div>
  );
}
