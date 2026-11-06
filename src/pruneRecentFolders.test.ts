import { describe, expect, it } from 'vitest';

import type { FolderDirectoryHandle } from './handles';
import { pruneRecentFolders } from './pruneRecentFolders';
import type { RecentFolder } from './recentFolderList';
import { createFakeFolder } from './testing/fakeFolder';

function withPermission(name: string, permission: PermissionState): FolderDirectoryHandle {
  const handle = createFakeFolder(name);
  handle.state.permission = permission;
  return handle;
}

function gone(name: string): FolderDirectoryHandle {
  const handle = createFakeFolder(name);
  return {
    ...handle,
    keys: () => ({
      [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new DOMException('removed', 'NotFoundError')) }),
    }),
  };
}

function entry(handle: FolderDirectoryHandle): RecentFolder {
  return { handle, name: handle.name, usedAt: 1 };
}

describe('pruneRecentFolders', () => {
  it('with a granted folder that still opens, keeps it', async () => {
    const list = [entry(withPermission('live', 'granted'))];

    const result = await pruneRecentFolders(list);

    expect(result.kept.map((item) => item.name)).toEqual(['live']);
  });

  it('with a granted folder whose listing throws, drops it as gone', async () => {
    const list = [entry(gone('removed'))];

    const result = await pruneRecentFolders(list);

    expect(result.dropped.map((item) => item.name)).toEqual(['removed']);
  });

  it('with a denied folder, drops it', async () => {
    const list = [entry(withPermission('denied', 'denied'))];

    const result = await pruneRecentFolders(list);

    expect(result.dropped.map((item) => item.name)).toEqual(['denied']);
  });

  it('with a folder that only needs a prompt, keeps it', async () => {
    const list = [entry(withPermission('ask', 'prompt'))];

    const result = await pruneRecentFolders(list);

    expect(result.kept.map((item) => item.name)).toEqual(['ask']);
  });

  it('with the open folder dropped, reports openDropped', async () => {
    const open = gone('open');

    const result = await pruneRecentFolders([entry(open), entry(withPermission('other', 'granted'))], open);

    expect(result).toMatchObject({ openDropped: true, kept: [{ name: 'other' }] });
  });

  it('with the open folder kept, reports openDropped false', async () => {
    const open = withPermission('open', 'granted');

    const result = await pruneRecentFolders([entry(open), entry(gone('other'))], open);

    expect(result.openDropped).toBe(false);
  });
});
