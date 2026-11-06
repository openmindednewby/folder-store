import type { FolderDirectoryHandle } from './handles';

export interface RecentFolder {
  handle: FolderDirectoryHandle;
  name: string;
  usedAt: number;
}

/** True when both handles point at the same folder; falls back to the name when isSameEntry is missing. */
export async function isSameFolder(a: FolderDirectoryHandle, b: FolderDirectoryHandle): Promise<boolean> {
  return a.isSameEntry ? a.isSameEntry(b) : a.name === b.name;
}

/** Returns the list without the given folder. */
export async function withoutFolder(list: RecentFolder[], handle: FolderDirectoryHandle): Promise<RecentFolder[]> {
  const matches = await Promise.all(list.map((item) => isSameFolder(item.handle, handle)));
  return list.filter((_item, index) => !matches[index]);
}

/** Puts the entry first, drops its older copy and keeps at most max entries. */
export async function addRecentFolder(list: RecentFolder[], entry: RecentFolder, max: number): Promise<RecentFolder[]> {
  const rest = await withoutFolder(list, entry.handle);
  return [entry, ...rest].slice(0, max);
}
