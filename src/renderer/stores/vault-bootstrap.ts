import type { Config, ConflictFile, FileNode } from '@shared/types';
import { resolveActiveSpace } from '@shared/spaces';

export interface VaultBootstrapData {
  config: Config;
  fileTree: FileNode[];
  archiveTree: FileNode[];
  pinnedNotes: string[];
  conflicts: ConflictFile[];
}

export async function fetchVaultBootstrap(rootPath: string): Promise<VaultBootstrapData> {
  const config = await window.merkaba.getConfig();
  const fastScan = { withMeta: false } as const;
  const [fileTree, archiveTree, pinnedNotes, conflicts] = await Promise.all([
    window.merkaba.getFileTree(fastScan),
    window.merkaba.getArchiveTree(fastScan),
    window.merkaba.getPinnedNotes(),
    window.merkaba.getConflicts(),
  ]);

  return {
    config: { ...config, rootPath, syncMode: 'cloud' },
    fileTree,
    archiveTree,
    pinnedNotes,
    conflicts,
  };
}

export function vaultStateFromBootstrap(
  data: VaultBootstrapData,
  statusMessage: string,
  options?: { showConflicts?: boolean }
) {
  const space = resolveActiveSpace(data.fileTree);
  return {
    initialized: true as const,
    config: data.config,
    fileTree: data.fileTree,
    archiveTree: data.archiveTree,
    pinnedNotes: data.pinnedNotes,
    conflicts: data.conflicts,
    showConflicts: options?.showConflicts ?? data.conflicts.length > 0,
    activeSpace: space,
    selectedFolder: space,
    statusMessage,
  };
}
