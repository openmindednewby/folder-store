import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FolderDirectoryHandle } from '../handles';
import type { HandleMemory } from '../handleMemory';
import type { RecentFolder } from '../recentFolderList';
import type { RecentFolders } from '../recentFolders';
import { createFakeFolder } from '../testing/fakeFolder';
import { useRecentSwitch } from './useRecentSwitch';
import type { RecentSwitchDeps } from './useRecentSwitch';

function fakeRecents(): RecentFolders {
  let list: RecentFolder[] = [];
  const entry = (handle: FolderDirectoryHandle): RecentFolder => ({ handle, name: handle.name, usedAt: 1 });
  return {
    list: async () => list,
    remember: async (handle) => {
      list = [entry(handle), ...list.filter((item) => item.name !== handle.name)];
      return list;
    },
    forget: async (handle) => {
      list = list.filter((item) => item.name !== handle.name);
      return list;
    },
    prune: async () => ({ kept: list, dropped: [], openDropped: false }),
  };
}

function deps(open: RecentSwitchDeps['open'] = async () => undefined): RecentSwitchDeps {
  const memory: HandleMemory = { load: async () => null, save: async () => undefined, forget: async () => undefined };
  return { appId: 'app', memory, open, onGone: vi.fn(), report: vi.fn(), recents: fakeRecents() };
}

describe('useRecentSwitch', () => {
  it('with a folder opened from the list, shows it as the newest recent folder', async () => {
    const switchDeps = deps();
    const { result } = renderHook(() => useRecentSwitch(switchDeps));

    await act(async () => result.current.openRecent(createFakeFolder('Invoices')));

    await waitFor(() => expect(result.current.recent.map((entry) => entry.name)).toEqual(['Invoices']));
  });

  it('with an open that fails, reports the message instead of rejecting', async () => {
    const switchDeps = deps(async () => Promise.reject(new Error('disk full')));
    const { result } = renderHook(() => useRecentSwitch(switchDeps));

    await act(async () => result.current.openRecent(createFakeFolder('Invoices')));

    expect(switchDeps.report).toHaveBeenCalledWith('disk full');
  });

  it('with a folder remembered, lists it', async () => {
    const switchDeps = deps();
    const { result } = renderHook(() => useRecentSwitch(switchDeps));

    await act(async () => result.current.remember(createFakeFolder('Invoices')));

    expect(result.current.recent.map((entry) => entry.name)).toEqual(['Invoices']);
  });
});
