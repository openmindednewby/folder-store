import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import type { FolderDirectoryHandle } from './handles';
import { createHandleMemory } from './handleMemory';
import { createRecentFolders } from './recentFolders';

function folder(name: string): FolderDirectoryHandle {
  return { name } as unknown as FolderDirectoryHandle;
}

function clock(start: number): () => number {
  let time = start;
  return () => {
    time += 1;
    return time;
  };
}

describe('createRecentFolders', () => {
  it('with nothing remembered, lists nothing', async () => {
    const recent = createRecentFolders({ appId: 'app', indexedDB: new IDBFactory() });

    const list = await recent.list();

    expect(list).toEqual([]);
  });

  it('with folders remembered by an earlier instance, lists them newest first after a restart', async () => {
    const indexedDB = new IDBFactory();
    const first = createRecentFolders({ appId: 'app', indexedDB, now: clock(100) });
    await first.remember(folder('a'));
    await first.remember(folder('b'));

    const list = await createRecentFolders({ appId: 'app', indexedDB }).list();

    expect(list.map((item) => `${item.name}:${item.usedAt}`)).toEqual(['b:102', 'a:101']);
  });

  it('with more folders than max, keeps the newest max', async () => {
    const recent = createRecentFolders({ appId: 'app', indexedDB: new IDBFactory(), max: 2 });
    await recent.remember(folder('a'));
    await recent.remember(folder('b'));

    await recent.remember(folder('c'));

    expect((await recent.list()).map((item) => item.name)).toEqual(['c', 'b']);
  });

  it('with no max given, keeps five', async () => {
    const recent = createRecentFolders({ appId: 'app', indexedDB: new IDBFactory() });
    const names = ['a', 'b', 'c', 'd', 'e'];
    for (const name of names) await recent.remember(folder(name));

    await recent.remember(folder('f'));

    expect((await recent.list()).map((item) => item.name)).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('with a folder forgotten, no longer lists it', async () => {
    const recent = createRecentFolders({ appId: 'app', indexedDB: new IDBFactory() });
    await recent.remember(folder('a'));
    await recent.remember(folder('b'));

    await recent.forget(folder('a'));

    expect((await recent.list()).map((item) => item.name)).toEqual(['b']);
  });

  it('with two apps, keeps their lists apart', async () => {
    const indexedDB = new IDBFactory();
    await createRecentFolders({ appId: 'one', indexedDB }).remember(folder('a'));

    const other = await createRecentFolders({ appId: 'two', indexedDB }).list();

    expect(other).toEqual([]);
  });

  it('with a remembered handle in the same database, leaves it in place', async () => {
    const indexedDB = new IDBFactory();
    await createHandleMemory({ indexedDB }).save(folder('current'));

    await createRecentFolders({ appId: 'app', indexedDB }).remember(folder('a'));

    expect(await createHandleMemory({ indexedDB }).load()).toEqual(folder('current'));
  });

  it('with a stored handle that can no longer be queried, prune drops it from the stored list', async () => {
    const recent = createRecentFolders({ appId: 'app', indexedDB: new IDBFactory() });
    await recent.remember(folder('stale'));

    const result = await recent.prune(folder('stale'));

    expect({ openDropped: result.openDropped, list: await recent.list() }).toEqual({ openDropped: true, list: [] });
  });

  it('with no indexedDB, rejects instead of listing nothing', async () => {
    const recent = createRecentFolders({ appId: 'app', indexedDB: null });

    const list = recent.list();

    await expect(list).rejects.toMatchObject({ name: 'FolderUnsupportedError' });
  });
});
