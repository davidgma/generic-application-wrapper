/**
 * Official Documentation:
 * - TypeScript Handbook (Interfaces & Unions): https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 * - File System Access API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 */

export type SyncStatus = 'saved' | 'saving' | 'dirty' | 'conflict' | 'error';

// Storage target is either Clockie H2 Extension Bridge ('h2') or standalone browser local disk ('local')
export type StorageTarget = 'local' | 'h2';

// Supported drives exposed by Clockie H2 Bridge v1.6
export type H2Provider = 'pcloud' | 'gdrive' | 'dropbox' | 'local';
export type H2ProviderFilter = H2Provider | 'all';
export type H2WatchQuality = 'cloud-push' | 'cloud-poll' | 'native' | 'local-poll';
export type H2ReasonCode =
  | 'ORIGIN_NOT_AUTHORIZED'
  | 'ORIGIN_DISABLED'
  | 'BRIDGE_DISABLED'
  | 'UNSUPPORTED_VERSION'
  | 'PRERENDERING'
  | 'SESSION_EXPIRED'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'TIMEOUT'
  | string;

export interface RecentFileItem {
  id: string;
  name: string;
  source: 'local' | 'h2' | 'demo';
  provider?: H2Provider;
  driveRoot?: boolean;
  fileId?: string;
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
  activeTarget: StorageTarget;
  filePath?: string;
  hasUserModifications?: boolean;
  // Clockie H2 summary fields for convenient status display
  h2Connected?: boolean;
  h2Provider?: H2Provider | null;
  h2RelativePath?: string | null;
  h2WatchQuality?: H2WatchQuality | null;
  h2AutoSaveEnabled?: boolean;
}

export interface ConflictDetails {
  source: 'local' | 'h2';
  provider?: H2Provider;
  fileName: string;
  localModifiedAt: Date;
  diskModifiedAt: Date;
  localSize: number;
  diskSize: number;
  remoteRevision?: string | null;
}

// --- Clockie H2 Bridge Protocol v1.6 Types ---

export interface H2DriveInfo {
  connected: boolean;
  visible: boolean;
}

export interface H2Capabilities {
  lazyTree?: boolean;
  lazyRead?: boolean;
  listFolder?: boolean;
  workspaceTreeDepth?: boolean;
  statFile?: boolean;
  observeFiles?: boolean;
  observeFolders?: boolean;
  expectedRevision?: boolean;
  binaryBase64?: boolean;
  maxPayloadBytes?: number;
  multiDrive?: boolean;
  driveRootSwitch?: boolean;
  save?: boolean;
  createFiles?: boolean;
  createFolders?: boolean;
  deleteFiles?: boolean;
  deleteFolders?: boolean;
  moveFiles?: boolean;
  moveFolders?: boolean;
  nativeMove?: boolean;
  crossDriveMove?: boolean;
  trashByDefault?: boolean;
}

export interface H2LaunchedScope {
  provider: H2Provider;
  rootName: string;
  rootFolderId?: string;
  rootPath?: string;
  launchedItemType: 'file' | 'folder' | 'workspace';
  primaryRelativePath?: string;
}

export interface H2ConnectResponse {
  success: boolean;
  sessionId: string | null;
  reasonCode?: H2ReasonCode | null;
  negotiatedVersion?: string;
  sessionMode?: 'launched' | 'direct';
  provider?: H2ProviderFilter;
  rootName?: string;
  launchedItemType?: 'file' | 'folder' | 'workspace';
  primaryRelativePath?: string;
  launchedScope?: H2LaunchedScope | null;
  accessMode?: 'readwrite' | 'readonly';
  drives?: Partial<Record<H2Provider, H2DriveInfo>>;
  capabilities?: H2Capabilities;
  error?: string | null;
}

export interface H2TreeNode {
  name: string;
  type: 'file' | 'folder';
  provider?: H2Provider;
  relativePath: string;
  fileId?: string;
  folderId?: string;
  sizeBytes?: number;
  size?: number;
  modifiedMs?: number;
  revision?: string;
  mimeType?: string;
  childrenLoaded?: boolean;
  children?: H2TreeNode[];
}

