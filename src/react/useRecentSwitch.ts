import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FolderDirectoryHandle } from '../handles';
import type { HandleMemory } from '../handleMemory';
import { openRecentFolder } from '../openRecentFolder';
import type { RecentFolder } from '../recentFolderList';
import { createRecentFolders } from '../recentFolders';
import type { RecentFolders } from '../recentFolders';

export interface RecentSwitch {
  recents: RecentFolders;
  recent: RecentFolder[];
  refresh: () => Promise<void>;
  remember: (handle: FolderDirectoryHandle) => Promise<void>;
  openRecent: (handle: FolderDirectoryHandle) => Promise<void>;
}

export interface RecentSwitchDeps {
  appId: string;
  memory: HandleMemory;
  open: (handle: FolderDirectoryHandle) => Promise<void>;
  onGone: (name: string) => void;
  report: (error: string) => void;
  recents?: RecentFolders;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Keeps the recent folders list and switches to one; a folder that is gone leaves the list, a failure goes to `report`. */
export function useRecentSwitch({ appId, memory, open, onGone, report, recents: given }: RecentSwitchDeps): RecentSwitch {
  const recents = useMemo(() => given ?? createRecentFolders({ appId }), [appId, given]);
  const [recent, setRecent] = useState<RecentFolder[]>([]);
  const refresh = useCallback(async () => {
    setRecent((await recents.prune()).kept);
  }, [recents]);
  const remember = useCallback(
    async (handle: FolderDirectoryHandle) => {
      setRecent(await recents.remember(handle));
    },
    [recents]
  );
  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);
  const openRecent = useCallback(
    async (handle: FolderDirectoryHandle) => {
      try {
        const next = await openRecentFolder(handle, { memory, recents, open, onGone });
        if (next !== null) {
          setRecent(next);
        }
      } catch (error) {
        report(messageOf(error));
      }
    },
    [memory, onGone, open, recents, report]
  );
  return { recents, recent, refresh, remember, openRecent };
}
