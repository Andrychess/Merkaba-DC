export function WindowControls() {
  return (
    <div className="app-no-drag flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={() => window.merkaba.minimizeWindow()}
        title="Свернуть"
        className="w-9 h-8 flex items-center justify-center rounded-md text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 6h8" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => window.merkaba.maximizeWindow()}
        title="Развернуть"
        className="w-9 h-8 flex items-center justify-center rounded-md text-merkaba-muted hover:text-merkaba-text hover:bg-merkaba-hover transition-colors"
      >
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="8" height="8" rx="1" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => window.merkaba.closeWindow()}
        title="Закрыть"
        className="w-9 h-8 flex items-center justify-center rounded-md text-merkaba-muted hover:text-white hover:bg-red-500/80 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3l6 6M9 3L3 9" />
        </svg>
      </button>
    </div>
  );
}
