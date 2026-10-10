import React from 'react';
import { QueryResult, TableSchema } from './sqlite';
import { StorageMetadata, DropboxConfig, StorageTarget, RecentFileItem } from './storage';

export const SYSTEM_PLUGIN_IDS = new Set<string>([
  'plugin_dropbox_sync',
  'plugin_local_storage',
  'plugin_manager',
  'plugin_file_manager',
  'plugin_database_management',
  'plugin_help',
]);

export function isSystemPlugin(plugin: { id: string; is_system?: boolean; isSystem?: boolean; menu_category?: string }): boolean {
  return (
    SYSTEM_PLUGIN_IDS.has(plugin.id) ||
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
  openQuery: (sql: string) => void;
  openSpreadsheet: (data: { columns: string[]; values: any[][] }, sheetName?: string) => void;
  openReport: (reportId: string) => void;
  openPlugin: (pluginId: string) => void;
  openIDE: (tab?: { type: 'plugin' | 'table' | 'query' | 'report' | 'sql'; id?: string; name?: string }) => void;
  openAI?: () => void;
  openSettings?: () => void;
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
  openFile: () => Promise<boolean>;
  exportDownload: (fileName?: string) => void;
  setAutoSyncInterval: (seconds: number) => void;
  setAutoSyncEnabled: (enabled: boolean) => void;
  setActiveTarget: (target: StorageTarget) => void;
  onStatusChange: (listener: (meta: StorageMetadata) => void) => () => void;
}

export interface GAWDropboxApi {
  getConfig: () => DropboxConfig;
  setAccessToken: (token: string) => Promise<boolean>;
  setClientId: (clientId: string) => void;
  disconnect: () => void;
  validateToken: () => Promise<boolean>;
  initiateOAuthFlow: (clientId: string, redirectUri: string) => Promise<void>;
  listDatabaseFiles: (folderPath?: string) => Promise<any[]>;
  downloadFile: (fileItem: any) => Promise<boolean>;
  uploadActiveDatabase: (targetPath?: string) => Promise<any>;
  save: () => Promise<any>;
  saveAs: (suggestedName?: string) => Promise<any>;
  setAutoSyncInterval: (seconds: number) => void;
  setAutoSyncEnabled: (enabled: boolean) => void;
  setActiveTarget: (target: StorageTarget) => void;
  subscribe: (listener: (cfg: DropboxConfig) => void) => () => void;
  getCurrentRemoteFile: () => any;
  getLastSyncTime: () => Date | null;
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
  plugin: PluginRecord;
  storage: GAWStorageApi;
  dropbox: GAWDropboxApi;
  plugins: GAWPluginsApi;
  workspace: GAWWorkspaceApi;
}

export type GAWPluginComponent = React.ComponentType<{ gaw: GAWContext }>;
