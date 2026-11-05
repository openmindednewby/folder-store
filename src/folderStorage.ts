import { FolderUnsupportedError } from './errors';
import { FolderCapability } from './FolderCapability';
import { browserFolderEnv } from './folderSupport';
import { findDirectory, pathSegments, readFileBytes, removeFile, replaceFile, writeNewFile } from './folderWrites';
import type { FolderDirectoryHandle, FolderLocks } from './handles';

const SWAP_SUFFIX = '.crswap';

export interface FolderStorage {
  readText(path: string): Promise<string | null>;
  readBytes(path: string): Promise<Uint8Array | null>;
  list(dir: string): Promise<string[]>;
  writeNew(path: string, data: string | Uint8Array): Promise<void>;
  replace(path: string, data: string | Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  withLock<T>(name: string, work: () => Promise<T>): Promise<T>;
}

export interface FolderStorageOptions {
  locks?: FolderLocks;
  lockScope?: string;
}

async function listNames(root: FolderDirectoryHandle, dir: string): Promise<string[]> {
  const directory = await findDirectory(root, dir === '' ? [] : pathSegments(dir));
  if (!directory) {
    return [];
  }
  const names: string[] = [];
  for await (const name of directory.keys()) {
    if (!name.endsWith(SWAP_SUFFIX)) {
      names.push(name);
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
}

/** Creates a storage over a folder handle; refuses a browser with no Web Locks. */
export function createFolderStorage(root: FolderDirectoryHandle, options: FolderStorageOptions = {}): FolderStorage {
  const locks = options.locks ?? browserFolderEnv().locks;
  if (!locks) {
    throw new FolderUnsupportedError([FolderCapability.WebLocks]);
  }
  const scope = options.lockScope ?? root.name;
  const hold = <T>(name: string, work: () => Promise<T>): Promise<T> => locks.request(`folder-store:${scope}:${name}`, { mode: 'exclusive' }, work);
  const holdFile = <T>(path: string, work: () => Promise<T>): Promise<T> => hold(`file:${path}`, work);
  const readBytes = (path: string): Promise<Uint8Array | null> => readFileBytes(root, path);
  return {
    readBytes,
    readText: async (path): Promise<string | null> => {
      const bytes = await readBytes(path);
      return bytes && new TextDecoder().decode(bytes);
    },
    list: (dir) => listNames(root, dir),
    writeNew: (path, data) => holdFile(path, () => writeNewFile(root, path, data)),
    replace: (path, data) => holdFile(path, () => replaceFile(root, path, data)),
    remove: (path) => holdFile(path, () => removeFile(root, path)),
    withLock: (name, work) => hold(`lock:${name}`, work),
  };
}
