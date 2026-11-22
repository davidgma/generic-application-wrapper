/**
 * Official Documentation:
 * - File System Access API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 * - IndexedDB API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
 * - Window beforeunload Event (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
 */
import { SQLiteEngine } from './sqliteEngine';
import { ConflictDetails, H2Provider, H2WatchQuality, StorageMetadata, StorageTarget, SyncStatus } from '../types/storage';
import { RecentFilesManager } from './recentFiles';

// IndexedDB helper for remembering a local FileSystemFileHandle across reloads (when permission remains granted)
const IDB_NAME = 'gaw_pwa_storage_db';
const IDB_STORE = 'handles';
const IDB_KEY = 'active_file_handle';

async function getStoredHandle(): Promise<FileSystemFileHandle | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const getReq = store.get(IDB_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function setStoredHandle(handle: FileSystemFileHandle | null): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        if (handle) {
          store.put(handle, IDB_KEY);
        } else {
          store.delete(IDB_KEY);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export interface RemoteSyncStatusSnapshot {
  hasRemote: boolean;
  isSynced: boolean;
  provider?: H2Provider | null;
  relativePath?: string | null;
  watchQuality?: H2WatchQuality | null;
  connected?: boolean;
  autoSaveEnabled?: boolean;
}

/**
 * Lightweight standalone local file storage engine.
 * Provides manual Open / Save (with a pre-save lastModified safety check) / Save As / Export Download
 * without polling timers or FileSystemObserver. Primary multi-drive watching is handled by Clockie H2.
 */
export class FileStorageEngine {
  private static instance: FileStorageEngine | null = null;
  private fileHandle: FileSystemFileHandle | null = null;
  private lastModifiedDisk: number | null = null;
  private lastSavedAt: Date | null = null;

  // Internal modification tracking
  private isDirty: boolean = false;
  private hasUserModifications: boolean = false;
  private internalStateModifiedTime: number | null = null;
  private lastLocalSyncExternalTime: number | null = null;
  private lastLocalSyncInternalTime: number | null = null;

  private syncStatus: SyncStatus = 'saved';
  private activeTarget: StorageTarget = 'h2';
  private conflictCallback: ((conflict: ConflictDetails) => void) | null = null;
  private statusListeners: Set<(meta: StorageMetadata) => void> = new Set();
  private remoteSyncCheckers: Array<(internalModifiedTime: number | null) => RemoteSyncStatusSnapshot> = [];

  private constructor() {
    this.loadPersistedTarget();
    this.restoreStoredHandle();
    this.setupBeforeUnload();

    SQLiteEngine.getInstance().setOnDatabaseReset((name) => {
      this.resetActiveFile(name);
    });
  }

  public static getInstance(): FileStorageEngine {
    if (!FileStorageEngine.instance) {
      FileStorageEngine.instance = new FileStorageEngine();
    }
    return FileStorageEngine.instance;
  }

  private loadPersistedTarget(): void {
    if (typeof window === 'undefined') return;
    try {
      const savedTarget = localStorage.getItem('gaw_active_storage_target');
      if (savedTarget === 'local' || savedTarget === 'h2') {
        this.activeTarget = savedTarget;
      } else {
        this.activeTarget = 'h2';
      }
    } catch {
      this.activeTarget = 'h2';
    }
  }

  private async restoreStoredHandle(): Promise<void> {
    try {
      const handle = await getStoredHandle();
      if (!handle) return;

      if ('queryPermission' in handle) {
        const status = await (handle as any).queryPermission({ mode: 'readwrite' });
        if (status === 'granted') {
          this.fileHandle = handle;
          const file = await handle.getFile();
          this.lastModifiedDisk = file.lastModified;
          this.lastLocalSyncExternalTime = file.lastModified;
          this.notifyStatus();
        } else {
          await setStoredHandle(null);
        }
      } else {
        await setStoredHandle(null);
      }
    } catch {
      await setStoredHandle(null);
    }
  }

  public onStatusChange(listener: (meta: StorageMetadata) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getMetadata());
    return () => this.statusListeners.delete(listener);
  }

  public onConflict(callback: (conflict: ConflictDetails) => void): void {
    this.conflictCallback = callback;
  }

  public notifyExternalStatusUpdate(): void {
    this.notifyStatus();
  }

  private notifyStatus(): void {
    const meta = this.getMetadata();
    this.statusListeners.forEach((fn) => {
      try {
        fn(meta);
      } catch (e) {
        console.error(e);
      }
    });
  }

  public setSyncStatus(status: SyncStatus): void {
    this.syncStatus = status;
    this.notifyStatus();
  }

  public markDirty(isUserAction: boolean = false): void {
    if (isUserAction) {
      this.hasUserModifications = true;
      this.internalStateModifiedTime = Date.now();
    }
    if (this.syncStatus !== 'dirty' && this.syncStatus !== 'saving') {
      this.isDirty = true;
      this.syncStatus = 'dirty';
      this.notifyStatus();
    } else if (isUserAction) {
      this.notifyStatus();
    }
  }

  public setUserModified(val: boolean = true): void {
    this.hasUserModifications = val;
    if (val) {
      this.internalStateModifiedTime = Date.now();
      if (this.syncStatus !== 'dirty') {
        this.isDirty = true;
        this.syncStatus = 'dirty';
      }
    }
    this.notifyStatus();
  }

  public hasModifications(): boolean {
    return this.hasUserModifications;
  }

  public getInternalStateModifiedTime(): number | null {
    return this.internalStateModifiedTime;
  }

  public setInternalStateModifiedTime(time: number | null): void {
    this.internalStateModifiedTime = time;
  }

  public registerRemoteSyncChecker(
    checker: (internalModifiedTime: number | null) => RemoteSyncStatusSnapshot
  ): void {
    this.remoteSyncCheckers.push(checker);
  }

  public hasFileHandle(): boolean {
    return this.fileHandle !== null;
  }

  public isLocalSynced(): boolean {
    if (!this.fileHandle) return true;
    if (this.internalStateModifiedTime === null) return true;
    return this.lastLocalSyncInternalTime !== null && this.lastLocalSyncInternalTime >= this.internalStateModifiedTime;
  }

  public checkIfAllChosenTargetsInSync(): boolean {
    const hasLocal = this.fileHandle !== null;
    const localInSync =
      !hasLocal ||
      (this.lastLocalSyncInternalTime !== null &&
        this.internalStateModifiedTime !== null &&
        this.lastLocalSyncInternalTime >= this.internalStateModifiedTime);

    let allRemotesInSync = true;
    for (const checker of this.remoteSyncCheckers) {
      try {
        const res = checker(this.internalStateModifiedTime);
        if (res.hasRemote && !res.isSynced) {
          allRemotesInSync = false;
        }
      } catch (err) {
        console.error('Remote sync check error:', err);
      }
    }

    return localInSync && allRemotesInSync;
  }

  public hasUnsavedChanges(): boolean {
    if (!this.hasUserModifications || this.internalStateModifiedTime === null) {
      return false;
    }

    const hasLocal = this.fileHandle !== null;
    const localInSync =
      !hasLocal ||
      (this.lastLocalSyncInternalTime !== null &&
        this.lastLocalSyncInternalTime >= this.internalStateModifiedTime);

    let hasAnyRemote = false;
    let allRemotesInSync = true;

    for (const checker of this.remoteSyncCheckers) {
      try {
        const res = checker(this.internalStateModifiedTime);
        if (res.hasRemote) {
          hasAnyRemote = true;
          if (!res.isSynced) {
            allRemotesInSync = false;
          }
        }
      } catch (err) {
        console.error('Remote sync check error:', err);
      }
    }

    if (!hasLocal && !hasAnyRemote) {
      return true;
    }

    return !(localInSync && allRemotesInSync);
  }

  public getActiveTarget(): StorageTarget {
    return this.activeTarget;
  }

  public setActiveTarget(target: StorageTarget): void {
    this.activeTarget = target;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('gaw_active_storage_target', target);
      } catch {
        // ignore
      }
    }
    this.notifyStatus();
  }

  public exportDownload(fileName?: string): void {
    const engine = SQLiteEngine.getInstance();
    const binary = engine.exportBinary();
    const baseName = fileName || engine.activeDbName || 'new_database.sqlite';
    const name =
      baseName.endsWith('.db') || baseName.endsWith('.sqlite') || baseName.endsWith('.sqlite3')
        ? baseName
        : `${baseName}.sqlite`;
    const blob = new Blob([binary as any], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public getMetadata(): StorageMetadata {
    const engine = SQLiteEngine.getInstance();
    let fileSize = 0;
    try {
      fileSize = engine.getByteSize();
    } catch {
      // not initialized yet
    }

    let remoteSnapshot: RemoteSyncStatusSnapshot | null = null;
    for (const checker of this.remoteSyncCheckers) {
      try {
        remoteSnapshot = checker(this.internalStateModifiedTime);
        if (remoteSnapshot.hasRemote || remoteSnapshot.connected) break;
      } catch {
        // ignore
      }
    }

    const activePath =
      remoteSnapshot?.hasRemote && remoteSnapshot.relativePath
        ? remoteSnapshot.relativePath
        : (this.fileHandle as any)?.name || engine.activeDbName;

    return {
      fileName: engine.activeDbName,
      fileSize,
      lastSavedAt: this.lastSavedAt,
      lastModifiedDisk: this.lastModifiedDisk,
      syncStatus: this.syncStatus,
      isFileSystemSupported: typeof window !== 'undefined' && 'showOpenFilePicker' in window,
      hasFileHandle: this.fileHandle !== null,
      activeTarget: remoteSnapshot?.hasRemote ? 'h2' : this.fileHandle ? 'local' : this.activeTarget,
      filePath: activePath,
      hasUserModifications: this.hasUserModifications,
      h2Connected: remoteSnapshot?.connected ?? false,
      h2Provider: remoteSnapshot?.provider ?? null,
      h2RelativePath: remoteSnapshot?.relativePath ?? null,
      h2WatchQuality: remoteSnapshot?.watchQuality ?? null,
      h2AutoSaveEnabled: remoteSnapshot?.autoSaveEnabled ?? false,
    };
  }

  // --- Manual Open Local Database File ---
  public async openFile(): Promise<boolean> {
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'SQLite Database (*.db, *.sqlite, *.sqlite3)',
              accept: {
                'application/vnd.sqlite3': ['.db', '.sqlite', '.sqlite3'],
                'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'],
                'application/octet-stream': ['.db', '.sqlite', '.sqlite3'],
              },
            },
          ],
          multiple: false,
        });

        const file = await handle.getFile();
        const buffer = await file.arrayBuffer();
        const binary = new Uint8Array(buffer);

        const engine = SQLiteEngine.getInstance();
        engine.loadBinary(binary, file.name);

        this.fileHandle = handle;
        setStoredHandle(handle);

        this.lastModifiedDisk = file.lastModified;
        this.lastLocalSyncExternalTime = file.lastModified;
        this.lastLocalSyncInternalTime = 0;
        this.lastSavedAt = new Date();
        this.isDirty = false;
        this.hasUserModifications = false;
        this.internalStateModifiedTime = null;
        this.syncStatus = 'saved';
        this.activeTarget = 'local';

        RecentFilesManager.addRecentFile({
          name: file.name,
          source: 'local',
          size: file.size,
          path: 'Local Disk',
        });

        this.notifyStatus();
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') return false;
        console.error('File open error:', err);
        throw err;
      }
    } else {
      // Fallback standard <input type="file"> for mobile / Firefox / Safari
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.db,.sqlite,.sqlite3';
        input.onchange = async () => {
          if (input.files && input.files[0]) {
            const file = input.files[0];
            const buffer = await file.arrayBuffer();
            const binary = new Uint8Array(buffer);

            const engine = SQLiteEngine.getInstance();
            engine.loadBinary(binary, file.name);

            this.fileHandle = null;
            setStoredHandle(null);

            this.lastModifiedDisk = file.lastModified;
            this.lastLocalSyncExternalTime = file.lastModified;
            this.lastLocalSyncInternalTime = 0;
            this.lastSavedAt = new Date();
            this.isDirty = false;
            this.hasUserModifications = false;
            this.internalStateModifiedTime = null;
            this.syncStatus = 'saved';
            this.activeTarget = 'local';

            RecentFilesManager.addRecentFile({
              name: file.name,
              source: 'local',
              size: file.size,
              path: 'Local Disk',
            });

            this.notifyStatus();
            resolve(true);
          } else {
            resolve(false);
          }
        };
        input.click();
      });
    }
  }

  public closeFile(): void {
    this.fileHandle = null;
    setStoredHandle(null);
    this.lastModifiedDisk = null;
    this.lastSavedAt = null;
    this.lastLocalSyncExternalTime = null;
    this.lastLocalSyncInternalTime = null;
    this.isDirty = false;
    this.hasUserModifications = false;
    this.internalStateModifiedTime = null;
    this.syncStatus = 'saved';
    this.notifyStatus();
  }

  public resetActiveFile(dbName: string = 'new_database.sqlite'): void {
    this.fileHandle = null;
    setStoredHandle(null);
    this.lastModifiedDisk = null;
    this.lastSavedAt = null;
    this.lastLocalSyncExternalTime = null;
    this.lastLocalSyncInternalTime = null;
    this.isDirty = false;
    this.hasUserModifications = false;
    this.internalStateModifiedTime = null;
    this.syncStatus = 'saved';
    const engine = SQLiteEngine.getInstance();
    engine.activeDbName = dbName;
    this.notifyStatus();
  }

  public setFileName(name: string): void {
    const engine = SQLiteEngine.getInstance();
    engine.activeDbName = name;
    this.notifyStatus();
  }

  public markSaved(): void {
    this.isDirty = false;
    this.hasUserModifications = false;
    this.internalStateModifiedTime = null;
    this.syncStatus = 'saved';
    this.lastSavedAt = new Date();
    this.notifyStatus();
  }

  // --- Manual Save Database (Local File, with pre-save external timestamp check) ---
  public async save(): Promise<boolean> {
    const engine = SQLiteEngine.getInstance();
    const binary = engine.exportBinary();

    if (this.fileHandle) {
      try {
        this.syncStatus = 'saving';
        this.notifyStatus();

        // Simple pre-save safety check: avoid overwriting if the file changed on disk since last open/save
        const file = await this.fileHandle.getFile();
        if (this.lastLocalSyncExternalTime && file.lastModified > this.lastLocalSyncExternalTime) {
          this.syncStatus = 'conflict';
          this.notifyStatus();

          if (this.conflictCallback) {
            this.conflictCallback({
              source: 'local',
              fileName: file.name,
              localModifiedAt: this.lastSavedAt || new Date(),
              diskModifiedAt: new Date(file.lastModified),
              localSize: binary.byteLength,
              diskSize: file.size,
            });
          }
          return false;
        }

        const writable = await (this.fileHandle as any).createWritable();
        await writable.write(binary);
        await writable.close();

        const updatedFile = await this.fileHandle.getFile();
        this.lastModifiedDisk = updatedFile.lastModified;
        this.lastLocalSyncExternalTime = updatedFile.lastModified;
        this.lastLocalSyncInternalTime = this.internalStateModifiedTime || Date.now();
        this.lastSavedAt = new Date();

        if (this.checkIfAllChosenTargetsInSync()) {
          this.isDirty = false;
          this.hasUserModifications = false;
          this.syncStatus = 'saved';
        } else {
          this.syncStatus = 'dirty';
        }
        this.notifyStatus();
        return true;
      } catch (err: any) {
        console.error('Save error:', err);
        this.syncStatus = 'error';
        this.notifyStatus();
        return this.saveAs();
      }
    } else {
      return this.saveAs();
    }
  }

  // --- Manual Save As (Local File) ---
  public async saveAs(suggestedName?: string): Promise<boolean> {
    const engine = SQLiteEngine.getInstance();
    const binary = engine.exportBinary();
    const defaultName = suggestedName || engine.activeDbName || 'new_database.sqlite';
    const cleanName =
      defaultName.endsWith('.db') || defaultName.endsWith('.sqlite') || defaultName.endsWith('.sqlite3')
        ? defaultName
        : `${defaultName}.sqlite`;

    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: cleanName,
          types: [
            {
              description: 'SQLite Database (*.db, *.sqlite)',
              accept: { 'application/vnd.sqlite3': ['.db', '.sqlite'] },
            },
          ],
        });

        const writable = await handle.createWritable();
        await writable.write(binary);
        await writable.close();

        const file = await handle.getFile();
        this.fileHandle = handle;
        setStoredHandle(handle);

        this.lastModifiedDisk = file.lastModified;
        this.lastLocalSyncExternalTime = file.lastModified;
        this.lastLocalSyncInternalTime = this.internalStateModifiedTime || Date.now();
        this.lastSavedAt = new Date();
        engine.activeDbName = file.name;
        this.activeTarget = 'local';

        if (this.checkIfAllChosenTargetsInSync()) {
          this.isDirty = false;
          this.hasUserModifications = false;
          this.syncStatus = 'saved';
        } else {
          this.syncStatus = 'dirty';
        }

        RecentFilesManager.addRecentFile({
          name: file.name,
          source: 'local',
          size: file.size,
          path: 'Local Disk',
        });

        this.notifyStatus();
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') return false;
        console.error('SaveAs error:', err);
        this.downloadBinary(binary, cleanName);
        engine.activeDbName = cleanName;
        this.notifyStatus();
        return true;
      }
    } else {
      this.downloadBinary(binary, cleanName);
      engine.activeDbName = cleanName;
      this.lastSavedAt = new Date();
      this.isDirty = false;
      this.hasUserModifications = false;
      this.syncStatus = 'saved';
      RecentFilesManager.addRecentFile({
        name: cleanName,
        source: 'local',
        size: binary.byteLength,
        path: 'Downloads',
      });
      this.notifyStatus();
      return true;
    }
  }

  public downloadBinary(binary: Uint8Array, fileName: string): void {
    const blob = new Blob([binary as any], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.db') || fileName.endsWith('.sqlite') ? fileName : `${fileName}.sqlite`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // --- Conflict Resolution Actions (Local File) ---
  public async resolveConflictKeepLocal(): Promise<void> {
    if (!this.fileHandle) return;
    try {
      this.syncStatus = 'saving';
      this.notifyStatus();

      const engine = SQLiteEngine.getInstance();
      const binary = engine.exportBinary();

      const writable = await (this.fileHandle as any).createWritable();
      await writable.write(binary);
      await writable.close();

      const updatedFile = await this.fileHandle.getFile();
      this.lastModifiedDisk = updatedFile.lastModified;
      this.lastLocalSyncExternalTime = updatedFile.lastModified;
      this.lastLocalSyncInternalTime = this.internalStateModifiedTime;
      this.lastSavedAt = new Date();
      this.isDirty = false;
      this.hasUserModifications = false;
      this.syncStatus = 'saved';
      this.notifyStatus();
    } catch (err) {
      console.error('Resolve conflict error:', err);
      this.syncStatus = 'error';
      this.notifyStatus();
    }
  }

  public async resolveConflictReloadDisk(): Promise<void> {
    if (!this.fileHandle) return;
    try {
      const file = await this.fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      const binary = new Uint8Array(buffer);

      const engine = SQLiteEngine.getInstance();
      engine.loadBinary(binary, file.name, { preserveExternalBinding: true });

      this.lastModifiedDisk = file.lastModified;
      this.lastLocalSyncExternalTime = file.lastModified;
      this.lastLocalSyncInternalTime = null;
      this.internalStateModifiedTime = null;
      this.hasUserModifications = false;
      this.lastSavedAt = new Date();
      this.isDirty = false;
      this.syncStatus = 'saved';

      this.notifyStatus();
    } catch (err) {
      console.error('Reload disk error:', err);
    }
  }

  public async resolveConflictSaveCopy(): Promise<void> {
    const engine = SQLiteEngine.getInstance();
    const baseName = engine.activeDbName.replace(/\.(db|sqlite3?)$/i, '');
    const copyName = `${baseName}_copy_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
    await this.saveAs(copyName);
  }

  private setupBeforeUnload(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in your SQLite database. Do you wish to leave?';
        return e.returnValue;
      }
    });
  }
}
