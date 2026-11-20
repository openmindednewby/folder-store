import { describe, expect, it, vi } from 'vitest';

import type { FolderDirectoryHandle } from './handles';
import type { HandleMemory } from './handleMemory';
import { openRecentFolder } from './openRecentFolder';
import type { OpenRecentDeps } from './openRecentFolder';
import type { RecentFolder } from './recentFolderList';
import type { RecentFolders } from './recentFolders';
import { createFakeFolder } from './testing/fakeFolder';

function fakeRecents(): RecentFolders {
  let list: RecentFolder[] = [];
  const entry = (handle: FolderDirectoryHandle): RecentFolder => ({ handle, name: handle.name, usedAt: 1 });
  return {
    list: async () => list,
    remember: async (handle) => {
      list = [entry(handle), ...list.filter((item) => item.name !== handle.name)];
      return list;
    },
    forget: async (handle) => {
      list = list.filter((item) => item.name !== handle.name);
      return list;
    },
    prune: async () => ({ kept: list, dropped: [], openDropped: false }),
  };
}

function memory(): HandleMemory {
  return { load: vi.fn(async () => null), save: vi.fn(async () => undefined), forget: vi.fn(async () => undefined) };
}

function deps(open: OpenRecentDeps['open'] = async () => undefined): OpenRecentDeps {
  return { memory: memory(), recents: fakeRecents(), open, onGone: vi.fn() };
}

function goneFolder(name: string): FolderDirectoryHandle {
  const gone = (): Promise<PermissionState> => Promise.reject(new DOMException('gone', 'NotFoundError'));
  return { name, queryPermission: gone, requestPermission: gone } as unknown as FolderDirectoryHandle;
}

describe('openRecentFolder', () => {
  it('with access granted, remembers the folder, opens it and returns the list with it first', async () => {
    const folder = createFakeFolder('Invoices');
    const switchDeps = deps();

    const list = await openRecentFolder(folder, switchDeps);

    expect(list?.map((entry) => entry.name)).toEqual(['Invoices']);
    expect(switchDeps.memory.save).toHaveBeenCalledWith(folder);
  });

  it('with access refused, returns null and opens nothing', async () => {
    const folder = createFakeFolder('Invoices');
    folder.state.permission = 'prompt';
    folder.state.requestAnswer = 'denied';
    const open = vi.fn(async () => undefined);

    const list = await openRecentFolder(folder, deps(open));

    expect(list).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('with a folder that is gone, forgets it everywhere and reports its name', async () => {
    const switchDeps = deps();
    const folder = goneFolder('Old');

    const list = await openRecentFolder(folder, switchDeps);

    expect(list).toEqual([]);
    expect(switchDeps.memory.forget).toHaveBeenCalled();
    expect(switchDeps.onGone).toHaveBeenCalledWith('Old');
  });

  it('with an open that fails for another reason, rethrows and keeps memory', async () => {
    const switchDeps = deps(async () => Promise.reject(new Error('disk full')));

    const result = openRecentFolder(createFakeFolder('Invoices'), switchDeps);

    await expect(result).rejects.toThrow('disk full');
    expect(switchDeps.memory.forget).not.toHaveBeenCalled();
  });
});
