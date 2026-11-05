import type { FolderDirectoryHandle, FolderFileHandle, FolderLocks, FolderWritable } from '../handles';

export interface FakeFolderState {
  permission: PermissionState;
  requestAnswer: PermissionState;
  writeFailures: Error[];
}

export interface FakeFolder extends FolderDirectoryHandle {
  readonly state: FakeFolderState;
}

interface FakeEntry {
  bytes: Uint8Array;
  writerOpen: boolean;
}

function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === 'string' ? new TextEncoder().encode(data) : data;
}

function makeWritable(entry: FakeEntry, state: FakeFolderState): FolderWritable {
  let buffer: Uint8Array = new Uint8Array();
  return {
    write: async (data): Promise<void> => {
      await Promise.resolve();
      const failure = state.writeFailures.shift();
      if (failure) {
        throw failure;
      }
      buffer = toBytes(data);
    },
    close: async (): Promise<void> => {
      await Promise.resolve();
      entry.bytes = buffer;
      entry.writerOpen = false;
    },
    abort: async (): Promise<void> => {
      await Promise.resolve();
      entry.writerOpen = false;
    },
  };
}

function makeFile(entry: FakeEntry, state: FakeFolderState): FolderFileHandle {
  return {
    getFile: async () => {
      await Promise.resolve();
      const { bytes } = entry;
      return { size: bytes.length, arrayBuffer: () => Promise.resolve(bytes.slice().buffer as ArrayBuffer) };
    },
    createWritable: async (options) => {
      await Promise.resolve();
      if (entry.writerOpen) {
        throw new DOMException('another writer holds this file', 'NoModificationAllowedError');
      }
      entry.writerOpen = options?.mode === 'exclusive';
      return makeWritable(entry, state);
    },
  };
}

function makeDirectory(name: string, state: FakeFolderState): FolderDirectoryHandle {
  const directories = new Map<string, FolderDirectoryHandle>();
  const files = new Map<string, FakeEntry>();
  const enter = async (): Promise<void> => {
    await Promise.resolve();
    if (state.permission !== 'granted') {
      throw new DOMException('permission lost', 'NotAllowedError');
    }
  };
  return {
    name,
    getDirectoryHandle: async (child, options) => {
      await enter();
      if (files.has(child)) {
        throw new DOMException(`${child} is a file`, 'TypeMismatchError');
      }
      const found = directories.get(child);
      if (found) {
        return found;
      }
      if (!options?.create) {
        throw new DOMException(`${child} not found`, 'NotFoundError');
      }
      const created = makeDirectory(child, state);
      directories.set(child, created);
      return created;
    },
    getFileHandle: async (child, options) => {
      await enter();
      if (directories.has(child)) {
        throw new DOMException(`${child} is a folder`, 'TypeMismatchError');
      }
      const found = files.get(child);
      if (found) {
        return makeFile(found, state);
      }
      if (!options?.create) {
        throw new DOMException(`${child} not found`, 'NotFoundError');
      }
      const created = { bytes: new Uint8Array(), writerOpen: false };
      files.set(child, created);
      return makeFile(created, state);
    },
    removeEntry: async (child) => {
      await enter();
      if (!files.delete(child) && !directories.delete(child)) {
        throw new DOMException(`${child} not found`, 'NotFoundError');
      }
    },
    keys: () => (async function* names(): AsyncGenerator<string> {
      await enter();
      yield* [...directories.keys(), ...files.keys()];
    })(),
    queryPermission: () => Promise.resolve(state.permission),
    requestPermission: () => {
      state.permission = state.requestAnswer;
      return Promise.resolve(state.permission);
    },
  };
}

/** Creates an in-memory folder that fails the way a browser folder does. */
export function createFakeFolder(name = 'fake-folder'): FakeFolder {
  const state: FakeFolderState = { permission: 'granted', requestAnswer: 'granted', writeFailures: [] };
  return { ...makeDirectory(name, state), state };
}

/** Creates locks shared by every storage given them, like the tabs of one browser. */
export function createFakeLocks(): FolderLocks & { requested: string[] } {
  const queues = new Map<string, Promise<unknown>>();
  const requested: string[] = [];
  return {
    requested,
    request: <T>(name: string, _options: { mode: 'exclusive' }, work: () => Promise<T>): Promise<T> => {
      requested.push(name);
      const run = (queues.get(name) ?? Promise.resolve()).then(work, work);
      queues.set(name, run.catch(() => undefined));
      return run;
    },
  };
}
