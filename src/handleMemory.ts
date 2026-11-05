import { FolderUnsupportedError } from './errors';
import { FolderCapability } from './FolderCapability';
import type { FolderDirectoryHandle } from './handles';

const DATABASE = 'folder-store';
const STORE = 'handles';
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

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error ?? new Error('indexedDB request failed'));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(DATABASE, 1);
  request.onupgradeneeded = (): void => {
    request.result.createObjectStore(STORE);
  };
  return asPromise(request);
}

function browserIndexedDb(): IDBFactory | null {
  return (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null;
}

/** Creates the memory that keeps a folder handle across browser restarts, in IndexedDB. */
export function createHandleMemory(options: HandleMemoryOptions = {}): HandleMemory {
  const key = options.key ?? DEFAULT_KEY;
  const factory = options.indexedDB === undefined ? browserIndexedDb() : options.indexedDB;
  const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    if (!factory) {
      throw new FolderUnsupportedError([FolderCapability.IndexedDb]);
    }
    const database = await openDatabase(factory);
    try {
      return await asPromise(work(database.transaction(STORE, mode).objectStore(STORE)));
    } finally {
      database.close();
    }
  };
  return {
    load: async (): Promise<FolderDirectoryHandle | null> => ((await run('readonly', (store) => store.get(key) as IDBRequest<FolderDirectoryHandle | undefined>)) ?? null),
    save: async (handle): Promise<void> => {
      await run('readwrite', (store) => store.put(handle, key));
    },
    forget: async (): Promise<void> => {
      await run('readwrite', (store) => store.delete(key));
    },
  };
}
