import { browserIndexedDb, runInFolderStore } from './folderDatabase';
import type { FolderDirectoryHandle } from './handles';

const DEFAULT_KEY = 'current';

export interface HandleMemory {
  load(): Promise<FolderDirectoryHandle | null>;
  save(handle: FolderDirectoryHandle): Promise<void>;
  forget(): Promise<void>;
}

export interface HandleMemoryOptions {
  indexedDB?: IDBFactory | null;
  key?: string;
}

/** Creates the memory that keeps a folder handle across browser restarts, in IndexedDB. */
export function createHandleMemory(options: HandleMemoryOptions = {}): HandleMemory {
  const key = options.key ?? DEFAULT_KEY;
  const factory = options.indexedDB === undefined ? browserIndexedDb() : options.indexedDB;
  return {
    load: async (): Promise<FolderDirectoryHandle | null> =>
      (await runInFolderStore(factory, 'readonly', (store) => store.get(key) as IDBRequest<FolderDirectoryHandle | undefined>)) ?? null,
    save: async (handle): Promise<void> => {
      await runInFolderStore(factory, 'readwrite', (store) => store.put(handle, key));
    },
    forget: async (): Promise<void> => {
      await runInFolderStore(factory, 'readwrite', (store) => store.delete(key));
    },
  };
}
