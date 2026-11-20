# @dloizides/folder-store

Files in a folder the user picks, from a web page. Built on the File System Access API (Chrome and Edge). No backend: data stays in the folder.

```ts
import { createFolderStorage, createHandleMemory, getFolderSupport, pickFolder, reopenFolder, requestFolderAccess, ReopenState } from '@dloizides/folder-store';

if (!getFolderSupport().supported) { /* tell the user; nothing was touched */ }

const memory = createHandleMemory();
const remembered = await reopenFolder(memory);
// ReopenState.Granted: use remembered.handle
// ReopenState.NeedsPermission: from a click, await requestFolderAccess(remembered.handle)
// ReopenState.None: from a click, await pickFolder(memory); null means cancelled

const storage = createFolderStorage(handle);
await storage.writeNew('notes/2030/a.json', '{}');
```

## Storage

Paths are relative with forward slashes; `.` and `..` are refused.

| Method | Behaviour |
|---|---|
| `readText`, `readBytes` | `null` if the file is missing. A lost permission rejects, it never reads as missing |
| `list` | Direct children, sorted; empty if the folder is missing; browser `.crswap` files are hidden |
| `writeNew` | Creates the file and parents; `StorageExistsError` if it exists or another writer holds it |
| `replace` | Creates or overwrites under an exclusive writer; a held file rejects with `NoModificationAllowedError` |
| `remove` | Deletes; nothing if missing |
| `withLock` | Web Lock, so tabs of this origin wait for each other |

`StorageExistsError` is recognised by its `name`, so a consumer's own class of that name works across package copies.

## Recent folders

`createRecentFolders({ appId, indexedDB?, max = 5, now? })` keeps a newest-first list of `{ handle, name, usedAt }` per app, under the key `recent:<appId>` in the same IndexedDB store as the remembered handle.

| Method | Behaviour |
|---|---|
| `list` | The stored list, newest first |
| `remember(handle)` | Moves the folder first (no duplicate), keeps at most `max` |
| `forget(handle)` | Removes the folder |
| `prune(open?)` | Drops folders that are gone (listing fails while granted) or denied, keeps those that only need a prompt; returns `{ kept, dropped, openDropped }` |

Folders are matched with `isSameEntry` when the handle has it, else by name.

## Limits

Web Locks cover the tabs of one browser. A second browser, PC or a command line tool on the same folder is not locked out: `writeNew` narrows that window by re-checking the file after taking the writer, but a sync tool can still make a copy, so callers should detect duplicates afterwards.

## Testing

`@dloizides/folder-store/testing` exports `createFakeFolder` and `createFakeLocks`. Each fake call yields once, so concurrent calls interleave.

## Time-limited reopen and the recent-folder switch (0.3.0)

A remembered handle can stop answering (the folder's drive is gone): `queryPermission` never settles. Pass a limit and the app never waits forever.

```ts
const remembered = await reopenFolder(memory, { answerWithinMs: 3000 }); // NoAnswer: the handle did not answer; offer the folder picker, keep the handle
if (remembered.state === ReopenState.NoAnswer) showChoose(remembered.handle.name);
```

`isFolderGone(error)` is true for NotFoundError, NotAllowedError and NotReadableError. `openRecentFolder(handle, { memory, recents, open, onGone })` switches to a recent folder from a click; a gone folder leaves the list and memory.

React apps take the same switch as a hook from `@dloizides/folder-store/react` (react is an optional peer):

```ts
const { recent, openRecent, remember } = useRecentSwitch({ appId: 'my-app', memory, open, onGone, report }); // report: the message of a failed switch
```
