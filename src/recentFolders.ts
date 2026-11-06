import { browserIndexedDb, runInFolderStore } from './folderDatabase';
import type { FolderDirectoryHandle } from './handles';
import { pruneRecentFolders } from './pruneRecentFolders';
import type { PruneResult } from './pruneRecentFolders';
import { addRecentFolder, withoutFolder } from './recentFolderList';
import type { RecentFolder } from './recentFolderList';

const DEFAULT_MAX = 5;

export interface RecentFoldersOptions {
  appId: string;
  indexedDB?: IDBFactory | null;
  max?: number;
  now?: () => number;
}

export interface RecentFolders {
  list(): Promise<RecentFolder[]>;
  remember(handle: FolderDirectoryHandle): Promise<RecentFolder[]>;
  forget(handle: FolderDirectoryHandle): Promise<RecentFolder[]>;
  prune(open?: FolderDirectoryHandle): Promise<PruneResult>;
}

/** Creates the per-app list of recently used folders, newest first, kept in IndexedDB. */
export function createRecentFolders(options: RecentFoldersOptions): RecentFolders {
  const key = `recent:${options.appId}`;
  const max = options.max ?? DEFAULT_MAX;
  const now = options.now ?? Date.now;
  const factory = options.indexedDB === undefined ? browserIndexedDb() : options.indexedDB;
  const list = async (): Promise<RecentFolder[]> =>
    (await runInFolderStore(factory, 'readonly', (store) => store.get(key) as IDBRequest<RecentFolder[] | undefined>)) ?? [];
  const save = async (next: RecentFolder[]): Promise<RecentFolder[]> => {
    await runInFolderStore(factory, 'readwrite', (store) => store.put(next, key));
    return next;
  };
  return {
    list,
    remember: async (handle): Promise<RecentFolder[]> => save(await addRecentFolder(await list(), { handle, name: handle.name, usedAt: now() }, max)),
    forget: async (handle): Promise<RecentFolder[]> => save(await withoutFolder(await list(), handle)),
    prune: async (open): Promise<PruneResult> => {
      const result = await pruneRecentFolders(await list(), open);
      await save(result.kept);
      return result;
    },
  };
}
