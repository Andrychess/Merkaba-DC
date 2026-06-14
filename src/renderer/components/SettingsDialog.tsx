import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { IconCloud } from './Icons';
import { ThemePicker } from './ThemePicker';
import { applyTheme } from '../lib/applyTheme';
export function SettingsDialog() {
  const showSettings = useAppStore((s) => s.showSettings);
  const setShowSettings = useAppStore((s) => s.setShowSettings);
  const config = useAppStore((s) => s.config);
  const setConfig = useAppStore((s) => s.setConfig);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);
  const syncPull = useAppStore((s) => s.syncPull);

  const [local, setLocal] = useState(config);
  const [authLogin, setAuthLogin] = useState('');

  useEffect(() => {
    if (showSettings) {
      setLocal(config);
      window.merkaba.getAuthStatus().then((a) => setAuthLogin(a.login || ''));
    }
  }, [showSettings, config]);

  useEffect(() => {
    if (!showSettings) return;
    applyTheme(local.theme);
  }, [showSettings, local.theme]);

  if (!showSettings) return null;

  const handleLogout = async () => {
    await window.merkaba.logout();
    setShowSettings(false);
    window.location.reload();
  };

  const handleSave = async () => {
    const updated = await window.merkaba.setConfig(local);
    setConfig(updated);
    setShowSettings(false);
    setStatusMessage('Настройки сохранены');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-merkaba-sidebar border border-merkaba-border-strong rounded-2xl max-w-md w-full mx-4 shadow-panel">
        <div className="p-5 border-b border-merkaba-border">
          <h2 className="text-lg font-semibold text-merkaba-text">Настройки</h2>
          <p className="text-xs text-merkaba-muted mt-1">Редактор и синхронизация</p>
        </div>

        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-merkaba-muted block mb-1.5">Размер шрифта</label>
              <input
                type="number"
                min={10}
                max={24}
                value={local.fontSize}
                onChange={(e) => setLocal({ ...local, fontSize: Number(e.target.value) })}
                className="input-field !py-2"
              />
            </div>
            <div>
              <label className="text-xs text-merkaba-muted block mb-1.5">Автосохранение (мс)</label>
              <input
                type="number"
                min={500}
                max={30000}
                step={500}
                value={local.autoSaveInterval}
                onChange={(e) => setLocal({ ...local, autoSaveInterval: Number(e.target.value) })}
                className="input-field !py-2"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-merkaba-muted block mb-1.5">Шрифт</label>
            <select
              value={local.fontFamily}
              onChange={(e) => setLocal({ ...local, fontFamily: e.target.value })}
              className="input-field !py-2"
            >
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Consolas">Consolas</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-merkaba-muted block mb-2">Цветовая схема</label>
            <ThemePicker
              value={local.theme}
              onChange={(theme) => setLocal({ ...local, theme })}
            />
          </div>
          <div className="p-4 rounded-xl bg-merkaba-elevated border border-merkaba-border">
            <div className="flex items-center gap-2 mb-2">
              <IconCloud className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-merkaba-text">Яндекс.Диск</span>
            </div>
            <p className="text-xs text-merkaba-muted mb-3">
              {authLogin ? `Аккаунт: ${authLogin}` : 'Облако: disk:/Merkaba/'}
            </p>
            <label className="flex items-center gap-2.5 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={local.autoSync}
                onChange={(e) => setLocal({ ...local, autoSync: e.target.checked })}
                className="w-4 h-4 rounded border-merkaba-border bg-merkaba-bg accent-merkaba-accent"
              />
              <span className="text-sm text-merkaba-text">Автосинхронизация</span>
            </label>
            <p className="text-[11px] text-merkaba-muted mb-3 leading-relaxed">
              {local.autoSync
                ? 'Изменения отправляются в облако автоматически каждую минуту.'
                : 'Синхронизация только вручную — кнопка в шапке или ниже.'}
            </p>
            <button onClick={() => syncPull()} className="btn-secondary !text-xs">
              Синхронизировать сейчас
            </button>
          </div>

          <div>
            <label className="text-xs text-merkaba-muted block mb-1.5">Локальный кэш</label>
            <p className="text-xs text-merkaba-muted break-all px-3 py-2 rounded-lg bg-merkaba-bg border border-merkaba-border">
              {local.rootPath}
            </p>
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-merkaba-border">
          <button onClick={handleSave} className="btn-primary flex-1">
            Сохранить
          </button>
          <button onClick={handleLogout} className="btn-ghost text-red-400 hover:text-red-300">
            Выйти
          </button>
          <button
            onClick={() => {
              applyTheme(config.theme);
              setShowSettings(false);
            }}
            className="btn-ghost"
          >
            Отмена
          </button>        </div>
      </div>
    </div>
  );
}
