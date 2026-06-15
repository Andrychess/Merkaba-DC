import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { LogoIcon, IconCloud } from './Icons';
import { WindowControls } from './WindowControls';
import { SetupGuide } from './SetupGuide';

type Step = 'credentials' | 'login' | 'device' | 'token';

export function WelcomeScreen() {
  const [step, setStep] = useState<Step>('login');
  const [manualToken, setManualToken] = useState('');
  const [userCode, setUserCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveManualToken = useAppStore((s) => s.saveManualToken);

  useEffect(() => {
    window.merkaba.getCredentialsInfo().then((info) => {
      if (info?.clientId) setClientId(info.clientId);
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const finishLogin = async () => {
    setLoading(true);
    try {
      await useAppStore.getState().bootstrapAfterAuth();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Укажите ClientID и Client secret');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await window.merkaba.saveCredentials(clientId.trim(), clientSecret.trim());
      setStep('login');
      setError('');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (dc: string, interval: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const result = await window.merkaba.pollDeviceAuth(dc);
        if (result.done) {
          if (pollRef.current) clearInterval(pollRef.current);
          setLoading(true);
          await finishLogin();
          setLoading(false);
        }
      } catch (err) {
        if (pollRef.current) clearInterval(pollRef.current);
        setError(String(err));
        setLoading(false);
      }
    }, interval * 1000);
  };

  const handleDeviceLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.merkaba.startDeviceAuth();
      setUserCode(result.userCode);
      setStep('device');
      setLoading(false);
      startPolling(result.deviceCode, result.interval);
    } catch (err) {
      setError(String(err));
      setLoading(false);
    }
  };

  const handleManualToken = async () => {
    if (!manualToken.trim()) {
      setError('Вставьте OAuth-токен');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await saveManualToken(manualToken.trim());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-merkaba-bg relative overflow-hidden">
      <header className="h-11 flex items-center justify-end px-2 shrink-0 app-drag-region">
        <WindowControls />
      </header>

      <div className="flex flex-1 items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-merkaba-accent/5 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-md text-center px-8 w-full relative animate-fade-in app-no-drag">
        <div className="mb-10">
          <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center shadow-glow">
            <LogoIcon className="w-16 h-16" />
          </div>
          <h1 className="text-3xl font-bold text-merkaba-text mb-2 tracking-tight">Merkaba</h1>
          <p className="text-merkaba-muted leading-relaxed">
            Личный блокнот с синхронизацией через Яндекс.Диск
          </p>
        </div>

        <div className="bg-merkaba-sidebar rounded-2xl p-7 border border-merkaba-border shadow-panel text-left">
          {step === 'credentials' && (
            <>
              <p className="text-merkaba-text mb-4 text-sm leading-relaxed">
                Создайте приложение на oauth.yandex.ru и вставьте ключи сюда.
              </p>
              <label className="text-xs text-merkaba-muted block mb-1.5">ClientID</label>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="input-field mb-3"
              />
              <label className="text-xs text-merkaba-muted block mb-1.5">Client secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="input-field mb-5"
              />
              <button onClick={handleSaveCredentials} disabled={loading} className="btn-primary w-full !py-3">
                {loading ? 'Проверка...' : 'Сохранить и проверить'}
              </button>
            </>
          )}

          {step === 'login' && (
            <>
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-merkaba-elevated border border-merkaba-border">
                <IconCloud className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-sm text-merkaba-muted">
                  Заметки синхронизируются в <code className="text-merkaba-accent">Merkaba/</code>
                </p>
              </div>

              {clientId && (
                <p className="text-xs text-merkaba-muted mb-4 break-all">ClientID: {clientId}</p>
              )}

              <button onClick={handleDeviceLogin} disabled={loading} className="btn-primary w-full !py-3">
                {loading ? 'Подключение...' : 'Войти через Яндекс'}
              </button>
              <button onClick={() => setStep('credentials')} className="btn-ghost w-full mt-2">
                Вставить новый ClientID
              </button>
              <button onClick={() => setStep('token')} className="btn-ghost w-full mt-1">
                У меня есть OAuth-токен
              </button>
            </>
          )}

          {step === 'device' && (
            <>
              <div className="text-center mb-5">
                <p className="text-sm text-merkaba-muted mb-3">Введите код на oauth.yandex.ru/device</p>
                <div className="inline-block px-6 py-3 rounded-xl bg-merkaba-bg border border-merkaba-border-strong">
                  <span className="text-2xl font-mono font-bold tracking-[0.3em] text-merkaba-accent">
                    {userCode}
                  </span>
                </div>
              </div>
              {loading && (
                <div className="flex items-center justify-center gap-2 text-xs text-merkaba-muted">
                  <div className="w-3 h-3 border border-merkaba-accent/30 border-t-merkaba-accent rounded-full animate-spin" />
                  Ожидаем подтверждение...
                </div>
              )}
              <button
                onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setStep('login'); setError(''); }}
                className="btn-ghost w-full mt-4"
              >
                ← Назад
              </button>
            </>
          )}

          {step === 'token' && (
            <>
              <p className="text-merkaba-text mb-4 text-sm leading-relaxed">
                На oauth.yandex.ru нажмите «Получить OAuth-токен» и вставьте его ниже.
              </p>
              <input
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="OAuth-токен"
                className="input-field mb-4"
              />
              <button onClick={handleManualToken} disabled={loading} className="btn-primary w-full !py-3">
                {loading ? 'Подключение...' : 'Войти с токеном'}
              </button>
              <button onClick={() => setStep('login')} className="btn-ghost w-full mt-2">
                ← Назад
              </button>
            </>
          )}

          {error && (
            <p className="mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </p>
          )}
        </div>

        <SetupGuide />
      </div>
      </div>
    </div>
  );
}
