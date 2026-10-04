import React, { useState } from 'react';
import {
  Database,
  Terminal,
  Settings,
  Download,
  RotateCcw,
  Table as TableIcon,
  Play,
  HardDrive,
  CheckCircle2,
  FileCode,
  Layers
} from 'lucide-react';
import { TableSchema } from '../../types/sqlite';
import { SQLiteEngine } from '../../engine/sqliteEngine';
import { FileStorageEngine } from '../../engine/fileStorage';

interface DatabasePaneProps {
  theme: 'vs-dark' | 'vs-light';
  tables: TableSchema[];
  onOpenIDE: (tab?: any) => void;
  onOpenSettings: () => void;
  onResetDefault: () => void;
  onSelectView: (view: string) => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

export const DatabasePane: React.FC<DatabasePaneProps> = ({
  theme,
  tables,
  onOpenIDE,
  onOpenSettings,
  onResetDefault,
  onSelectView,
  onToast,
}) => {
  const isDark = theme === 'vs-dark';

  // PRAGMA diagnostics
  const stats = (() => {
    try {
      const engine = SQLiteEngine.getInstance();
      const pageCount = engine.query('PRAGMA page_count;').values[0]?.[0] || 0;
      const pageSize = engine.query('PRAGMA page_size;').values[0]?.[0] || 4096;
      const schemaVer = engine.query('PRAGMA schema_version;').values[0]?.[0] || 1;
      return { pageCount, pageSize, schemaVer, totalBytes: pageCount * pageSize };
    } catch {
      return { pageCount: 0, pageSize: 4096, schemaVer: 1, totalBytes: 0 };
    }
  })();

  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-6 select-text transition-colors ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-blue-600/20 text-sky-400 border border-blue-500/30' : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}>
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-sky-300' : 'text-blue-950'}`}>
              Database Engine & SQL Management
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Embedded SQLite (sql.js WebAssembly) with in-memory execution and zero-latency local queries.
            </p>
          </div>
        </div>

        {/* Database Primary Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {/* 1. Open SQL Query Editor */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Terminal className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">SQL Query Editor</h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Execute custom SQL statements, JOINs, aggregations, and DDL queries in Monaco editor.
              </p>
            </div>
            <button
              onClick={() => onOpenIDE({ type: 'sql' })}
              className="mt-3 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Open Query Editor</span>
            </button>
          </div>

          {/* 2. Schema & Engine Diagnostics */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-300'
          }`}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-sky-400 border border-blue-500/30 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Engine Diagnostics</h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Inspect PRAGMA settings, database metadata, application title, and storage engine status.
              </p>
            </div>
            <button
              onClick={onOpenSettings}
              className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold border transition active:scale-95 flex items-center justify-center gap-1.5 ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Open Diagnostics</span>
            </button>
          </div>

          {/* 3. Export Database Binary */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Export SQLite Binary</h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Download the raw .db binary file directly to your disk. Opens in DB Browser or standard SQLite tools.
              </p>
            </div>
            <button
              onClick={() => {
                FileStorageEngine.getInstance().exportDownload();
                onToast('success', 'Exported SQLite binary file.');
              }}
              className="mt-3 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .db</span>
            </button>
          </div>

          {/* 4. Reset to Northwind Template */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-red-500/50' : 'bg-white border-slate-200 hover:border-red-300'
          }`}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Reset Database</h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Revert back to the pristine Northwind Modern Commerce sample suite with all initial tables.
              </p>
            </div>
            <button
              onClick={onResetDefault}
              className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold border transition active:scale-95 flex items-center justify-center gap-1.5 ${
                isDark ? 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border-red-800/40' : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Database</span>
            </button>
          </div>
        </div>

        {/* Database Telemetry Stats */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-sky-300/90' : 'text-blue-950'}`}>
            Database Engine Telemetry
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Page Count</span>
              <span className="font-mono font-bold text-sm">{stats.pageCount} pages</span>
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Page Size</span>
              <span className="font-mono font-bold text-sm">{stats.pageSize} bytes</span>
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Storage Size</span>
              <span className="font-mono font-bold text-sm">{(stats.totalBytes / 1024).toFixed(1)} KB</span>
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Schema Version</span>
              <span className="font-mono font-bold text-sm">v{stats.schemaVer}</span>
            </div>
          </div>
        </div>

        {/* Database Tables Explorer */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-sky-300/90' : 'text-blue-950'}`}>
              Database Tables ({tables.length})
            </h3>
            <button
              onClick={() => onOpenIDE({ type: 'sql' })}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              + Create Table in SQL
            </button>
          </div>

          <div className="divide-y divide-slate-800/40 pt-1">
            {tables.map((t) => (
              <div
                key={t.name}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5">
                  <TableIcon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <div>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                      {t.name}
                    </span>
                    <span className={`ml-2 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      ({t.columns.length} columns)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => onSelectView(`table:${t.name}`)}
                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] shadow transition active:scale-95"
                  >
                    View Grid
                  </button>
                  <button
                    onClick={() => onOpenIDE({ type: 'table', name: t.name })}
                    className={`px-2.5 py-1 rounded border text-[11px] font-medium transition active:scale-95 ${
                      isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    Edit Schema
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
