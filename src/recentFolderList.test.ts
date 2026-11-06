import { describe, expect, it } from 'vitest';

import type { FolderDirectoryHandle } from './handles';
import { addRecentFolder, withoutFolder } from './recentFolderList';
import type { RecentFolder } from './recentFolderList';

function folder(name: string): FolderDirectoryHandle {
  return { name } as unknown as FolderDirectoryHandle;
}

function entry(name: string, usedAt: number): RecentFolder {
  return { handle: folder(name), name, usedAt };
}

describe('addRecentFolder', () => {
  it('with a new folder, puts it first', async () => {
    const list = [entry('old', 1)];

    const next = await addRecentFolder(list, entry('new', 2), 5);

    expect(next.map((item) => item.name)).toEqual(['new', 'old']);
  });

  it('with a folder already listed, moves it first without a duplicate', async () => {
    const list = [entry('a', 2), entry('b', 1)];

    const next = await addRecentFolder(list, entry('b', 3), 5);

    expect(next.map((item) => `${item.name}:${item.usedAt}`)).toEqual(['b:3', 'a:2']);
  });

  it('with the list full, drops the least recently used', async () => {
    const list = [entry('b', 2), entry('a', 1)];

    const next = await addRecentFolder(list, entry('c', 3), 2);

    expect(next.map((item) => item.name)).toEqual(['c', 'b']);
  });

  it('with handles that can compare entries, uses isSameEntry over the name', async () => {
    const twin = { name: 'same', isSameEntry: () => Promise.resolve(false) } as unknown as FolderDirectoryHandle;
    const list = [{ handle: twin, name: 'same', usedAt: 1 }];

    const next = await addRecentFolder(list, { handle: twin, name: 'same', usedAt: 2 }, 5);

    expect(next).toHaveLength(2);
  });
});

describe('withoutFolder', () => {
  it('with the folder listed, removes only it', async () => {
    const list = [entry('a', 2), entry('b', 1)];

    const next = await withoutFolder(list, folder('a'));

    expect(next.map((item) => item.name)).toEqual(['b']);
  });
});
