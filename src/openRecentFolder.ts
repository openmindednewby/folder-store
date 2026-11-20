import { isFolderGone } from './errors';
import { requestFolderAccess } from './folderSupport';
import type { FolderDirectoryHandle } from './handles';
import type { HandleMemory } from './handleMemory';
import type { RecentFolder } from './recentFolderList';
import type { RecentFolders } from './recentFolders';

export interface OpenRecentDeps {
  memory: HandleMemory;
  recents: RecentFolders;
  open: (handle: FolderDirectoryHandle) => Promise<void>;
  onGone: (name: string) => void;
}

/** Switches to a recent folder from a click; a gone folder leaves the list and memory. The new list, or null when access is refused. */
export async function openRecentFolder(handle: FolderDirectoryHandle, deps: OpenRecentDeps): Promise<RecentFolder[] | null> {
  try {
    if (!(await requestFolderAccess(handle))) {
      return null;
    }
    await deps.memory.save(handle);
    await deps.open(handle);
    return await deps.recents.remember(handle);
  } catch (error) {
    if (!isFolderGone(error)) {
      throw error;
    }
    const kept = await deps.recents.forget(handle);
    await deps.memory.forget();
    deps.onGone(handle.name);
    return kept;
  }
}
