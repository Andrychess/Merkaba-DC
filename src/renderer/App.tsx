import { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Editor } from './components/Editor';
import { StatusBar } from './components/StatusBar';
import { GraphView } from './components/GraphView';
import { CorkBoard } from './components/CorkBoard';
import { ConflictDialog } from './components/ConflictDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { useHotkeys } from './hooks/useHotkeys';
import { useAutoSave } from './hooks/useAutoSave';
import { useTheme } from './hooks/useTheme';
import { LogoMark, LogoIcon, IconSettings, IconCloud } from './components/Icons';
import { SyncButton } from './components/SyncButton';
import { WindowControls } from './components/WindowControls';

export default function App() {
  const initialized = useAppStore((s) => s.initialized);
  const sidebarMode = useAppStore((s) => s.sidebarMode);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const refreshFileTree = useAppStore((s) => s.refreshFileTree);
  const loadConflicts = useAppStore((s) => s.loadConflicts);
  const restoreSession = useAppStore((s) => s.restoreSession);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const statusMessage = useAppStore((s) => s.statusMessage);
  const [checking, setChecking] = useState(true);

  useHotkeys();
  useAutoSave();
  useTheme();

  useEffect(() => {
    restoreSession().finally(() => setChecking(false));
    window.merkaba.onStatus((message) => setStatusMessage(message));
  }, [restoreSession, setStatusMessage]);

  useEffect(() => {
    if (!initialized) return;

    refreshFileTree();

    let treeTimer: ReturnType<typeof setTimeout> | null = null;
    const TREE_REFRESH_MS = 1200;

    const scheduleTreeRefresh = () => {
      if (treeTimer) clearTimeout(treeTimer);
      treeTimer = setTimeout(() => {
        treeTimer = null;
        refreshFileTree();
        loadConflicts();
      }, TREE_REFRESH_MS);
    };

    const unwatch = window.merkaba.watchFolder((event, filePath) => {
      if (filePath.includes('stickers.json')) {
        useAppStore.getState().bumpStickers();
      }
      scheduleTreeRefresh();
    });

    return () => {
      if (treeTimer) clearTimeout(treeTimer);
      unwatch();
    };
  }, [initialized, refreshFileTree, loadConflicts]);

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center bg-merkaba-bg app-drag-region">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <LogoIcon className="w-14 h-14 shadow-glow" />
          <div className="w-6 h-6 border-2 border-merkaba-accent/30 border-t-merkaba-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!initialized) {
    return <WelcomeScreen />;
  }

  return (
    <div className="flex flex-col h-full bg-merkaba-bg">
      <header className="h-11 flex items-center px-4 bg-merkaba-sidebar/80 backdrop-blur-md border-b border-merkaba-border shrink-0 app-drag-region">
        <div className="flex items-center gap-2.5 app-no-drag">
          <LogoMark className="w-5 h-5" />
          <span className="text-sm font-semibold tracking-tight text-merkaba-text">Merkaba</span>
        </div>

        <div className="ml-4 flex items-center app-no-drag">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-merkaba-elevated border border-merkaba-border">
            <IconCloud className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-merkaba-muted">Яндекс.Диск</span>
          </div>
          <SyncButton />
        </div>

        {statusMessage && (
          <span className="ml-3 text-xs text-merkaba-muted truncate max-w-[200px] hidden sm:block">
            {statusMessage}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1 app-no-drag">
          <button
            onClick={() => setShowSettings(true)}
            className="btn-ghost !p-2"
            title="Настройки"
          >
            <IconSettings className="w-4 h-4" />
          </button>
          <WindowControls />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {sidebarMode !== 'graph' && <Sidebar />}

        <main className="flex-1 flex flex-col min-h-0 bg-merkaba-bg">
          {sidebarMode === 'graph' ? (
            <GraphView />
          ) : sidebarMode === 'board' ? (
            <CorkBoard />
          ) : (
            <>
              <TabBar />
              <Editor />
            </>
          )}
        </main>
      </div>

      <StatusBar />
      <ConflictDialog />
      <SettingsDialog />
    </div>
  );
}
