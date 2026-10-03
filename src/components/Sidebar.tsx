import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileCode,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Table as TableIcon,
  MoreVertical,
  Edit3,
  Trash2,
  Lock,
  Sliders,
  Shield,
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
  onOpenIDE: (tab?: { type: 'plugin' | 'table' | 'query' | 'report' | 'sql'; id?: string; name?: string }) => void;
  onNewReport: () => void;
  onEditReportVisual?: (report: SavedReport) => void;
  onDeleteObject: (type: 'plugin' | 'table' | 'query' | 'report', id: string, name: string) => void;
  onAddPlugin?: () => void;
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
  onEditReportVisual,
  onDeleteObject,
  onAddPlugin,
  onOpenAI,
  theme = 'vs-dark',
  isOpen,
  onToggle,
}) => {
  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    plugins: false,
    tables: false,
    queries: false,
    reports: false,
  });
  const [showSystemTables, setShowSystemTables] = useState(false);

  // Active three-dot menu dropdown: { type, id }
  const [activeMenu, setActiveMenu] = useState<{ type: string; id: string } | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close three-dot menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeMenu]);

  // Sidebar adjustable width state
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('gaw_sidebar_width');
    return saved ? Math.max(200, Math.min(600, parseInt(saved, 10))) : 260;
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem('gaw_sidebar_width', sidebarWidth.toString());
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

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
    return plugins.filter((p) => p.enabled !== 0 && p.name.toLowerCase().includes(search.toLowerCase()));
  }, [plugins, search]);

  if (!isOpen) return null;

  const isDark = theme === 'vs-dark';

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className={`relative flex-shrink-0 flex flex-col border-r select-none transition-colors ${
        isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
      }`}
    >
      {/* Search Header */}
      <div className="p-2 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
          <input
            type="text"
            placeholder="Search database objects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-8 pr-2 py-1.5 rounded text-xs border focus:outline-none focus:border-indigo-500 font-medium ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>
      </div>

      {/* Object Groups Navigation Pane */}
      <div ref={menuContainerRef} className="flex-1 overflow-y-auto p-2 space-y-4 text-xs">
        {/* 1. PLUGINS */}
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
                if (onAddPlugin) {
                  onAddPlugin();
                } else {
                  onOpenIDE({ type: 'plugin' });
                }
              }}
              title="Add Dynamic TSX Plugin (Local File, Dropbox, or IDE)"
              className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {!collapsedSections.plugins && (
            <div className="mt-1 space-y-0.5">
              {filteredPlugins.map((p) => {
                const isActive = activeView === `plugin:${p.id}`;
                const isMenuOpen = activeMenu?.type === 'plugin' && activeMenu.id === p.id;
                return (
                  <div key={p.id} className="relative group flex items-center">
                    <button
                      onClick={() => onSelectPlugin(p)}
                      className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-l text-left transition ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : isDark
                          ? 'hover:bg-slate-900 text-slate-200 hover:text-white'
                          : 'hover:bg-slate-200 text-slate-800 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-emerald-400'}`} />
                        <span className="truncate">{p.name}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-60 ml-1">v{p.version}</span>
                    </button>

                    {/* Three-dot Action Trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(isMenuOpen ? null : { type: 'plugin', id: p.id });
                      }}
                      className={`p-1.5 rounded-r transition hover:bg-slate-800 ${
                        isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Plugin options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Three-dot Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-0.5 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
                        <button
                          onClick={() => {
                            setActiveMenu(null);
                            onOpenIDE({ type: 'plugin', id: p.id, name: p.name });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Edit in IDE</span>
                        </button>
                        {p.id === 'plugin_manager' || p.id === 'plugin_local_storage' || p.id === 'plugin_file_manager' ? (
                          <div className="px-3 py-1.5 text-[10px] text-slate-400 flex items-center gap-1.5 border-t border-slate-800 mt-1">
                            <Shield className="w-3 h-3 text-indigo-400" />
                            <span>Protected Core Plugin</span>
                          </div>
                        ) : (
                          <>
                            <div className="h-px bg-slate-800 my-1" />
                            <button
                              onClick={() => {
                                setActiveMenu(null);
                                onDeleteObject('plugin', p.id, p.name);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete...</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. TABLES */}
        <div>
          <div
            onClick={() => toggleSection('tables')}
            className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer"
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
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
                showSystemTables
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-950/60'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              Sys: {showSystemTables ? 'ON' : 'OFF'}
            </button>
          </div>

          {!collapsedSections.tables && (
            <div className="mt-1 space-y-0.5">
              {filteredTables.map((t) => {
                const isActive = activeView === `table:${t.name}`;
                const isMenuOpen = activeMenu?.type === 'table' && activeMenu.id === t.name;
                return (
                  <div key={t.name} className="relative group flex items-center">
                    <button
                      onClick={() => onSelectTable(t.name)}
                      className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-l text-left transition ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : isDark
                          ? 'hover:bg-slate-900 text-slate-200 hover:text-white'
                          : 'hover:bg-slate-200 text-slate-800 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <TableIcon
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            t.isSystem ? 'text-slate-500' : 'text-amber-400'
                          }`}
                        />
                        <span className="truncate">{t.name}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-60 ml-1">
                        {t.rowCount} rows
                      </span>
                    </button>

                    {/* Action button: lock icon if system table, three-dot if user table */}
                    {t.isSystem ? (
                      <div
                        className="p-1.5 text-slate-600 cursor-not-allowed"
                        title="System table: Protected from editing or deletion"
                      >
                        <Lock className="w-3 h-3" />
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(isMenuOpen ? null : { type: 'table', id: t.name });
                          }}
                          className={`p-1.5 rounded-r transition hover:bg-slate-800 ${
                            isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                          title="Table options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-0.5 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
                            <button
                              onClick={() => {
                                setActiveMenu(null);
                                onOpenIDE({ type: 'table', name: t.name });
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Edit Structure in IDE</span>
                            </button>
                            <div className="h-px bg-slate-800 my-1" />
                            <button
                              onClick={() => {
                                setActiveMenu(null);
                                onDeleteObject('table', t.name, t.name);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Table...</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. SAVED QUERIES */}
        <div>
          <div
            onClick={() => toggleSection('queries')}
            className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer"
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
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {!collapsedSections.queries && (
            <div className="mt-1 space-y-0.5">
              {filteredQueries.map((q) => {
                const isActive = activeView === `query:${q.id}`;
                const isMenuOpen = activeMenu?.type === 'query' && activeMenu.id === q.id;
                return (
                  <div key={q.id} className="relative group flex items-center">
                    <button
                      onClick={() => onSelectQuery(q)}
                      className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-l text-left transition ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : isDark
                          ? 'hover:bg-slate-900 text-slate-200 hover:text-white'
                          : 'hover:bg-slate-200 text-slate-800 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Database className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-cyan-400'}`} />
                        <span className="truncate">{q.name}</span>
                      </div>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(isMenuOpen ? null : { type: 'query', id: q.id });
                      }}
                      className={`p-1.5 rounded-r transition hover:bg-slate-800 ${
                        isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Query options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-0.5 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
                        <button
                          onClick={() => {
                            setActiveMenu(null);
                            onOpenIDE({ type: 'query', id: q.id, name: q.name });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Edit Query in IDE</span>
                        </button>
                        <div className="h-px bg-slate-800 my-1" />
                        <button
                          onClick={() => {
                            setActiveMenu(null);
                            onDeleteObject('query', q.id, q.name);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Query...</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. REPORTS */}
        <div>
          <div
            onClick={() => toggleSection('reports')}
            className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:text-white cursor-pointer"
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
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {!collapsedSections.reports && (
            <div className="mt-1 space-y-0.5">
              {filteredReports.map((r) => {
                const isActive = activeView === `report:${r.id}`;
                const isMenuOpen = activeMenu?.type === 'report' && activeMenu.id === r.id;
                return (
                  <div key={r.id} className="relative group flex items-center">
                    <button
                      onClick={() => onSelectReport(r)}
                      className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-l text-left transition ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : isDark
                          ? 'hover:bg-slate-900 text-slate-200 hover:text-white'
                          : 'hover:bg-slate-200 text-slate-800 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-purple-400'}`} />
                        <span className="truncate">{r.name}</span>
                      </div>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(isMenuOpen ? null : { type: 'report', id: r.id });
                      }}
                      className={`p-1.5 rounded-r transition hover:bg-slate-800 ${
                        isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      title="Report options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-0.5 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
                        <button
                          onClick={() => {
                            setActiveMenu(null);
                            onOpenIDE({ type: 'report', id: r.id, name: r.name });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                          <span>Edit Code in IDE</span>
                        </button>
                        {onEditReportVisual && (
                          <button
                            onClick={() => {
                              setActiveMenu(null);
                              onEditReportVisual(r);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
                          >
                            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Visual Builder...</span>
                          </button>
                        )}
                        <div className="h-px bg-slate-800 my-1" />
                        <button
                          onClick={() => {
                            setActiveMenu(null);
                            onDeleteObject('report', r.id, r.name);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Report...</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Tools Quick Access - High Contrast, Active Buttons */}
      <div className="p-2 border-t border-slate-800/80 space-y-1.5 text-xs bg-slate-950/70">
        <button
          onClick={onOpenSpreadsheet}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold shadow-sm border transition active:scale-[0.98] ${
            activeView === 'spreadsheet'
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-950/50'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-slate-700/80 hover:border-emerald-500/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded flex items-center justify-center bg-emerald-950/80 border border-emerald-700/60">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-semibold text-slate-100">Spreadsheet Studio</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
            Active
          </span>
        </button>

        <button
          onClick={() => onOpenIDE()}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold shadow-sm border transition active:scale-[0.98] ${
            activeView === 'ide'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-950/50'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-slate-700/80 hover:border-indigo-500/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded flex items-center justify-center bg-indigo-950/80 border border-indigo-700/60">
              <FileCode className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="font-semibold text-slate-100">Internal Monaco IDE</span>
          </div>
          <span className="text-[10px] text-indigo-400 font-mono px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">
            Active
          </span>
        </button>
      </div>

      {/* Resize Handle on Right Edge */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/80 transition-colors z-30 ${
          isResizing ? 'bg-indigo-500 w-2 shadow-lg shadow-indigo-500/50' : 'bg-transparent'
        }`}
        title="Drag left or right to adjust sidebar width"
      />
    </aside>
  );
};
