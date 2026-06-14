import type { NoteType } from './note-types';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  color?: string | null;
  noteType?: NoteType;
  /** Заголовок заметки (может отличаться от имени файла до синхронизации) */
  title?: string;
  /** Краткий фрагмент текста для списка */
  preview?: string;
  children?: FileNode[];
}

/** Параметры сканирования дерева файлов */
export interface TreeScanOptions {
  /** Читать frontmatter для заголовков и превью (медленнее) */
  withMeta?: boolean;
}

export interface NoteMeta {
  title: string | null;
  created: string | null;
  modified: string | null;
  color: string | null;
  tags: string[];
  noteType: NoteType;
}

export interface OpenFile {
  path: string;
  content: string;
  body: string;
  meta: NoteMeta;
  isDirty: boolean;
  color: string | null;
}

export interface SearchResult {
  path: string;
  title: string;
  matches?: readonly FuseMatch[];
}

export interface FuseMatch {
  indices: readonly [number, number][];
  key?: string;
  value?: string;
}

export interface Sticker {
  id: string;
  title: string;
  content: string;
  color: number;
  rotation: number;
  pinX: number;
  x: number;
  y: number;
  created: string;
  modified: string;
  /** Путь к связанной заметке */
  linkedNotePath?: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  links: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ConflictFile {
  mainPath: string;
  conflictPath: string;
  mainContent: string;
  conflictContent: string;
}

import type { ThemeId } from './themes';
import { DEFAULT_THEME } from './themes';

export interface Config {
  rootPath: string;
  fontSize: number;
  fontFamily: string;
  theme: ThemeId;
  autoSaveInterval: number;
  showFrontmatter: 'always' | 'source-only';
  language: 'ru' | 'en';
  syncMode: 'cloud' | 'local';
  /** Автоматическая синхронизация с облаком (по умолчанию — только вручную) */
  autoSync: boolean;
}

export const defaultConfig: Config = {
  rootPath: '',
  fontSize: 14,
  fontFamily: 'JetBrains Mono',
  theme: DEFAULT_THEME,
  autoSaveInterval: 3000,
  showFrontmatter: 'source-only',
  language: 'ru',
  syncMode: 'cloud',
  autoSync: false,
};
