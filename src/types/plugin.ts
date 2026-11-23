/**
 * Official Documentation:
 * - TypeScript Handbook (Interfaces & Types): https://www.typescriptlang.org/docs/handbook/2/objects.html
 * - React TypeScript Cheatsheet: https://react.dev/learn/typescript
 */
import React from 'react';
import { QueryResult, TableSchema } from './sqlite';
import {
  StorageMetadata,
  StorageTarget,
  RecentFileItem,
  H2BridgeState,
  H2Provider,
  H2ProviderFilter,
  H2StatResponse,
  H2ReadResponse,
  H2SaveResponse,
  H2ObserveFileResponse,
  H2ObserveFolderResponse,
  H2FileChangedEvent,
  H2FolderChangedEvent,
} from './storage';

export const SYSTEM_PLUGIN_IDS = new Set<string>([
  'plugin_clockie_h2',
  'plugin_local_storage',
  'plugin_manager',
  'plugin_file_manager',
  'plugin_database_management',
  'plugin_help',
  'plugin_header_navbar',
  'plugin_components_list',
  'plugin_footer_status',
  'plugin_settings',
  'plugin_debugging',
  'plugin_ai_spec_generator',
  'plugin_spreadsheet_studio',
]);

// Legacy system plugin IDs removed in newer Gawkyy versions so opened databases are automatically cleaned
export const DEPRECATED_SYSTEM_PLUGIN_IDS = new Set<string>([
  'plugin_dropbox_sync',
]);

export function isSystemPlugin(plugin: { id: string; is_system?: boolean; isSystem?: boolean; menu_category?: string }): boolean {
  return (
    SYSTEM_PLUGIN_IDS.has(plugin.id) ||
    DEPRECATED_SYSTEM_PLUGIN_IDS.has(plugin.id) ||
    Boolean(plugin.is_system) ||
    Boolean(plugin.isSystem) ||
    (Boolean(plugin.menu_category) && plugin.menu_category!.startsWith('System'))
  );
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  enabled: number; // 1 or 0
  icon: string;
  menu_category: string;
  route: string;
  description: string;
  code: string; // TSX / TypeScript source code
  created_at?: string;
  updated_at?: string;
  is_system?: boolean;
  isSystem?: boolean;
  target_area?: 'top' | 'bottom' | 'left' | 'right' | 'middle' | string;
  targetArea?: 'top' | 'bottom' | 'left' | 'right' | 'middle' | string;
}

export interface GAWToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

export interface GAWDialogApi {
  confirm: (message: string) => Promise<boolean>;
  alert: (message: string) => Promise<void>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

export interface GAWDatabaseApi {
  query: (sql: string, params?: any[]) => { columns: string[]; values: any[][] };
  queryObjects: <T = Record<string, any>>(sql: string, params?: any[]) => T[];
  run: (sql: string, params?: any[]) => { rowsAffected: number };
  exec: (sql: string) => QueryResult[];
  getTables: () => string[];
  getSchema: () => TableSchema[];
  getTableData: (tableName: string, limit?: number) => QueryResult;
}

export interface GAWNavigationApi {
  navigate: (route: string) => void;
  selectView?: (view: string) => void;
  openQuery: (sql: string) => void;
  openSpreadsheet: (data: { columns: string[]; values: any[][] }, sheetName?: string) => void;
  openReport: (reportId: string) => void;
  openPlugin: (pluginId: string) => void;
  openIDE: (tab?: { type: 'plugin' | 'table' | 'query' | 'report' | 'sql'; id?: string; name?: string }) => void;
  openAI?: () => void;
  openSettings?: () => void;
  toggleTheme?: () => void;
  // Supports switching between IDE mode and App mode ('dev' kept as alias for 'ide')
  setMode?: (mode: 'ide' | 'app' | 'dev') => void;
}

export interface GAWEventBusApi {
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  emit: (event: string, ...args: any[]) => void;
}

export interface GAWStorageApi {
  getMetadata: () => StorageMetadata;
  save: () => Promise<boolean>;
  saveAs: (suggestedName?: string) => Promise<boolean>;
  setFileName?: (fileName: string) => void;
  markDirty?: () => void;
  openFile: () => Promise<boolean>;
  exportDownload: (fileName?: string) => void;
  setActiveTarget: (target: StorageTarget) => void;
  onStatusChange: (listener: (meta: StorageMetadata) => void) => () => void;
}

// Clockie H2 Extension Bridge v1.6 API exposed to all Gawkyy plugins & user apps
export interface GAWBridgeApi {
  getState: () => H2BridgeState;
  subscribe: (listener: (state: H2BridgeState) => void) => () => void;
  connect: () => Promise<boolean>;
  reconnect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  setAutoSaveEnabled: (enabled: boolean) => void;

