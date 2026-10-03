import { SQLiteEngine } from './sqliteEngine';
import { ConflictDetails, StorageMetadata, StorageTarget, SyncStatus } from '../types/storage';
import { RecentFilesManager } from './recentFiles';

export class FileStorageEngine {
  private static instance: FileStorageEngine | null = null;
  private fileHandle: FileSystemFileHandle | null = null;
  private lastModifiedDisk: number | null = null;
  private lastSavedAt: Date | null = null;
  private isDirty: boolean = false;
  private syncStatus: SyncStatus = 'saved';
  private autoSyncTimer: any = null;
  private pollingTimer: any = null;
  private conflictCallback: ((conflict: ConflictDetails) => void) | null = null;
  private statusListeners: Set<(meta: StorageMetadata) => void> = new Set();
  private autoSyncIntervalSec: number = 0;
  private isAutoSyncEnabled: boolean = false;
  private activeTarget: StorageTarget =
    typeof window !== 'undefined'
      ? ((localStorage.getItem('gaw_active_storage_target') as StorageTarget) || 'local')
      : 'local';

  private constructor() {
    this.setupBeforeUnload();
    this.startPollingDisk();
    this.startAutoSync();
  }

  public static getInstance(): FileStorageEngine {
    if (!FileStorageEngine.instance) {
      FileStorageEngine.instance = new FileStorageEngine();
    }
    return FileStorageEngine.instance;
  }

