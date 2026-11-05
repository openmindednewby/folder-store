import { FolderUnsupportedError, hasErrorName } from './errors';
import { FolderCapability } from './FolderCapability';
import type { FolderDirectoryHandle, FolderLocks } from './handles';
import type { HandleMemory } from './handleMemory';
import { ReopenState } from './ReopenState';

const READ_WRITE = { mode: 'readwrite' } as const;

export interface FolderEnv {
  isSecureContext?: boolean;
  showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FolderDirectoryHandle>;
  locks?: FolderLocks;
  hasIndexedDb?: boolean;
}

export interface FolderSupport {
  supported: boolean;
  missing: FolderCapability[];
}

export type RememberedFolder =
  | { state: ReopenState.None; handle: null }
  | { state: ReopenState.Granted | ReopenState.NeedsPermission; handle: FolderDirectoryHandle };

interface BrowserGlobals {
  isSecureContext?: boolean;
  showDirectoryPicker?: FolderEnv['showDirectoryPicker'];
  navigator?: { locks?: FolderLocks };
  indexedDB?: unknown;
}

/** Reads the capabilities of the current browser. */
export function browserFolderEnv(): FolderEnv {
  const scope = globalThis as unknown as BrowserGlobals;
  const picker = scope.showDirectoryPicker;
  return {
    isSecureContext: scope.isSecureContext,
    showDirectoryPicker: picker && ((options): Promise<FolderDirectoryHandle> => picker.call(scope, options)),
    locks: scope.navigator?.locks,
    hasIndexedDb: scope.indexedDB !== undefined,
  };
}

/** Says whether folder access can work here, and names what is missing if not. */
export function getFolderSupport(env: FolderEnv = browserFolderEnv()): FolderSupport {
  const checks: [FolderCapability, boolean][] = [
    [FolderCapability.SecureContext, env.isSecureContext === true],
    [FolderCapability.DirectoryPicker, env.showDirectoryPicker !== undefined],
    [FolderCapability.WebLocks, env.locks !== undefined],
    [FolderCapability.IndexedDb, env.hasIndexedDb === true],
  ];
  const missing = checks.filter(([, present]) => !present).map(([capability]) => capability);
  return { supported: missing.length === 0, missing };
}

/** Grants read and write if the user agrees; call it from a click. True when access is held. */
export async function requestFolderAccess(handle: FolderDirectoryHandle): Promise<boolean> {
  if ((await handle.queryPermission(READ_WRITE)) === 'granted') {
    return true;
  }
  return (await handle.requestPermission(READ_WRITE)) === 'granted';
}

/** Opens the folder dialog and remembers the choice; call it from a click. Null when cancelled or refused. */
export async function pickFolder(memory: HandleMemory, env: FolderEnv = browserFolderEnv()): Promise<FolderDirectoryHandle | null> {
  const { missing } = getFolderSupport(env);
  if (missing.length > 0 || !env.showDirectoryPicker) {
    throw new FolderUnsupportedError(missing);
  }
  let handle: FolderDirectoryHandle;
  try {
    handle = await env.showDirectoryPicker(READ_WRITE);
  } catch (error) {
    if (hasErrorName(error, 'AbortError')) {
      return null;
    }
    throw error;
  }
  if (!(await requestFolderAccess(handle))) {
    return null;
  }
  await memory.save(handle);
  return handle;
}

/** Finds the remembered folder and whether it needs permission again; never prompts. */
export async function reopenFolder(memory: HandleMemory): Promise<RememberedFolder> {
  const handle = await memory.load();
  if (!handle) {
    return { state: ReopenState.None, handle: null };
  }
  const permission = await handle.queryPermission(READ_WRITE);
  return { state: permission === 'granted' ? ReopenState.Granted : ReopenState.NeedsPermission, handle };
}
