import type { FolderCapability } from './FolderCapability';

export class StorageExistsError extends Error {
  constructor(path: string) {
    super(`already exists: ${path}`);
    this.name = 'StorageExistsError';
  }
}

export class UnsafePathError extends Error {
  constructor(path: string) {
    super(`not a safe relative path: ${JSON.stringify(path)}`);
    this.name = 'UnsafePathError';
  }
}

export class FolderUnsupportedError extends Error {
  readonly missing: FolderCapability[];

  constructor(missing: FolderCapability[]) {
    super(`this browser cannot open a folder; missing: ${missing.join(', ')}`);
    this.name = 'FolderUnsupportedError';
    this.missing = missing;
  }
}

/** Whether an error is a DOM failure with one of these names. */
export function hasErrorName(error: unknown, ...names: string[]): boolean {
  return typeof error === 'object' && error !== null && names.includes(String((error as { name?: unknown }).name));
}
