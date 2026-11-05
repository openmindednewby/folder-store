import { hasErrorName, StorageExistsError, UnsafePathError } from './errors';
import type { FolderDirectoryHandle, FolderFileHandle, FolderWritable } from './handles';

const MISSING = ['NotFoundError', 'TypeMismatchError'];

/** Splits a relative path into its segments, refusing anything that could leave the folder. */
export function pathSegments(path: string): string[] {
  const segments = path.split('/');
  if (path.includes('\\') || segments.some((part) => part === '' || part === '.' || part === '..')) {
    throw new UnsafePathError(path);
  }
  return segments;
}

/** Splits a file path into its parent folders and file name. */
export function splitFilePath(path: string): { parents: string[]; name: string } {
  const segments = pathSegments(path);
  return { parents: segments.slice(0, -1), name: segments[segments.length - 1] ?? '' };
}

/** Walks to a folder; null if any part is missing. Other failures, such as lost permission, reject. */
export async function findDirectory(root: FolderDirectoryHandle, parents: string[]): Promise<FolderDirectoryHandle | null> {
  let current = root;
  for (const part of parents) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch (error) {
      if (hasErrorName(error, ...MISSING)) {
        return null;
      }
      throw error;
    }
  }
  return current;
}

/** Walks to a folder, creating any missing part. */
export async function ensureDirectory(root: FolderDirectoryHandle, parents: string[]): Promise<FolderDirectoryHandle> {
  let current = root;
  for (const part of parents) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

/** Reads a file's bytes; null if it or a parent is missing. */
export async function readFileBytes(root: FolderDirectoryHandle, path: string): Promise<Uint8Array | null> {
  const { parents, name } = splitFilePath(path);
  const directory = await findDirectory(root, parents);
  if (!directory) {
    return null;
  }
  try {
    const file = await (await directory.getFileHandle(name)).getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch (error) {
    if (hasErrorName(error, ...MISSING)) {
      return null;
    }
    throw error;
  }
}

async function entryExists(directory: FolderDirectoryHandle, name: string): Promise<boolean> {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (error) {
    if (hasErrorName(error, 'NotFoundError')) {
      return false;
    }
    if (hasErrorName(error, 'TypeMismatchError')) {
      return true;
    }
    throw error;
  }
}

async function finish(writable: FolderWritable, data: string | Uint8Array): Promise<void> {
  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}

async function openExclusiveNew(file: FolderFileHandle, path: string): Promise<FolderWritable> {
  let writable: FolderWritable;
  try {
    writable = await file.createWritable({ mode: 'exclusive' });
  } catch (error) {
    throw hasErrorName(error, 'NoModificationAllowedError') ? new StorageExistsError(path) : error;
  }
  if ((await file.getFile()).size > 0) {
    await writable.abort().catch(() => undefined);
    throw new StorageExistsError(path);
  }
  return writable;
}

async function removeIfEmpty(directory: FolderDirectoryHandle, name: string, file: FolderFileHandle): Promise<void> {
  if ((await file.getFile()).size === 0) {
    await directory.removeEntry(name);
  }
}

/** Creates a file only if nothing is there; a racing writer or existing file gives StorageExistsError. */
export async function writeNewFile(root: FolderDirectoryHandle, path: string, data: string | Uint8Array): Promise<void> {
  const { parents, name } = splitFilePath(path);
  const directory = await ensureDirectory(root, parents);
  if (await entryExists(directory, name)) {
    throw new StorageExistsError(path);
  }
  const file = await directory.getFileHandle(name, { create: true });
  const writable = await openExclusiveNew(file, path);
  try {
    await finish(writable, data);
  } catch (error) {
    await removeIfEmpty(directory, name, file).catch(() => undefined);
    throw error;
  }
}

/** Creates or overwrites a file through an exclusive writer; a failed write keeps the old content. */
export async function replaceFile(root: FolderDirectoryHandle, path: string, data: string | Uint8Array): Promise<void> {
  const { parents, name } = splitFilePath(path);
  const directory = await ensureDirectory(root, parents);
  const file = await directory.getFileHandle(name, { create: true });
  await finish(await file.createWritable({ mode: 'exclusive' }), data);
}

/** Deletes a file; a missing file or parent is not a failure. */
export async function removeFile(root: FolderDirectoryHandle, path: string): Promise<void> {
  const { parents, name } = splitFilePath(path);
  const directory = await findDirectory(root, parents);
  if (!directory) {
    return;
  }
  try {
    await directory.removeEntry(name);
  } catch (error) {
    if (!hasErrorName(error, 'NotFoundError')) {
      throw error;
    }
  }
}
