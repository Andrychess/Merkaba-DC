/** Пространства, создаваемые только при первой инициализации хранилища */
export const DEFAULT_VAULT_SPACES = ['notes', 'daily', 'projects'] as const;

/** Служебные папки — всегда должны существовать */
export const SYSTEM_VAULT_FOLDERS = ['attachments', '_archive'] as const;

/** Маркер: хранилище уже инициализировано, дефолтные пространства не пересоздавать */
export const VAULT_INIT_MARKER = '.merkaba/.vault-initialized';

/** Признаки существующего хранилища (для миграции без маркера) */
export const VAULT_LEGACY_MARKERS = [
  VAULT_INIT_MARKER,
  '.merkaba/config.json',
  '.merkaba/sync-state.json',
] as const;
