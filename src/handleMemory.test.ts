import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import type { FolderDirectoryHandle } from './handles';
import { createHandleMemory } from './handleMemory';

const HANDLE = { name: 'plain-clonable' } as unknown as FolderDirectoryHandle;

describe('createHandleMemory', () => {
  it('with nothing saved, loads null', async () => {
    const memory = createHandleMemory({ indexedDB: new IDBFactory() });

    const loaded = await memory.load();

    expect(loaded).toBeNull();
  });

  it('with a handle saved by an earlier instance, loads it as after a restart', async () => {
    const indexedDB = new IDBFactory();
    await createHandleMemory({ indexedDB }).save(HANDLE);

    const loaded = await createHandleMemory({ indexedDB }).load();

    expect(loaded).toEqual(HANDLE);
  });

  it('with a saved handle forgotten, loads null', async () => {
    const memory = createHandleMemory({ indexedDB: new IDBFactory() });
    await memory.save(HANDLE);

    await memory.forget();

    expect(await memory.load()).toBeNull();
  });

  it('with two keys, keeps them apart', async () => {
    const indexedDB = new IDBFactory();
    await createHandleMemory({ indexedDB, key: 'a' }).save(HANDLE);

    const other = await createHandleMemory({ indexedDB, key: 'b' }).load();

    expect(other).toBeNull();
  });

  it('with no indexedDB, rejects instead of pretending nothing was saved', async () => {
    const memory = createHandleMemory({ indexedDB: null });

    const load = memory.load();

    await expect(load).rejects.toMatchObject({ name: 'FolderUnsupportedError' });
  });
});
