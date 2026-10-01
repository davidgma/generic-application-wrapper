export type SyncStatus = 'saved' | 'saving' | 'dirty' | 'conflict' | 'error';

export interface StorageMetadata {
  fileName: string;
  fileSize: number;
  lastSavedAt: Date | null;
  lastModifiedDisk: number | null;
  syncStatus: SyncStatus;
  isFileSystemSupported: boolean;
  hasFileHandle: boolean;
  autoSyncIntervalSec: number;
  isAutoSyncEnabled: boolean;
}

export interface ConflictDetails {
  fileName: string;
  localModifiedAt: Date;
  diskModifiedAt: Date;
  localSize: number;
  diskSize: number;
}

export interface DropboxConfig {
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  currentPath?: string;
  connected: boolean;
  accountEmail?: string;
  accountName?: string;
}
