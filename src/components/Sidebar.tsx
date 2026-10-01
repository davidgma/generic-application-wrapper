import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileCode,
  FileSpreadsheet,
  FileText,
  Layers,
  Plus,
  Search,
  Table as TableIcon,
  Eye,
  Sliders,
  Users,
  Boxes,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { TableSchema, SavedQuery } from '../types/sqlite';
import { PluginRecord } from '../types/plugin';
import { SavedReport } from '../types/report';

interface SidebarProps {
  tables: TableSchema[];
  queries: SavedQuery[];
  reports: SavedReport[];
  plugins: PluginRecord[];
  activeView: string;
  onSelectTable: (tableName: string) => void;
  onSelectQuery: (query: SavedQuery) => void;
  onSelectReport: (report: SavedReport) => void;
  onSelectPlugin: (plugin: PluginRecord) => void;
  onOpenSpreadsheet: () => void;
  onOpenIDE: (tab?: any) => void;
  onNewReport: () => void;
  onOpenAI: () => void;
  theme?: 'vs-dark' | 'vs-light';
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  tables,
  queries,
  reports,
  plugins,
  activeView,
  onSelectTable,
  onSelectQuery,
  onSelectReport,
  onSelectPlugin,
  onOpenSpreadsheet,
  onOpenIDE,
  onNewReport,
  onOpenAI,
  theme = 'vs-dark',
  isOpen,
  onToggle,
}) => {
  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    tables: false,
    queries: false,
    reports: false,
    plugins: false,
  });
  const [showSystemTables, setShowSystemTables] = useState(false);

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Filtered lists
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (!showSystemTables && t.isSystem) return false;
      return t.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [tables, search, showSystemTables]);

  const filteredQueries = useMemo(() => {
    return queries.filter((q) => q.name.toLowerCase().includes(search.toLowerCase()));
  }, [queries, search]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  }, [reports, search]);

  const filteredPlugins = useMemo(() => {
    return plugins.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [plugins, search]);

  if (!isOpen) return null;

  const isDark = theme === 'vs-dark';

  return (
    <aside className={`w-64 flex-shrink-0 flex flex-col border-r select-none ${isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-300 text-slate-800'}`}>
      {/* Search Header */}
      <div className="p-2 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
          <input
            type="text"
            placeholder="Search MS Access objects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-8 pr-2 py-1 rounded text-xs border focus:outline-none focus:border-indigo-500 ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'
            }`}
          />
        </div>
      </div>

      {/* Object Groups Navigation Pane */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs">
        {/* 1. PLUGINS (Runtime Dynamic Apps) */}
        <div>
          <div
            onClick={() => toggleSection('plugins')}
            className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.plugins ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>Dynamic Plugins ({filteredPlugins.length})</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenIDE({ type: 'plugin' });
              }}
              title="Add New TSX Plugin"
              className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {!collapsedSections.plugins && (
            <div className="mt-1 space-y-0.5">
              {filteredPlugins.map((p) => {
                const isActive = activeView === `plugin:${p.id}`;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectPlugin(p)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : isDark
                        ? 'hover:bg-slate-900 text-slate-300 hover:text-white'
                        : 'hover:bg-slate-200 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60">v{p.version}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. TABLES (User & System Tables) */}
        <div>
          <div
            onClick={() => toggleSection('tables')}
            className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.tables ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>Tables ({filteredTables.length})</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSystemTables(!showSystemTables);
              }}
              title={showSystemTables ? 'Hide system tables (t_*)' : 'Show system tables (t_*)'}
              className={`p-0.5 rounded hover:bg-slate-800 text-[10px] font-mono ${showSystemTables ? 'text-indigo-400' : 'text-slate-500'}`}
            >
              Sys: {showSystemTables ? 'ON' : 'OFF'}
            </button>
          </div>

          {!collapsedSections.tables && (
            <div className="mt-1 space-y-0.5">
              {filteredTables.map((t) => {
                const isActive = activeView === `table:${t.name}`;
                return (
                  <button
                    key={t.name}
                    onClick={() => onSelectTable(t.name)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : isDark
                        ? 'hover:bg-slate-900 text-slate-300 hover:text-white'
                        : 'hover:bg-slate-200 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <TableIcon className={`w-3.5 h-3.5 flex-shrink-0 ${t.isSystem ? 'text-slate-500' : 'text-amber-400'}`} />
                      <span className="truncate">{t.name}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-60">
                      {t.rowCount} rows
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. QUERIES (Saved SQL Queries) */}
        <div>
          <div
            onClick={() => toggleSection('queries')}
            className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.queries ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>Saved Queries ({filteredQueries.length})</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenIDE({ type: 'sql' });
              }}
              title="Add New SQL Query"
              className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {!collapsedSections.queries && (
            <div className="mt-1 space-y-0.5">
              {filteredQueries.map((q) => {
                const isActive = activeView === `query:${q.id}`;
                return (
                  <button
                    key={q.id}
                    onClick={() => onSelectQuery(q)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : isDark
                        ? 'hover:bg-slate-900 text-slate-300 hover:text-white'
                        : 'hover:bg-slate-200 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Database className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" />
                      <span className="truncate">{q.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. REPORTS (Publication Reports) */}
        <div>
          <div
            onClick={() => toggleSection('reports')}
            className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.reports ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>Reports ({filteredReports.length})</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNewReport();
              }}
              title="Add New Report"
              className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {!collapsedSections.reports && (
            <div className="mt-1 space-y-0.5">
              {filteredReports.map((r) => {
                const isActive = activeView === `report:${r.id}`;
                return (
                  <button
                    key={r.id}
                    onClick={() => onSelectReport(r)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition ${
                      isActive
                        ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                        : isDark
                        ? 'hover:bg-slate-900 text-slate-300 hover:text-white'
                        : 'hover:bg-slate-200 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0 text-purple-400" />
                      <span className="truncate">{r.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Tools Quick Access */}
      <div className="p-2 border-t border-slate-800/80 space-y-1 text-xs">
        <button
          onClick={onOpenSpreadsheet}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded transition ${
            activeView === 'spreadsheet'
              ? 'bg-emerald-600 text-white font-semibold'
              : 'hover:bg-slate-900 text-slate-300'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Spreadsheet Studio</span>
        </button>

        <button
          onClick={() => onOpenIDE({ type: 'sql' })}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded transition ${
            activeView === 'ide'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'hover:bg-slate-900 text-slate-300'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
          <span>Internal Monaco IDE</span>
        </button>
      </div>
    </aside>
  );
};
