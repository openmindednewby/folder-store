import type { FolderDirectoryHandle } from './handles';
import { isSameFolder } from './recentFolderList';
import type { RecentFolder } from './recentFolderList';

export interface PruneResult {
  kept: RecentFolder[];
  dropped: RecentFolder[];
  openDropped: boolean;
}

async function isGone(handle: FolderDirectoryHandle): Promise<boolean> {
  try {
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      return permission === 'denied';
    }
    await handle.keys()[Symbol.asyncIterator]().next();
    return false;
  } catch {
    return true;
  }
}

async function includesFolder(list: RecentFolder[], handle: FolderDirectoryHandle): Promise<boolean> {
  const matches = await Promise.all(list.map((item) => isSameFolder(item.handle, handle)));
  return matches.includes(true);
}

/** Splits the list into folders still usable and folders gone or denied; a folder needing a prompt is kept. */
export async function pruneRecentFolders(list: RecentFolder[], open?: FolderDirectoryHandle): Promise<PruneResult> {
  const goneFlags = await Promise.all(list.map((item) => isGone(item.handle)));
  const kept = list.filter((_item, index) => !goneFlags[index]);
  const dropped = list.filter((_item, index) => goneFlags[index]);
  const openDropped = open !== undefined && (await includesFolder(dropped, open));
  return { kept, dropped, openDropped };
}
