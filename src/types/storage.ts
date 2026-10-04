export type SyncStatus = 'saved' | 'saving' | 'dirty' | 'conflict' | 'error';
export type StorageTarget = 'local' | 'dropbox';

export interface RecentFileItem {
  id: string;
  name: string;
  source: 'local' | 'dropbox' | 'demo';
  path?: string;
  size?: number;
  lastOpened: string; // ISO timestamp
}

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
  activeTarget: StorageTarget;
  filePath?: string;
  hasUserModifications?: boolean;
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
  lastSyncTime?: Date | null;
  autoSyncIntervalSec?: number;
  isAutoSyncEnabled?: boolean;
  activeTarget?: StorageTarget;
}
