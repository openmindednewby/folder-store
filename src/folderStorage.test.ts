import { describe, expect, it } from 'vitest';

import { StorageExistsError, UnsafePathError } from './errors';
import { createFolderStorage } from './folderStorage';
import type { FolderStorage } from './folderStorage';
import type { FolderDirectoryHandle } from './handles';
import { createFakeFolder, createFakeLocks } from './testing/fakeFolder';
import type { FakeFolder } from './testing/fakeFolder';

function storageOn(root: FolderDirectoryHandle = createFakeFolder()): FolderStorage {
  return createFolderStorage(root, { locks: createFakeLocks() });
}

function withOtherWriterAfterCreate(root: FakeFolder): FolderDirectoryHandle {
  return {
    ...root,
    getFileHandle: async (name, options) => {
      const file = await root.getFileHandle(name, options);
      if (options?.create) {
        const writable = await file.createWritable();
        await writable.write('other writer');
        await writable.close();
      }
      return file;
    },
  };
}

describe('readText and readBytes', () => {
  it('with a file in a nested folder, returns what was written', async () => {
    const storage = storageOn();
    await storage.writeNew('a/b/c.json', 'Ελληνικά');

    const text = await storage.readText('a/b/c.json');
    const bytes = await storage.readBytes('a/b/c.json');

    expect(text).toBe('Ελληνικά');
    expect(new TextDecoder().decode(bytes ?? new Uint8Array())).toBe('Ελληνικά');
  });

  it('with a missing file or missing parent, returns null', async () => {
    const storage = storageOn();
    await storage.writeNew('a/b.json', '1');

    const results = [await storage.readText('a/none.json'), await storage.readBytes('none/b.json')];

    expect(results).toEqual([null, null]);
  });

  it('with the permission lost, rejects instead of reading as missing', async () => {
    const root = createFakeFolder();
    const storage = storageOn(root);
    await storage.writeNew('a.json', '1');
    root.state.permission = 'prompt';

    const read = storage.readText('a.json');

    await expect(read).rejects.toMatchObject({ name: 'NotAllowedError' });
  });
});

describe('list', () => {
  it('with files and folders, returns sorted direct children without browser swap files', async () => {
    const storage = storageOn();
    await storage.writeNew('d/z.json', '1');
    await storage.writeNew('d/a/x.json', '1');
    await storage.writeNew('d/z.json.crswap', '');

    const names = await storage.list('d');

    expect(names).toEqual(['a', 'z.json']);
  });

  it('with the root path, lists the root', async () => {
    const storage = storageOn();
    await storage.writeNew('r.json', '1');

    const names = await storage.list('');

    expect(names).toEqual(['r.json']);
  });

  it('with a missing folder, returns empty', async () => {
    const storage = storageOn();

    const names = await storage.list('none/deeper');

    expect(names).toEqual([]);
  });

  it('with the permission lost, rejects instead of listing empty', async () => {
    const root = createFakeFolder();
    const storage = storageOn(root);
    root.state.permission = 'denied';

    const listing = storage.list('');

    await expect(listing).rejects.toMatchObject({ name: 'NotAllowedError' });
  });
});

describe('writeNew', () => {
  it('with an existing file, refuses and leaves it unchanged', async () => {
    const storage = storageOn();
    await storage.writeNew('a.json', 'first');

    const second = storage.writeNew('a.json', 'second');

    await expect(second).rejects.toBeInstanceOf(StorageExistsError);
    expect(await storage.readText('a.json')).toBe('first');
  });

  it('with a folder at that name, refuses as existing', async () => {
    const storage = storageOn();
    await storage.writeNew('a/b.json', '1');

    const write = storage.writeNew('a', 'x');

    await expect(write).rejects.toBeInstanceOf(StorageExistsError);
  });

  it('with two storages that share no lock racing one path, one wins and its content stays', async () => {
    const root = createFakeFolder();

    const results = await Promise.allSettled([storageOn(root).writeNew('a.json', 'A'), storageOn(root).writeNew('a.json', 'B')]);

    const loser = results.find((result) => result.status === 'rejected');
    expect(results.map((result) => result.status).sort((a, b) => a.localeCompare(b))).toEqual(['fulfilled', 'rejected']);
    expect((loser as PromiseRejectedResult).reason).toBeInstanceOf(StorageExistsError);
    expect(await storageOn(root).readText('a.json')).toBe('A');
  });

  it('with another writer finishing between create and write, refuses and keeps their content', async () => {
    const root = createFakeFolder();
    const storage = storageOn(withOtherWriterAfterCreate(root));

    const write = storage.writeNew('a.json', 'mine');

    await expect(write).rejects.toBeInstanceOf(StorageExistsError);
    expect(await storageOn(root).readText('a.json')).toBe('other writer');
  });

  it('with a failed write, removes the empty file it made and reports the failure', async () => {
    const root = createFakeFolder();
    const storage = storageOn(root);
    root.state.writeFailures.push(new DOMException('disk full', 'QuotaExceededError'));

    const write = storage.writeNew('a.json', 'x');

    await expect(write).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(await storage.readText('a.json')).toBeNull();
  });

  it('with the permission lost, reports that and never reads as already existing', async () => {
    const root = createFakeFolder();
    const storage = storageOn(root);
    root.state.permission = 'prompt';

    const write = storage.writeNew('a.json', 'x');

    await expect(write).rejects.toMatchObject({ name: 'NotAllowedError' });
  });
});

describe('replace', () => {
  it('with an existing file, overwrites it', async () => {
    const storage = storageOn();
    await storage.writeNew('a.json', 'first');

    await storage.replace('a.json', 'second');

    expect(await storage.readText('a.json')).toBe('second');
  });

  it('with a missing file and parents, creates them', async () => {
    const storage = storageOn();

    await storage.replace('x/y.json', 'new');

    expect(await storage.readText('x/y.json')).toBe('new');
  });

  it('with another exclusive writer open, rejects and keeps the content', async () => {
    const root = createFakeFolder();
    const storage = storageOn(root);
    await storage.writeNew('a.json', 'first');
    const held = await (await root.getFileHandle('a.json')).createWritable({ mode: 'exclusive' });

    const replace = storage.replace('a.json', 'second');

    await expect(replace).rejects.toMatchObject({ name: 'NoModificationAllowedError' });
    await held.abort();
    expect(await storage.readText('a.json')).toBe('first');
  });

  it('with a failed write, keeps the old content', async () => {
    const root = createFakeFolder();
    const storage = storageOn(root);
    await storage.writeNew('a.json', 'first');
    root.state.writeFailures.push(new DOMException('disk full', 'QuotaExceededError'));

    const replace = storage.replace('a.json', 'second');

    await expect(replace).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(await storage.readText('a.json')).toBe('first');
  });
});

describe('remove', () => {
  it('with a file, deletes it', async () => {
    const storage = storageOn();
    await storage.writeNew('a/b.json', '1');

    await storage.remove('a/b.json');

    expect(await storage.readText('a/b.json')).toBeNull();
  });

  it('with a missing file or parent, does nothing', async () => {
    const storage = storageOn();

    const results = await Promise.allSettled([storage.remove('none.json'), storage.remove('none/deep.json')]);

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
  });

  it('with the permission lost, rejects', async () => {
    const root = createFakeFolder();
    const storage = storageOn(root);
    await storage.writeNew('a.json', '1');
    root.state.permission = 'prompt';

    const remove = storage.remove('a.json');

    await expect(remove).rejects.toMatchObject({ name: 'NotAllowedError' });
  });
});

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
