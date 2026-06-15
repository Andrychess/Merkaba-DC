import { describe, expect, it } from 'vitest';
import { SyncStateStore } from './sync-state';
import type { SyncPendingOp } from '../shared/sync';

describe('SyncStateStore pending/failed', () => {
  const store = new SyncStateStore('/tmp/test-vault');

  it('moves exhausted pending op to failed', () => {
    const state = { files: {}, pending: [], failed: [] };
    const op: SyncPendingOp = { op: 'upload', path: 'notes/a.md', retries: 4, at: '' };
    state.pending.push(op);

    store.bumpRetry(state, op);
    expect(op.retries).toBe(5);
    store.markFailed(state, op, 'network error');

    expect(state.pending).toHaveLength(0);
    expect(state.failed).toHaveLength(1);
    expect(state.failed![0].path).toBe('notes/a.md');
    expect(state.failed![0].error).toBe('network error');
  });

  it('retries failed ops back into pending', () => {
    const state = {
      files: {},
      pending: [],
      failed: [
        {
          op: 'upload' as const,
          path: 'notes/b.md',
          error: 'timeout',
          retries: 5,
          at: '',
        },
      ],
    };

    const count = store.retryFailed(state, ['notes/b.md']);
    expect(count).toBe(1);
    expect(state.failed).toHaveLength(0);
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0].path).toBe('notes/b.md');
    expect(state.pending[0].retries).toBe(0);
  });

  it('counts pending and failed separately', () => {
    const state = {
      files: {},
      pending: [{ op: 'upload' as const, path: 'x.md', retries: 0, at: '' }],
      failed: [{ op: 'delete' as const, path: 'y.md', error: 'e', retries: 5, at: '' }],
    };
    expect(store.pendingCount(state)).toBe(1);
    expect(store.failedCount(state)).toBe(1);
  });
});
