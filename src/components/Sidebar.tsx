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
  X,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { TableSchema, SavedQuery } from '../types/sqlite';
import { PluginRecord, isSystemPlugin } from '../types/plugin';
import { SavedReport } from '../types/report';
import { safeStorage } from '../utils/storage';

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
  mode?: 'dev' | 'app';
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
  mode = 'dev',
}) => {
  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    plugins: false,
    pluginsSystem: false,
    pluginsUser: false,
    tables: false,
    tablesSystem: false,
    tablesUser: false,
    queries: false,
    reports: false,
  });

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
    const saved = safeStorage.getItem('gaw_sidebar_width');
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
      safeStorage.setItem('gaw_sidebar_width', sidebarWidth.toString());
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

  // Filtered lists separated into System and User
  const { systemPlugins, userPlugins } = useMemo(() => {
    const sys: PluginRecord[] = [];
    const usr: PluginRecord[] = [];
    const query = search.toLowerCase();

    plugins.forEach((p) => {
      if (p.enabled === 0) return;
      if (query && !p.name.toLowerCase().includes(query) && !p.description?.toLowerCase().includes(query)) return;
      if (isSystemPlugin(p)) {
        if (mode === 'app') {
          // In App mode, only Dropbox, Local storage, and File & workspace manager are visible
          if (p.id === 'plugin_dropbox_sync' || p.id === 'plugin_local_storage' || p.id === 'plugin_file_manager') {
            sys.push(p);
          }
        } else {
          sys.push(p);
        }
      } else {
        usr.push(p);
      }
    });

    return { systemPlugins: sys, userPlugins: usr };
  }, [plugins, search, mode]);

  const { systemTables, userTables } = useMemo(() => {
    const sys: TableSchema[] = [];
    const usr: TableSchema[] = [];
    const query = search.toLowerCase();

    tables.forEach((t) => {
      if (query && !t.name.toLowerCase().includes(query)) return;
      if (t.isSystem) {
        if (mode !== 'app') {
          sys.push(t);
        }
      } else {
        usr.push(t);
      }
    });

    return { systemTables: sys, userTables: usr };
  }, [tables, search, mode]);

  const filteredQueries = useMemo(() => {
    return queries.filter((q) => q.name.toLowerCase().includes(search.toLowerCase()));
  }, [queries, search]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  }, [reports, search]);

  if (!isOpen) return null;

  const isDark = theme === 'vs-dark';

  return (
    <aside
      style={typeof window !== 'undefined' && window.innerWidth >= 768 ? { width: `${sidebarWidth}px` } : undefined}
      className={`relative flex-shrink-0 flex flex-col select-text transition-colors w-full md:w-auto h-full border-t md:border-t-0 md:border-r ${
        isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
      }`}
    >
      {/* Search Header */}
      <div className="p-2 border-b border-slate-800/80 flex items-center gap-2">
        <div className="relative flex-1">
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
        <button
          onClick={onToggle}
          className="md:hidden p-1.5 rounded-lg border text-slate-400 hover:text-white"
          title="Close Navigation Pane"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Object Groups Navigation Pane */}
      <div ref={menuContainerRef} className="flex-1 overflow-y-auto p-2 space-y-4 text-xs">
        {/* 1. PLUGINS */}
        <div>
          <div
            onClick={() => toggleSection('plugins')}
            className={`flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
              isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.plugins ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>Dynamic Plugins ({systemPlugins.length + userPlugins.length})</span>
            </div>
            {mode !== 'app' && (
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
            )}
          </div>

          {!collapsedSections.plugins && (
            <div className="mt-1 space-y-2">
              {/* Folder: System Plugins */}
              <div>
                <div
                  onClick={() => toggleSection('pluginsSystem')}
                  className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold cursor-pointer select-none transition ${
                    isDark ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-700'
                  }`}
                >
                  {collapsedSections.pluginsSystem ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {collapsedSections.pluginsSystem ? (
                    <Folder className={`w-3.5 h-3.5 ${isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                  ) : (
                    <FolderOpen className={`w-3.5 h-3.5 ${isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                  )}
                  <span>System ({systemPlugins.length})</span>
                </div>

                {!collapsedSections.pluginsSystem && (
                  <div className={`pl-2 mt-0.5 space-y-0.5 border-l ml-3 ${
                    isDark ? 'border-sky-500/30' : 'border-blue-300'
                  }`}>
                    {systemPlugins.map((p) => {
                      const isActive = activeView === `plugin:${p.id}`;
                      const isMenuOpen = activeMenu?.type === 'plugin' && activeMenu.id === p.id;
                      return (
                        <div key={p.id} className="relative group flex items-center">
                          <button
                            onClick={() => onSelectPlugin(p)}
                            className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded text-left transition ${
                              isActive
                                ? isDark
                                  ? 'bg-sky-600 text-white font-semibold shadow-sm'
                                  : 'bg-blue-600 text-white font-semibold shadow-sm'
                                : isDark
                                ? 'hover:bg-slate-900 text-sky-300 hover:text-white'
                                : 'hover:bg-blue-50 text-blue-700 hover:text-blue-800 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isActive ? 'text-white' : isDark ? 'text-sky-400' : 'text-blue-600'
                              }`} />
                              <span className="truncate">{p.name}</span>
                            </div>
                            <span className={`text-[10px] font-mono ml-1 ${
                              isActive ? 'text-white/80' : isDark ? 'text-sky-400/80' : 'text-blue-600/80 font-medium'
                            }`}>v{p.version}</span>
                          </button>

                          {mode !== 'app' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(isMenuOpen ? null : { type: 'plugin', id: p.id });
                              }}
                              className={`p-1.5 rounded-r transition ${
                                isActive
                                  ? isDark ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white'
                                  : isDark ? 'text-sky-400 hover:text-white hover:bg-slate-800' : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                              }`}
                              title="Plugin options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {mode !== 'app' && isMenuOpen && (
                            <div className="absolute right-0 top-full mt-0.5 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
                              <button
                                onClick={() => {
                                  setActiveMenu(null);
                                  onOpenIDE({ type: 'plugin', id: p.id, name: p.name });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-sky-600 hover:text-white transition"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                                <span>Edit in IDE</span>
                              </button>
                              <div className="px-3 py-1.5 text-[10px] text-slate-400 flex items-center gap-1.5 border-t border-slate-800 mt-1">
                                <Shield className="w-3 h-3 text-sky-400" />
                                <span>Core System Plugin</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Folder: User Plugins */}
              <div>
                <div
                  onClick={() => toggleSection('pluginsUser')}
                  className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold cursor-pointer select-none transition ${
                    isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
                  }`}
                >
                  {collapsedSections.pluginsUser ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {collapsedSections.pluginsUser ? (
                    <Folder className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  ) : (
                    <FolderOpen className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  )}
                  <span>User ({userPlugins.length})</span>
                </div>

                {!collapsedSections.pluginsUser && (
                  <div className={`pl-2 mt-0.5 space-y-0.5 border-l ml-3 ${
                    isDark ? 'border-emerald-500/30' : 'border-emerald-300'
                  }`}>
                    {userPlugins.length === 0 && (
                      <div className="px-2 py-1 text-[11px] text-slate-500 italic">No user plugins</div>
                    )}
                    {userPlugins.map((p) => {
                      const isActive = activeView === `plugin:${p.id}`;
                      const isMenuOpen = activeMenu?.type === 'plugin' && activeMenu.id === p.id;
                      return (
                        <div key={p.id} className="relative group flex items-center">
                          <button
                            onClick={() => onSelectPlugin(p)}
                            className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded text-left transition ${
                              isActive
                                ? isDark
                                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                                  : 'bg-emerald-600 text-white font-semibold shadow-sm'
                                : isDark
                                ? 'hover:bg-slate-900 text-emerald-300 hover:text-white'
                                : 'hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isActive ? 'text-white' : isDark ? 'text-emerald-400' : 'text-emerald-600'
                              }`} />
                              <span className="truncate">{p.name}</span>
                            </div>
                            <span className={`text-[10px] font-mono ml-1 ${
                              isActive ? 'text-white/80' : isDark ? 'text-emerald-400/80' : 'text-emerald-600/80 font-medium'
                            }`}>v{p.version}</span>
                          </button>

                          {mode !== 'app' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(isMenuOpen ? null : { type: 'plugin', id: p.id });
                              }}
                              className={`p-1.5 rounded-r transition ${
                                isActive
                                  ? isDark ? 'bg-emerald-600 text-white' : 'bg-emerald-600 text-white'
                                  : isDark ? 'text-emerald-400 hover:text-white hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                              }`}
                              title="Plugin options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {mode !== 'app' && isMenuOpen && (
                            <div className="absolute right-0 top-full mt-0.5 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
                              <button
                                onClick={() => {
                                  setActiveMenu(null);
                                  onOpenIDE({ type: 'plugin', id: p.id, name: p.name });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-600 hover:text-white transition"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Edit in IDE</span>
                              </button>
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
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. TABLES */}
        <div>
          <div
            onClick={() => toggleSection('tables')}
            className={`flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
              isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections.tables ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>Tables ({systemTables.length + userTables.length})</span>
            </div>
          </div>

          {!collapsedSections.tables && (
            <div className="mt-1 space-y-2">
              {/* Folder: System Tables */}
              {systemTables.length > 0 && (
                <div>
                  <div
                    onClick={() => toggleSection('tablesSystem')}
                    className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold cursor-pointer select-none transition ${
                      isDark ? 'text-sky-400 hover:text-sky-300' : 'text-blue-600 hover:text-blue-700'
                    }`}
                  >
                    {collapsedSections.tablesSystem ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {collapsedSections.tablesSystem ? (
                      <Folder className={`w-3.5 h-3.5 ${isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                    ) : (
                      <FolderOpen className={`w-3.5 h-3.5 ${isDark ? 'text-sky-400' : 'text-blue-600'}`} />
                    )}
                    <span>System ({systemTables.length})</span>
                  </div>

                  {!collapsedSections.tablesSystem && (
                    <div className={`pl-2 mt-0.5 space-y-0.5 border-l ml-3 ${
                      isDark ? 'border-sky-500/30' : 'border-blue-300'
                    }`}>
                      {systemTables.map((t) => {
                        const isActive = activeView === `table:${t.name}`;
                        return (
                          <div key={t.name} className="relative group flex items-center">
                            <button
                              onClick={() => onSelectTable(t.name)}
                              className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded text-left transition ${
                                isActive
                                  ? isDark
                                    ? 'bg-sky-600 text-white font-semibold shadow-sm'
                                    : 'bg-blue-600 text-white font-semibold shadow-sm'
                                  : isDark
                                  ? 'hover:bg-slate-900 text-sky-300 hover:text-white'
                                  : 'hover:bg-blue-50 text-blue-700 hover:text-blue-800 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <TableIcon className={`w-3.5 h-3.5 flex-shrink-0 ${
                                  isActive ? 'text-white' : isDark ? 'text-sky-400' : 'text-blue-600'
                                }`} />
                                <span className="truncate">{t.name}</span>
                              </div>
                              <span className={`text-[10px] font-mono ml-1 ${
                                isActive ? 'text-white/80' : isDark ? 'text-sky-400/80' : 'text-blue-600/80 font-medium'
                              }`}>
                                {t.rowCount} rows
                              </span>
                            </button>

                            <div
                              className="p-1.5 text-slate-600 cursor-not-allowed"
                              title="System table: Protected schema"
                            >
                              <Lock className={`w-3 h-3 ${isDark ? 'text-sky-400/70' : 'text-blue-600/70'}`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Folder: User Tables */}
              <div>
                <div
                  onClick={() => toggleSection('tablesUser')}
                  className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold cursor-pointer select-none transition ${
                    isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-700'
                  }`}
                >
                  {collapsedSections.tablesUser ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {collapsedSections.tablesUser ? (
                    <Folder className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  ) : (
                    <FolderOpen className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                  )}
                  <span>User ({userTables.length})</span>
                </div>

                {!collapsedSections.tablesUser && (
                  <div className={`pl-2 mt-0.5 space-y-0.5 border-l ml-3 ${
                    isDark ? 'border-emerald-500/30' : 'border-emerald-300'
                  }`}>
                    {userTables.length === 0 && (
                      <div className="px-2 py-1 text-[11px] text-slate-500 italic">No user tables</div>
                    )}
                    {userTables.map((t) => {
                      const isActive = activeView === `table:${t.name}`;
                      const isMenuOpen = activeMenu?.type === 'table' && activeMenu.id === t.name;
                      return (
                        <div key={t.name} className="relative group flex items-center">
                          <button
                            onClick={() => onSelectTable(t.name)}
                            className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded text-left transition ${
                              isActive
                                ? isDark
                                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                                  : 'bg-emerald-600 text-white font-semibold shadow-sm'
                                : isDark
                                ? 'hover:bg-slate-900 text-emerald-300 hover:text-white'
                                : 'hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <TableIcon className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isActive ? 'text-white' : isDark ? 'text-emerald-400' : 'text-emerald-600'
                              }`} />
                              <span className="truncate">{t.name}</span>
                            </div>
                            <span className={`text-[10px] font-mono ml-1 ${
                              isActive ? 'text-white/80' : isDark ? 'text-emerald-400/80' : 'text-emerald-600/80 font-medium'
                            }`}>
                              {t.rowCount} rows
                            </span>
                          </button>

                          {mode !== 'app' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenu(isMenuOpen ? null : { type: 'table', id: t.name });
                              }}
                              className={`p-1.5 rounded-r transition ${
                                isActive
                                  ? isDark ? 'bg-emerald-600 text-white' : 'bg-emerald-600 text-white'
                                  : isDark ? 'text-emerald-400 hover:text-white hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                              }`}
                              title="Table options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {mode !== 'app' && isMenuOpen && (
                            <div className="absolute right-0 top-full mt-0.5 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
                              <button
                                onClick={() => {
                                  setActiveMenu(null);
                                  onOpenIDE({ type: 'table', name: t.name });
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-600 hover:text-white transition"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
            {mode !== 'app' && (
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
            )}
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

                    {mode !== 'app' && (
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
                    )}

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
            {mode !== 'app' && (
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
            )}
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

                    {mode !== 'app' && (
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
                    )}

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

      {/* Bottom Tools Quick Access */}
      <div className={`p-2 border-t space-y-1.5 text-xs ${
        isDark ? 'border-slate-800/80 bg-slate-950/70' : 'border-slate-300 bg-slate-100/90'
      }`}>
        <button
          onClick={onOpenSpreadsheet}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold shadow-sm border transition active:scale-[0.98] ${
            activeView === 'spreadsheet'
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-950/50'
              : isDark
              ? 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-slate-700/80 hover:border-emerald-500/60'
              : 'bg-white hover:bg-emerald-50/70 text-slate-800 border-slate-300 hover:border-emerald-500'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-6 h-6 rounded flex items-center justify-center border ${
              isDark ? 'bg-emerald-950/80 border-emerald-700/60' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <FileSpreadsheet className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Spreadsheet Studio</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            isDark ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40' : 'text-emerald-700 bg-emerald-50 border-emerald-300 font-semibold'
          }`}>
            Active
          </span>
        </button>

        <button
          onClick={() => onOpenIDE()}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-semibold shadow-sm border transition active:scale-[0.98] ${
            activeView === 'ide'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-950/50'
              : isDark
              ? 'bg-slate-900 hover:bg-slate-800 text-slate-100 border-slate-700/80 hover:border-indigo-500/60'
              : 'bg-white hover:bg-indigo-50/70 text-slate-800 border-slate-300 hover:border-indigo-500'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-6 h-6 rounded flex items-center justify-center border ${
              isDark ? 'bg-indigo-950/80 border-indigo-700/60' : 'bg-indigo-50 border-indigo-200'
            }`}>
              <FileCode className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            </div>
            <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Internal Monaco IDE</span>
          </div>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            isDark ? 'text-indigo-400 bg-indigo-950/60 border-indigo-800/40' : 'text-indigo-700 bg-indigo-50 border-indigo-300 font-semibold'
          }`}>
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
        className={`hidden md:block absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/80 transition-colors z-30 ${
          isResizing ? 'bg-indigo-500 w-2 shadow-lg shadow-indigo-500/50' : 'bg-transparent'
        }`}
        title="Drag left or right to adjust sidebar width"
      />
    </aside>
  );
};
