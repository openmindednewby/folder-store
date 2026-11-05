import { describe, expect, it, vi } from 'vitest';

import { FolderUnsupportedError } from './errors';
import { FolderCapability } from './FolderCapability';
import { createFolderStorage } from './folderStorage';
import { getFolderSupport, pickFolder, reopenFolder, requestFolderAccess } from './folderSupport';
import type { FolderEnv } from './folderSupport';
import type { FolderDirectoryHandle } from './handles';
import type { HandleMemory } from './handleMemory';
import { ReopenState } from './ReopenState';
import { createFakeFolder, createFakeLocks } from './testing/fakeFolder';

function memoryWith(handle: FolderDirectoryHandle | null = null): HandleMemory & { current: () => FolderDirectoryHandle | null } {
  let stored = handle;
  return {
    current: () => stored,
    load: () => Promise.resolve(stored),
    save: (next) => {
      stored = next;
      return Promise.resolve();
    },
    forget: () => {
      stored = null;
      return Promise.resolve();
    },
  };
}

function fullEnv(picker?: FolderEnv['showDirectoryPicker']): FolderEnv {
  return { isSecureContext: true, showDirectoryPicker: picker, locks: createFakeLocks(), hasIndexedDb: true };
}

describe('getFolderSupport AC-03', () => {
  it('with every capability, is supported', () => {
    const env = fullEnv(() => Promise.resolve(createFakeFolder()));

    const support = getFolderSupport(env);

    expect(support).toEqual({ supported: true, missing: [] });
  });

  it('with a browser that has no picker, names what is missing', () => {
    const env = fullEnv();

    const support = getFolderSupport(env);

    expect(support).toEqual({ supported: false, missing: [FolderCapability.DirectoryPicker] });
  });

  it('with an empty environment, names all four', () => {
    const env: FolderEnv = {};

    const support = getFolderSupport(env);

    expect(support.missing).toEqual([FolderCapability.SecureContext, FolderCapability.DirectoryPicker, FolderCapability.WebLocks, FolderCapability.IndexedDb]);
  });

  it('with no argument under node, reports unsupported instead of throwing', () => {
    const support = getFolderSupport();

    expect(support.supported).toBe(false);
  });
});

describe('createFolderStorage AC-03', () => {
  it('with no Web Locks, refuses, so no unlocked write can happen', () => {
    const create = (): unknown => createFolderStorage(createFakeFolder());

    expect(create).toThrow(FolderUnsupportedError);
  });
});

describe('pickFolder AC-01 AC-03', () => {
  it('with a picked folder, asks for read and write and remembers it', async () => {
    const folder = createFakeFolder();
    const picker = vi.fn(() => Promise.resolve(folder));
    const memory = memoryWith();

    const picked = await pickFolder(memory, fullEnv(picker));

    expect(picked).toBe(folder);
    expect(picker).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(memory.current()).toBe(folder);
  });

  it('with the dialog cancelled, returns null and keeps the remembered folder', async () => {
    const remembered = createFakeFolder();
    const memory = memoryWith(remembered);

    const picked = await pickFolder(memory, fullEnv(() => Promise.reject(new DOMException('cancelled', 'AbortError'))));

    expect(picked).toBeNull();
    expect(memory.current()).toBe(remembered);
  });

  it('with another picker failure, rejects and is not read as a cancel', async () => {
    const pick = pickFolder(memoryWith(), fullEnv(() => Promise.reject(new DOMException('blocked folder', 'SecurityError'))));

    await expect(pick).rejects.toMatchObject({ name: 'SecurityError' });
  });

  it('with write access refused, returns null and remembers nothing', async () => {
    const folder = createFakeFolder();
    folder.state.permission = 'prompt';
    folder.state.requestAnswer = 'denied';
    const memory = memoryWith();

    const picked = await pickFolder(memory, fullEnv(() => Promise.resolve(folder)));

    expect(picked).toBeNull();
    expect(memory.current()).toBeNull();
  });

  it('with an unsupported browser, refuses, names what is missing and leaves the memory alone', async () => {
    const remembered = createFakeFolder();
    const memory = memoryWith(remembered);

    const pick = pickFolder(memory, fullEnv());

    await expect(pick).rejects.toMatchObject({ name: 'FolderUnsupportedError', missing: [FolderCapability.DirectoryPicker] });
    expect(memory.current()).toBe(remembered);
  });
});

describe('reopenFolder (AC-02 at unit level only)', () => {
  it('with nothing remembered, reports none', async () => {
    const reopened = await reopenFolder(memoryWith());

    expect(reopened).toEqual({ state: ReopenState.None, handle: null });
  });

  it('with permission still granted, offers the folder ready to use', async () => {
    const folder = createFakeFolder();

    const reopened = await reopenFolder(memoryWith(folder));

    expect(reopened).toEqual({ state: ReopenState.Granted, handle: folder });
  });

  it.each(['prompt', 'denied'] as const)('with permission %s after a restart, offers the same folder and asks again', async (permission) => {
    const folder = createFakeFolder();
    folder.state.permission = permission;

    const reopened = await reopenFolder(memoryWith(folder));

    expect(reopened).toEqual({ state: ReopenState.NeedsPermission, handle: folder });
  });
});

describe('requestFolderAccess', () => {
  it('with access already granted, does not prompt', async () => {
    const folder = createFakeFolder();
    folder.state.requestAnswer = 'denied';

    const granted = await requestFolderAccess(folder);

    expect(granted).toBe(true);
    expect(folder.state.permission).toBe('granted');
  });

  it('with the user accepting, returns true and the folder works again', async () => {
    const folder = createFakeFolder();
    folder.state.permission = 'prompt';

    const granted = await requestFolderAccess(folder);
    const names = await createFolderStorage(folder, { locks: createFakeLocks() }).list('');

    expect(granted).toBe(true);
    expect(names).toEqual([]);
  });

  it('with the user refusing, returns false', async () => {
    const folder = createFakeFolder();
    folder.state.permission = 'prompt';
    folder.state.requestAnswer = 'denied';

    const granted = await requestFolderAccess(folder);

    expect(granted).toBe(false);
  });
});
