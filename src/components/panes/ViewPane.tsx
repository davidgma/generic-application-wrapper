import React from 'react';
import {
  FileSpreadsheet,
  FileCode,
  Code2,
  Table as TableIcon,
  Search,
  FileText,
  Play,
  ArrowRight,
  Sparkles,
  Layers,
  LayoutGrid,
  PanelLeft
} from 'lucide-react';
import { TableSchema, SavedQuery } from '../../types/sqlite';
import { SavedReport } from '../../types/report';
import { PluginRecord } from '../../types/plugin';

interface ViewPaneProps {
  theme: 'vs-dark' | 'vs-light';
  tables: TableSchema[];
  queries: SavedQuery[];
  reports: SavedReport[];
  plugins: PluginRecord[];
  isVSCodeMode: boolean;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenSpreadsheet: () => void;
  onOpenIDE: (tab?: any) => void;
  onToggleVSCodeMode: () => void;
  onSelectView: (view: string) => void;
}

export const ViewPane: React.FC<ViewPaneProps> = ({
  theme,
  tables,
  queries,
  reports,
  plugins,
  isVSCodeMode,
  isSidebarOpen = true,
  onToggleSidebar,
  onOpenSpreadsheet,
  onOpenIDE,
  onToggleVSCodeMode,
  onSelectView,
}) => {
  const isDark = theme === 'vs-dark';

  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-6 select-text transition-colors ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Header with Navigation Side Panel Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDark ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}>
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>
                View & Workspace Panes
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Access spreadsheet studio, code editor, active datasets, and interactive reports.
              </p>
            </div>
          </div>

          {/* Show Navigation Side Panel Toggle */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer ${
                isSidebarOpen
                  ? isDark
                    ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300 hover:bg-indigo-600/40'
                    : 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                  : isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750 hover:text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
              title={isSidebarOpen ? 'Hide Navigation Side Panel' : 'Show Navigation Side Panel'}
            >
              <PanelLeft className="w-4 h-4" />
              <span>{isSidebarOpen ? 'Hide Navigation Side Panel' : 'Show Navigation Side Panel'}</span>
            </button>
          )}
        </div>

        {/* Primary View Studios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* Spreadsheet Studio */}
          <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Spreadsheet Studio</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Full multi-tab spreadsheet with Excel formulas, formatting, sorting, and .xlsx import/export.
              </p>
            </div>
            <button
              onClick={onOpenSpreadsheet}
              className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Open Spreadsheet</span>
            </button>
          </div>

          {/* Internal Monaco IDE */}
          <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <FileCode className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monaco Code IDE</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                In-browser Monaco editor with TypeScript autocomplete, live TSX compiling, and SQLite query runner.
              </p>
            </div>
            <button
              onClick={() => onOpenIDE()}
              className="mt-4 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <FileCode className="w-4 h-4" />
              <span>Open Monaco IDE</span>
            </button>
          </div>

          {/* Full Monaco IDE Studio Layout */}
          <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-300'
          }`}>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-sky-400 border border-blue-500/30 flex items-center justify-center">
                <Code2 className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monaco IDE Mode</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-900/40 text-sky-300 border border-blue-700/50">
                  Ctrl+Shift+F
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Switch the entire application into full desktop developer mode with activity bar and terminal bar.
              </p>
            </div>
            <button
              onClick={onToggleVSCodeMode}
              className="mt-4 w-full py-2.5 rounded-xl font-semibold text-xs border shadow transition active:scale-95 flex items-center justify-center gap-1.5 bg-blue-600 text-white border-blue-500 hover:bg-blue-500 cursor-pointer"
            >
              <Code2 className="w-4 h-4" />
              <span>Launch Monaco IDE (Full Screen)</span>
            </button>
          </div>
        </div>

        {/* Quick Launch Active Plugins */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-sky-300/90' : 'text-blue-700'}`}>
              Dynamic TSX Plugins
            </h3>
            <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {plugins.filter((p) => p.enabled !== 0).length} active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-3">
            {plugins
              .filter((p) => p.enabled !== 0)
              .map((plugin) => (
                <button
                  key={plugin.id}
                  onClick={() => onSelectView(`plugin:${plugin.id}`)}
                  className={`p-3 rounded-xl border text-left transition flex items-center justify-between group active:scale-98 ${
                    isDark ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-850' : 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-white'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {plugin.name}
                    </p>
                    <p className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {plugin.menu_category || 'Plugin'}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition flex-shrink-0" />
                </button>
              ))}
          </div>
        </div>

        {/* Quick Launch Tables */}
        {tables.length > 0 && (
          <div className={`p-4 md:p-5 rounded-2xl border shadow-sm ${
            isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-sky-300/90' : 'text-blue-700'}`}>
              Database Tables
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => onSelectView(`table:${table.name}`)}
                  className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between text-xs font-medium ${
                    isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="font-mono truncate">{table.name}</span>
                  <TableIcon className="w-3 h-3 text-indigo-400 flex-shrink-0 ml-1" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
