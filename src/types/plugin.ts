import React from 'react';
import { QueryResult, TableSchema } from './sqlite';

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
}

export interface GAWEventBusApi {
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  emit: (event: string, ...args: any[]) => void;
}

export interface GAWContext {
  db: GAWDatabaseApi;
  toast: GAWToastApi;
  dialog: GAWDialogApi;
  navigation: GAWNavigationApi;
  eventBus: GAWEventBusApi;
  theme: 'vs-dark' | 'vs-light';
  plugin: PluginRecord;
}

export type GAWPluginComponent = React.ComponentType<{ gaw: GAWContext }>;
