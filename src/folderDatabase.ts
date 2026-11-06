import { FolderUnsupportedError } from './errors';
import { FolderCapability } from './FolderCapability';

const DATABASE = 'folder-store';
const STORE = 'handles';
const VERSION = 1;

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error ?? new Error('indexedDB request failed'));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  const request = factory.open(DATABASE, VERSION);
  request.onupgradeneeded = (): void => {
    request.result.createObjectStore(STORE);
  };
  return asPromise(request);
}

/** Returns the browser's IndexedDB, or null when there is none. */
export function browserIndexedDb(): IDBFactory | null {
  return (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null;
}

/** Runs one request against the package's handles store and closes the database after. */
export async function runInFolderStore<T>(
  factory: IDBFactory | null,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  if (!factory) {
    throw new FolderUnsupportedError([FolderCapability.IndexedDb]);
  }
  const database = await openDatabase(factory);
  try {
    return await asPromise(work(database.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    database.close();
  }
}
