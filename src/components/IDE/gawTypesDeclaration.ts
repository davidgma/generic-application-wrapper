export const GAW_TYPES_DECLARATION = `
/**
 * Generic Application Wrapper (GAW) Plugin API Definitions
 */
export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

export interface TableSchema {
  name: string;
  type: 'table' | 'view';
  columns: ColumnInfo[];
  rowCount: number;
  isSystem: boolean;
}

export interface QueryResult {
  columns: string[];
  values: any[][];
  execTimeMs?: number;
  rowsAffected?: number;
  sqlQuery?: string;
  error?: string;
}

export interface GAWToastApi {
  /** Display a success notification */
  success: (message: string) => void;
  /** Display an error notification */
  error: (message: string) => void;
  /** Display an informational banner */
  info: (message: string) => void;
  /** Display a warning alert */
  warning: (message: string) => void;
}

export interface GAWDialogApi {
  /** Open a confirmation prompt modal, returns boolean */
  confirm: (message: string) => Promise<boolean>;
  /** Open an alert modal */
  alert: (message: string) => Promise<void>;
  /** Open a text input prompt modal */
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

export interface GAWDatabaseApi {
  /** Execute a SELECT query and return column names and 2D values array */
  query: (sql: string, params?: any[]) => { columns: string[]; values: any[][] };
  /** Execute a SELECT query and return an array of strongly-typed JavaScript objects */
  queryObjects: <T = Record<string, any>>(sql: string, params?: any[]) => T[];
  /** Run an INSERT, UPDATE, or DELETE statement, returns affected row count */
  run: (sql: string, params?: any[]) => { rowsAffected: number };
  /** Execute multi-statement SQL strings and return timing & results */
  exec: (sql: string) => QueryResult[];
  /** List all table names */
  getTables: () => string[];
  /** Retrieve live database schema with column types, primary keys, and row counts */
  getSchema: () => TableSchema[];
  /** Convenience method to inspect table data with optional limit */
  getTableData: (tableName: string, limit?: number) => QueryResult;
}

export interface GAWNavigationApi {
  /** Navigate to an internal route */
  navigate: (route: string) => void;
  /** Open a SQL query in the IDE */
  openQuery: (sql: string) => void;
  /** Open data in the embedded interactive spreadsheet */
  openSpreadsheet: (data: { columns: string[]; values: any[][] }, sheetName?: string) => void;
  /** Open a publication report by ID */
  openReport: (reportId: string) => void;
  /** Open a dynamic plugin view by ID */
  openPlugin: (pluginId: string) => void;
}

export interface GAWEventBusApi {
  /** Subscribe to internal application events ('db_changed', etc.) */
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  /** Emit an internal application event */
  emit: (event: string, ...args: any[]) => void;
}

export interface GAWContext {
  /** Full SQLite database operations */
  db: GAWDatabaseApi;
  /** Toast alerts */
  toast: GAWToastApi;
  /** Dialog modals */
  dialog: GAWDialogApi;
  /** Navigation between IDE, grids, spreadsheet, and reports */
  navigation: GAWNavigationApi;
  /** Inter-plugin pub-sub event bus */
  eventBus: GAWEventBusApi;
  /** Active UI color scheme ('vs-dark' or 'vs-light') */
  theme: 'vs-dark' | 'vs-light';
}

/**
 * Standard GAW Plugin Component Signature
 *
 * Example:
 * \`\`\`tsx
 * import React, { useState, useEffect } from 'react';
 *
 * export default function MyPlugin({ gaw }: { gaw: GAWContext }) {
 *   const [rows, setRows] = useState([]);
 *   useEffect(() => {
 *     const data = gaw.db.queryObjects('SELECT * FROM customers LIMIT 10;');
 *     setRows(data);
 *   }, []);
 *   return <div>Total: {rows.length}</div>;
 * }
 * \`\`\`
 */
`;