  // SQLite Database Operations via Clockie H2
  openDatabase: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
    name?: string;
  }) => Promise<boolean>;
  saveDatabase: () => Promise<boolean>;
  saveDatabaseAs: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    overwrite?: boolean;
  }) => Promise<boolean>;

  // General File & Folder Operations for user-built Gawkyy apps
  requestTree: (opts?: {
    provider?: H2ProviderFilter;
    driveRoot?: boolean;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  }) => Promise<any>;
  switchDriveRoot: (provider: H2Provider, maxDepth?: number) => Promise<any>;
  listFolder: (opts?: {
    provider?: H2ProviderFilter;
    driveRoot?: boolean;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  }) => Promise<any>;
  statFile: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
  }) => Promise<H2StatResponse>;
  readFile: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
    encoding?: 'utf-8' | 'base64';
  }) => Promise<H2ReadResponse>;
  readBinaryFile: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
  }) => Promise<H2ReadResponse & { bytes: Uint8Array }>;
  saveFile: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
    mimeType?: string;
    contentType?: 'text' | 'binary';
    encoding?: 'utf-8' | 'base64';
    content: string;
    expectedRevision?: string;
  }) => Promise<H2SaveResponse>;
  saveBinaryFile: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
    mimeType?: string;
    bytes: Uint8Array;
    expectedRevision?: string;
  }) => Promise<H2SaveResponse>;
  createFolder: (opts: {
    provider: H2Provider;
    relativePath?: string;
    parentRelativePath?: string;
    parentFolderId?: string;
    folderName?: string;
    driveRoot?: boolean;
  }) => Promise<any>;
  deleteFile: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
    permanent?: boolean;
  }) => Promise<any>;
  deleteFolder: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    folderId?: string;
    permanent?: boolean;
  }) => Promise<any>;
  deleteItem: (opts: {
    provider: H2Provider;
    itemType?: 'file' | 'folder';
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
    folderId?: string;
    permanent?: boolean;
  }) => Promise<any>;
  moveFile: (opts: {
    provider: H2Provider;
    targetProvider?: H2Provider;
    relativePath: string;
    targetRelativePath?: string;
    targetParentPath?: string;
    newName?: string;
    driveRoot?: boolean;
    fileId?: string;
    overwrite?: boolean;
  }) => Promise<any>;
  moveFolder: (opts: {
    provider: H2Provider;
    targetProvider?: H2Provider;
    relativePath: string;
    targetRelativePath?: string;
    targetParentPath?: string;
    newName?: string;
    driveRoot?: boolean;
    folderId?: string;
    overwrite?: boolean;
  }) => Promise<any>;
  observeFile: (opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
    pollIntervalMs?: number;
    debounceMs?: number;
  }) => Promise<H2ObserveFileResponse>;
  observeFolder: (opts: {
    provider: H2Provider;
    relativePath?: string;
    driveRoot?: boolean;
    folderId?: string;
    recursive?: boolean;
    pollIntervalMs?: number;
    debounceMs?: number;
  }) => Promise<H2ObserveFolderResponse>;
  unobserve: (observationIdOrOptions?: string | { observationId?: string; all?: boolean }) => Promise<any>;
  onFileChanged: (handler: (event: H2FileChangedEvent) => void) => () => void;
  onFolderChanged: (handler: (event: H2FolderChangedEvent) => void) => () => void;
}

export interface GAWPluginsApi {
  getAll: () => PluginRecord[];
  toggleEnabled: (pluginId: string, enabled: boolean) => void;
  delete: (pluginId: string) => void;
  importPlugin: (plugin: Partial<PluginRecord>) => void;
  setTargetArea: (pluginId: string, area: 'top' | 'bottom' | 'left' | 'right' | 'middle' | 'not_shown') => void;
  openInIDE: (pluginId: string, name?: string) => void;
  openAddModal: () => void;
}

export interface GAWWorkspaceApi {
  toggleSidebar: () => void;
  openSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  isSidebarOpen: () => boolean;
  getTables?: () => TableSchema[];
  getQueries?: () => any[];
  getReports?: () => any[];
  getPlugins?: () => PluginRecord[];
  newTable?: () => void;
  newView?: () => void;
  newQuery?: () => void;
  newReport?: () => void;
  deleteObject?: (type: 'plugin' | 'table' | 'query' | 'report', id: string, name: string) => void;
  getRecentFiles: () => RecentFileItem[];
  addRecentFile: (item: Omit<RecentFileItem, 'id' | 'lastOpened'> & { id?: string; lastOpened?: string }) => void;
  removeRecentFile: (id: string) => void;
  clearRecentFiles: () => void;
  loadNorthwindDemo: () => void;
  closeDatabase: () => Promise<void>;
  createNewDatabase?: (name?: string, title?: string, company?: string) => void;
  getSetting?: (key: string, defaultValue?: string) => string;
  setSetting?: (key: string, value: string) => void;
}

export interface GAWContext {
  db: GAWDatabaseApi;
  toast: GAWToastApi;
  dialog: GAWDialogApi;
  navigation: GAWNavigationApi;
  eventBus: GAWEventBusApi;
  theme: 'vs-dark' | 'vs-light';
  mode?: 'ide' | 'app';
  activeRoute?: string;
  activeView?: string;
  appName?: string;
  appDescription?: string;
  plugin: PluginRecord;
  storage: GAWStorageApi;
  bridge: GAWBridgeApi;
  plugins: GAWPluginsApi;
  workspace: GAWWorkspaceApi;
}

export type GAWPluginComponent = React.ComponentType<{ gaw: GAWContext }>;
