import { describe, expect, it } from 'vitest';
import { resolveSyncDirection } from './sync-resolve';

const LOCAL = { md5: 'aaa', mtimeMs: 1000 };

describe('resolveSyncDirection', () => {
  it('skips when md5 matches cloud', () => {
    expect(resolveSyncDirection(LOCAL, 'aaa', '2024-01-01T00:00:00Z', undefined)).toBe('skip');
  });

  it('skips when journal md5 unchanged', () => {
    expect(
      resolveSyncDirection(LOCAL, 'bbb', '2024-06-01T00:00:00Z', {
        localMd5: 'aaa',
        cloudMd5: 'bbb',
      })
    ).toBe('skip');
  });

  it('downloads when only cloud changed', () => {
    expect(
      resolveSyncDirection(LOCAL, 'bbb', '2024-06-01T00:00:00Z', {
        localMd5: 'aaa',
        cloudMd5: 'ccc',
      })
    ).toBe('download');
  });

  it('uploads when only local changed', () => {
    expect(
      resolveSyncDirection({ md5: 'bbb', mtimeMs: 2000 }, 'aaa', '2024-01-01T00:00:00Z', {
        localMd5: 'aaa',
        cloudMd5: 'aaa',
      })
    ).toBe('upload');
  });

  it('downloads when both changed and cloud is newer', () => {
    expect(
      resolveSyncDirection(
        { md5: 'local-new', mtimeMs: 1000 },
        'cloud-new',
        '2024-06-01T00:00:00Z',
        { localMd5: 'local-old', cloudMd5: 'cloud-old' }
      )
    ).toBe('download');
  });

  it('uploads when both changed and local is newer', () => {
    expect(
      resolveSyncDirection(
        { md5: 'local-new', mtimeMs: 9_000_000_000_000 },
        'cloud-new',
        '2024-01-01T00:00:00Z',
        { localMd5: 'local-old', cloudMd5: 'cloud-old' }
      )
    ).toBe('upload');
  });

  it('conflicts when both changed and times tie', () => {
    const t = '2024-03-01T12:00:00Z';
    expect(
      resolveSyncDirection(
        { md5: 'local-new', mtimeMs: new Date(t).getTime() },
        'cloud-new',
        t,
        { localMd5: 'local-old', cloudMd5: 'cloud-old' }
      )
    ).toBe('conflict');
  });
});
