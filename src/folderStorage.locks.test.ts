import { describe, expect, it } from 'vitest';

import { UnsafePathError } from './errors';
import { createFolderStorage } from './folderStorage';
import type { FolderStorage } from './folderStorage';
import { createFakeFolder, createFakeLocks } from './testing/fakeFolder';

function storageOn(): FolderStorage {
  return createFolderStorage(createFakeFolder(), { locks: createFakeLocks() });
}

describe('path safety', () => {
  it.each(['../a.json', 'a/../b.json', './a.json', 'a//b.json', '/a.json', 'a\\b.json', ''])('with %j, refuses', async (path) => {
    const storage = storageOn();

    const write = storage.writeNew(path, 'x');

    await expect(write).rejects.toBeInstanceOf(UnsafePathError);
  });
});

describe('withLock AC-09', () => {
  it('with two storages over one folder, runs one holder at a time in order', async () => {
    const locks = createFakeLocks();
    const root = createFakeFolder();
    const tabA = createFolderStorage(root, { locks });
    const tabB = createFolderStorage(root, { locks });
    const events: string[] = [];
    const hold = (tab: string) => async (): Promise<string> => {
      events.push(`${tab} in`);
      await Promise.resolve();
      await Promise.resolve();
      events.push(`${tab} out`);
      return tab;
    };

    const results = await Promise.all([tabA.withLock('n', hold('a')), tabB.withLock('n', hold('b'))]);

    expect(results).toEqual(['a', 'b']);
    expect(events).toEqual(['a in', 'a out', 'b in', 'b out']);
  });

  it('with a holder that fails, rejects and the next holder still runs', async () => {
    const storage = storageOn();

    const failed = storage.withLock('n', () => Promise.reject(new Error('boom')));
    const next = storage.withLock('n', () => Promise.resolve('ran'));

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ran');
  });

  it('with two differently named folders, uses a lock name scoped to the folder', async () => {
    const locks = createFakeLocks();
    const a = createFolderStorage(createFakeFolder('a'), { locks });
    const b = createFolderStorage(createFakeFolder('b'), { locks });

    await a.withLock('n', () => Promise.resolve());
    await b.withLock('n', () => Promise.resolve());

    expect(locks.requested[0]).not.toBe(locks.requested[1]);
  });

  it('with an explicit scope, uses it instead of the folder name', async () => {
    const locks = createFakeLocks();
    const a = createFolderStorage(createFakeFolder('a'), { locks, lockScope: 'same' });
    const b = createFolderStorage(createFakeFolder('b'), { locks, lockScope: 'same' });

    await a.withLock('n', () => Promise.resolve());
    await b.withLock('n', () => Promise.resolve());

    expect(locks.requested[0]).toBe(locks.requested[1]);
  });
});
