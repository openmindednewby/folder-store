# Changelog

## 0.2.0

- `createRecentFolders({ appId, indexedDB?, max = 5, now? })`: per-app recent folder list (`list`, `remember`, `forget`, `prune(open?)`), kept under `recent:<appId>` in the existing handles store, no database version change. `prune` drops folders that are gone (listing throws while granted) or denied, keeps those that only need a prompt, and reports `openDropped`.
- Optional `isSameEntry` on `FolderDirectoryHandle`.

## 0.1.1

- Test file split; no behaviour change.

## 0.1.0

First release: folder storage, remembered handle, re-permission, support check, Web Locks across tabs, exclusive writes, a fake folder and fake locks for tests.
