import { useState } from 'react';

const OAUTH_NEW = 'https://oauth.yandex.ru/client/new';
const OAUTH_DEVICE = 'https://oauth.yandex.ru/device';

export function SetupGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-merkaba-accent hover:underline"
      >
        {open ? 'Скрыть инструкцию' : 'Инструкция для нового пользователя'}
      </button>

      {open && (
        <div className="mt-3 p-4 rounded-xl bg-merkaba-bg border border-merkaba-border text-sm text-merkaba-muted space-y-4 leading-relaxed">
          <section>
            <h3 className="text-merkaba-text font-medium mb-1">Что нужно</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Аккаунт Яндекса с Диском</li>
              <li>
                OAuth-приложение (Client ID и Secret) — если сборка без встроенных ключей
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-merkaba-text font-medium mb-1">1. OAuth-приложение (один раз)</h3>
            <p>
              Создайте приложение на{' '}
              <a
                href={OAUTH_NEW}
                className="text-merkaba-accent hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(OAUTH_NEW, '_blank');
                }}
              >
                oauth.yandex.ru
              </a>
              . Redirect URI:{' '}
              <code className="text-xs text-merkaba-text">https://oauth.yandex.ru/verification_code</code>
              . Включите доступ к Яндекс.Диску (чтение и запись).
            </p>
            <p className="mt-1">
              В Merkaba: «Вставить новый ClientID» → введите ключи → «Сохранить и проверить».
            </p>
          </section>

          <section>
            <h3 className="text-merkaba-text font-medium mb-1">2. Вход в свой аккаунт</h3>
            <p>
              «Войти через Яндекс» → введите код на{' '}
              <a
                href={OAUTH_DEVICE}
                className="text-merkaba-accent hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(OAUTH_DEVICE, '_blank');
                }}
              >
                oauth.yandex.ru/device
              </a>
              . Подтвердите доступ — заметки появятся в папке{' '}
              <code className="text-merkaba-text">Merkaba/</code> на вашем Диске.
            </p>
          </section>

          <section>
            <h3 className="text-merkaba-text font-medium mb-1">Другой пользователь</h3>
            <p>
              Каждый входит под своим Яндексом — данные в облаке разделены. Смена аккаунта: Настройки →
              Выйти.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
