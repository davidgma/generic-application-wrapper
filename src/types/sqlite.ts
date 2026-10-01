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

export interface SavedQuery {
  id: string;
  name: string;
  description: string;
  query: string;
  params?: string;
  layout?: string;
  created_at: string;
}

export interface SettingItem {
  key: string;
  value: string;
  updated_at: string;
}
