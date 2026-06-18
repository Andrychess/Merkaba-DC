/** Маркер: хранилище уже инициализировано */
export const VAULT_INIT_MARKER = '.merkaba/.vault-initialized';

/** Признаки существующего хранилища (для миграции без маркера) */
export const VAULT_LEGACY_MARKERS = [
  VAULT_INIT_MARKER,
  '.merkaba/config.json',
  '.merkaba/sync-state.json',
] as const;