  public onStatusChange(listener: (meta: StorageMetadata) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getMetadata());
    return () => this.statusListeners.delete(listener);
  }

  public onConflict(callback: (conflict: ConflictDetails) => void): void {
    this.conflictCallback = callback;
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

  public markDirty(): void {
    if (this.syncStatus !== 'dirty' && this.syncStatus !== 'saving') {
      this.isDirty = true;
      this.syncStatus = 'dirty';
      this.notifyStatus();
    }
  }

  public getActiveTarget(): StorageTarget {
    return this.activeTarget;
  }

  public setActiveTarget(target: StorageTarget): void {
    this.activeTarget = target;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gaw_active_storage_target', target);
    }
    this.notifyStatus();
  }

  public exportDownload(fileName?: string): void {
    const engine = SQLiteEngine.getInstance();
    const binary = engine.exportBinary();
    const baseName = fileName || engine.activeDbName || 'Northwind_Modern.db';
    const name = baseName.endsWith('.db') || baseName.endsWith('.sqlite') || baseName.endsWith('.sqlite3')
      ? baseName
      : `${baseName}.db`;
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
      fileSize = engine.exportBinary().byteLength;
    } catch (e) {
      // not initialized yet
    }

    return {
      fileName: engine.activeDbName,
      fileSize,
      lastSavedAt: this.lastSavedAt,
      lastModifiedDisk: this.lastModifiedDisk,
      syncStatus: this.syncStatus,
      isFileSystemSupported: typeof window !== 'undefined' && 'showOpenFilePicker' in window,
      hasFileHandle: this.fileHandle !== null,
      autoSyncIntervalSec: this.autoSyncIntervalSec,
      isAutoSyncEnabled: this.isAutoSyncEnabled,
      activeTarget: this.activeTarget,
      filePath: (this.fileHandle as any)?.name || engine.activeDbName,
    };
  }

  public setAutoSyncInterval(seconds: number): void {
    this.autoSyncIntervalSec = seconds;
    this.isAutoSyncEnabled = seconds > 0;
    this.startAutoSync();
    this.notifyStatus();
  }

  public setAutoSyncEnabled(enabled: boolean): void {
    this.isAutoSyncEnabled = enabled;
    this.startAutoSync();
    this.notifyStatus();
  }

  // --- Open Database File ---
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

        this.fileHandle = handle;
        this.lastModifiedDisk = file.lastModified;
        this.lastSavedAt = new Date();
        this.isDirty = false;
        this.syncStatus = 'saved';

        const engine = SQLiteEngine.getInstance();
        engine.loadBinary(binary, file.name);

        RecentFilesManager.addRecentFile({
          name: file.name,
          source: 'local',
          size: file.size,
          path: 'Local Disk',
        });

        this.setActiveTarget('local');
        this.notifyStatus();
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') return false;
        console.error('File open error:', err);
        throw err;
      }
    } else {
      // Fallback: standard file picker
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.db,.sqlite,.sqlite3';
        input.onchange = async () => {
          if (input.files && input.files[0]) {
            const file = input.files[0];
            const buffer = await file.arrayBuffer();
            const binary = new Uint8Array(buffer);

            this.fileHandle = null;
            this.lastModifiedDisk = file.lastModified;
            this.lastSavedAt = new Date();
            this.isDirty = false;
            this.syncStatus = 'saved';

            const engine = SQLiteEngine.getInstance();
            engine.loadBinary(binary, file.name);

            RecentFilesManager.addRecentFile({
              name: file.name,
              source: 'local',
              size: file.size,
              path: 'Local Disk',
            });

            this.setActiveTarget('local');
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
    this.lastModifiedDisk = null;
    this.lastSavedAt = null;
    this.isDirty = false;
    this.syncStatus = 'saved';
    this.notifyStatus();
  }

  // --- Save Database ---
  public async save(): Promise<boolean> {
    const engine = SQLiteEngine.getInstance();
    const binary = engine.exportBinary();

    if (this.fileHandle) {
      try {
        this.syncStatus = 'saving';
        this.notifyStatus();

        // Check if file was modified externally before writing
        const file = await this.fileHandle.getFile();
        if (this.lastModifiedDisk && file.lastModified > this.lastModifiedDisk) {
          // External modification detected!
          this.syncStatus = 'conflict';
          this.notifyStatus();

          if (this.conflictCallback) {
            this.conflictCallback({
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
        this.lastSavedAt = new Date();
        this.isDirty = false;
        this.syncStatus = 'saved';
        this.notifyStatus();
        return true;
      } catch (err: any) {
        console.error('Save error:', err);
        this.syncStatus = 'error';
        this.notifyStatus();
        // Fall back to saveAs
        return this.saveAs();
      }
    } else {
      return this.saveAs();
    }
  }

  // --- Save As New File ---
  public async saveAs(suggestedName?: string): Promise<boolean> {
    const engine = SQLiteEngine.getInstance();
    const binary = engine.exportBinary();
    const defaultName = suggestedName || engine.activeDbName || 'database.db';

    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [
            {
              description: 'SQLite Database (*.db)',
              accept: { 'application/vnd.sqlite3': ['.db', '.sqlite'] },
            },
          ],
        });

        const writable = await handle.createWritable();
        await writable.write(binary);
        await writable.close();

        const file = await handle.getFile();
        this.fileHandle = handle;
        this.lastModifiedDisk = file.lastModified;
        this.lastSavedAt = new Date();
        this.isDirty = false;
        this.syncStatus = 'saved';
        engine.activeDbName = file.name;

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
        this.downloadBinary(binary, defaultName);
        return true;
      }
    } else {
      this.downloadBinary(binary, defaultName);
      this.lastSavedAt = new Date();
      this.isDirty = false;
      this.syncStatus = 'saved';
      this.notifyStatus();
      return true;
    }
  }

  public downloadBinary(binary: Uint8Array, fileName: string): void {
    const blob = new Blob([binary as any], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.db') || fileName.endsWith('.sqlite') ? fileName : `${fileName}.db`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // --- Periodic Conflict Polling ---
  private startPollingDisk(): void {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    // Poll every 5 seconds if a native file handle is attached
    this.pollingTimer = setInterval(async () => {
      if (!this.fileHandle || this.syncStatus === 'saving' || this.syncStatus === 'conflict') {
        return;
      }

      try {
        const file = await this.fileHandle.getFile();
        if (this.lastModifiedDisk && file.lastModified > this.lastModifiedDisk) {
          // File has changed on disk!
          this.syncStatus = 'conflict';
          this.notifyStatus();

          const engine = SQLiteEngine.getInstance();
          const binary = engine.exportBinary();

          if (this.conflictCallback) {
            this.conflictCallback({
              fileName: file.name,
              localModifiedAt: this.lastSavedAt || new Date(),
              diskModifiedAt: new Date(file.lastModified),
              localSize: binary.byteLength,
              diskSize: file.size,
            });
          }
        }
      } catch (e) {
        // Disk access might have been lost or revoked
      }
    }, 5000);
  }

  // --- Conflict Resolution Actions ---
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
      this.lastSavedAt = new Date();
      this.isDirty = false;
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

      this.lastModifiedDisk = file.lastModified;
      this.lastSavedAt = new Date();
      this.isDirty = false;
      this.syncStatus = 'saved';

      const engine = SQLiteEngine.getInstance();
      engine.loadBinary(binary, file.name);

      this.notifyStatus();
    } catch (err) {
      console.error('Reload disk error:', err);
    }
  }

  public async resolveConflictSaveCopy(): Promise<void> {
    const engine = SQLiteEngine.getInstance();
    const baseName = engine.activeDbName.replace(/\.(db|sqlite3?)$/i, '');
    const copyName = `${baseName}_copy_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    await this.saveAs(copyName);
  }

  // --- Auto-Save Scheduler ---
  private startAutoSync(): void {
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);

    if (!this.isAutoSyncEnabled || this.autoSyncIntervalSec <= 0) return;

    this.autoSyncTimer = setInterval(async () => {
      // If Dropbox connection is currently in active use, assume no local auto-syncing needed
      if (this.activeTarget !== 'local') return;

      if (this.isDirty && this.fileHandle && this.syncStatus !== 'conflict' && this.syncStatus !== 'saving') {
        await this.save();
      }
    }, this.autoSyncIntervalSec * 1000);
  }

  // --- beforeunload Handler ---
  private setupBeforeUnload(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty) {
        // Attempt quick write if handle exists
        if (this.fileHandle) {
          try {
            // Note: browsers may block async createWritable in beforeunload,
            // but standard confirmation prevents accidental data loss
          } catch (e) {
            // ignore
          }
        }
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in your SQLite database. Do you wish to leave?';
        return e.returnValue;
      }
    });
  }
}