export interface H2StatResponse {
  success: boolean;
  exists: boolean;
  itemType?: 'file' | 'folder';
  provider?: H2Provider;
  fileId?: string;
  parentFolderId?: string;
  name?: string;
  relativePath?: string;
  mimeType?: string;
  contentType?: string;
  encoding?: string;
  revision?: string | null;
  sizeBytes?: number;
  modifiedMs?: number;
  error?: string | null;
}

export interface H2ReadResponse {
  success: boolean;
  provider?: H2Provider;
  fileId?: string;
  name?: string;
  relativePath?: string;
  contentType?: 'text' | 'binary';
  encoding?: 'utf-8' | 'base64';
  mimeType?: string;
  content?: string;
  bytes?: Uint8Array;
  revision?: string | null;
  sizeBytes?: number;
  modifiedMs?: number;
  error?: string | null;
}

export interface H2SaveResponse {
  success: boolean;
  provider?: H2Provider;
  fileId?: string;
  relativePath?: string;
  revision?: string | null;
  sizeBytes?: number;
  modifiedMs?: number;
  reasonCode?: string | null;
  currentRevision?: string | null;
  exists?: boolean;
  error?: string | null;
}

export interface H2ObserveFileResponse {
  success: boolean;
  observationId: string;
  provider: H2Provider;
  relativePath: string;
  fileId?: string;
  exists?: boolean;
  revision?: string | null;
  modifiedMs?: number;
  sizeBytes?: number;
  watchQuality?: H2WatchQuality;
  pollIntervalMs?: number;
  debounceMs?: number;
  error?: string | null;
}

export interface H2ObserveFolderResponse {
  success: boolean;
  observationId: string;
  provider: H2Provider;
  relativePath: string;
  folderId?: string;
  recursive?: boolean;
  watchQuality?: H2WatchQuality;
  pollIntervalMs?: number;
  debounceMs?: number;
  error?: string | null;
}

export interface H2FileChangedEvent {
  protocol: 'H2_CLOUD_BRIDGE';
  protocolVersion: string;
  type: 'H2_FILE_CHANGED_EVENT';
  sessionId?: string;
  observationId: string;
  eventType: 'modified' | 'created' | 'deleted' | 'moved' | 'renamed' | 'resync_required' | 'watch_error';
  provider: H2Provider;
  relativePath: string;
  newRelativePath?: string;
  fileId?: string;
  revision?: string | null;
  modifiedMs?: number;
  sizeBytes?: number;
  originSessionId?: string | null;
  originClientName?: string | null;
  timestampMs?: number;
  error?: string;
}

export interface H2FolderChangedEvent {
  protocol: 'H2_CLOUD_BRIDGE';
  protocolVersion: string;
  type: 'H2_FOLDER_CHANGED_EVENT';
  sessionId?: string;
  observationId: string;
  eventType: 'created' | 'modified' | 'deleted' | 'moved' | 'renamed' | 'resync_required' | 'watch_error';
  itemType?: 'file' | 'folder';
  provider: H2Provider;
  watchedRelativePath: string;
  relativePath: string;
  newRelativePath?: string;
  fileId?: string;
  revision?: string | null;
  modifiedMs?: number;
  sizeBytes?: number;
  originSessionId?: string | null;
  originClientName?: string | null;
  timestampMs?: number;
  error?: string;
}

export interface H2ActiveFile {
  provider: H2Provider;
  relativePath: string;
  driveRoot: boolean;
  name: string;
  fileId?: string;
  revision: string | null;
  modifiedMs: number | null;
  sizeBytes: number | null;
  observationId: string | null;
  watchQuality: H2WatchQuality | null;
}

export interface H2BridgeState {
  status: 'disconnected' | 'connecting' | 'connected' | 'unavailable' | 'refused';
  sessionId: string | null;
  sessionMode: 'launched' | 'direct' | null;
  accessMode: 'readwrite' | 'readonly';
  launchedScope: H2LaunchedScope | null;
  drives: Partial<Record<H2Provider, H2DriveInfo>>;
  capabilities: H2Capabilities;
  activeFile: H2ActiveFile | null;
  autoSaveEnabled: boolean;
  lastSyncTime: Date | null;
  error: string | null;
  reasonCode: H2ReasonCode | null;
}
