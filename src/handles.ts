export interface FolderWritable {
  write(data: string | Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface FolderFile {
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface FolderFileHandle {
  getFile(): Promise<FolderFile>;
  createWritable(options?: { mode?: 'exclusive' }): Promise<FolderWritable>;
}

export interface FolderDirectoryHandle {
  readonly name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FolderDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FolderFileHandle>;
  removeEntry(name: string): Promise<void>;
  keys(): AsyncIterable<string>;
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
}

export interface FolderLocks {
  request<T>(name: string, options: { mode: 'exclusive' }, work: () => Promise<T>): Promise<T>;
}
