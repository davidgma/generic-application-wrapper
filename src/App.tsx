import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SQLiteEngine } from './engine/sqliteEngine';
import { FileStorageEngine } from './engine/fileStorage';
import { DropboxSyncEngine } from './engine/dropboxSync';
import { PluginEngine } from './engine/pluginEngine';
import { TableSchema, SavedQuery, QueryResult } from './types/sqlite';
import { PluginRecord, GAWContext } from './types/plugin';
import { SavedReport } from './types/report';
import { ConflictDetails, StorageMetadata } from './types/storage';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { QueryGrid } from './components/QueryGrid';
import { GAWIDE } from './components/IDE/GAWIDE';
import { SpreadsheetView } from './components/SpreadsheetView';
import { ReportViewer } from './components/ReportViewer';
import { ReportBuilder } from './components/ReportBuilder';
import { PluginHost } from './components/PluginHost';
import { AIAssistant } from './components/AIAssistant';
import { DropboxModal } from './components/DropboxModal';
import { SettingsModal } from './components/SettingsModal';
import { ConflictDialog } from './components/ConflictDialog';
import { OfflineIndicator } from './components/OfflineIndicator';

import {
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  X,
  FileCode,
  Table as TableIcon,
  Play,
  RotateCcw,
} from 'lucide-react';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export default function App() {
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Theme
  const [theme, setTheme] = useState<'vs-dark' | 'vs-light'>('vs-dark');

  // Navigation & Active View
  // Values: 'table:customers', 'query:q_active_customers', 'report:report_exec_overview', 'plugin:plugin_crm', 'ide', 'spreadsheet'
  const [activeView, setActiveView] = useState<string>('plugin:plugin_crm');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Database metadata & collections
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [appTitle, setAppTitle] = useState('Northwind Modern Commerce');

  // Active query result for table/query views
  const [activeQueryResult, setActiveQueryResult] = useState<QueryResult | null>(null);
  const [activeQueryTitle, setActiveQueryTitle] = useState<string>('');

  // Storage and Sync Metadata
  const storageEngine = useMemo(() => FileStorageEngine.getInstance(), []);
  const [storageMeta, setStorageMeta] = useState<StorageMetadata>(storageEngine.getMetadata());
  const [activeConflict, setActiveConflict] = useState<ConflictDetails | null>(null);

  // Modals
  const [showDropboxModal, setShowDropboxModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [reportToEdit, setReportToEdit] = useState<SavedReport | null>(null);

  // Spreadsheet Transfer data
  const [spreadsheetInitialSheets, setSpreadsheetInitialSheets] = useState<
    Array<{ name: string; columns: string[]; values: any[][] }> | undefined
  >(undefined);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Simple dialog state for confirm/alert/prompt
  const [dialogConfig, setDialogConfig] = useState<{
    type: 'confirm' | 'alert' | 'prompt';
    message: string;
    defaultValue?: string;
    resolve: (val: any) => void;
  } | null>(null);
  const [promptInput, setPromptInput] = useState('');

  // Toast API
  const addToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const toastApi = useMemo(
    () => ({
      success: (msg: string) => addToast('success', msg),
      error: (msg: string) => addToast('error', msg),
      info: (msg: string) => addToast('info', msg),
      warning: (msg: string) => addToast('warning', msg),
    }),
    [addToast]
  );

  // Dialog API
  const dialogApi = useMemo(
    () => ({
      confirm: (message: string) =>
        new Promise<boolean>((resolve) => {
          setDialogConfig({ type: 'confirm', message, resolve });
        }),
      alert: (message: string) =>
        new Promise<void>((resolve) => {
          setDialogConfig({ type: 'alert', message, resolve });
        }),
      prompt: (message: string, defaultValue: string = '') =>
        new Promise<string | null>((resolve) => {
          setPromptInput(defaultValue);
          setDialogConfig({ type: 'prompt', message, defaultValue, resolve });
        }),
    }),
    []
  );

  // Simple event bus
  const eventBusListeners = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());
  const eventBusApi = useMemo(
    () => ({
      on: (event: string, callback: (...args: any[]) => void) => {
        if (!eventBusListeners.current.has(event)) {
          eventBusListeners.current.set(event, new Set());
        }
        eventBusListeners.current.get(event)!.add(callback);
        return () => {
          eventBusListeners.current.get(event)?.delete(callback);
        };
      },
      emit: (event: string, ...args: any[]) => {
        storageEngine.markDirty();
        const set = eventBusListeners.current.get(event);
        if (set) {
          set.forEach((cb: (...args: any[]) => void) => {
            try {
              cb(...args);
            } catch (e) {
              console.error(e);
            }
          });
        }
      },
    }),
    [storageEngine]
  );

  // Initialize SQLite Engine
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const engine = SQLiteEngine.getInstance();
        await engine.init();
        if (mounted) {
          setIsEngineReady(true);
          refreshDatabaseState();
        }
      } catch (err: any) {
        console.error('SQLite initialization failed:', err);
        if (mounted) {
          setInitError(err.message || String(err));
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to storage status and conflicts
  useEffect(() => {
    const unsubStatus = storageEngine.onStatusChange((meta) => {
      setStorageMeta(meta);
    });

    storageEngine.onConflict((conflict) => {
      setActiveConflict(conflict);
    });

    return () => {
      unsubStatus();
    };
  }, [storageEngine]);

  // Refresh DB Schema & Objects
  const refreshDatabaseState = useCallback(() => {
    const engine = SQLiteEngine.getInstance();
    try {
      const schemas = engine.getSchema();
      setTables(schemas);

      const qs = engine.getSavedQueries();
      setQueries(qs);

      const reps = engine.getSavedReports();
      setReports(reps);

      const plgs = engine.getPlugins();
      setPlugins(plgs);

      const title = engine.getSetting('app_title', 'Northwind Modern Commerce');
      setAppTitle(title);

      const th = engine.getSetting('theme', 'vs-dark') as 'vs-dark' | 'vs-light';
      setTheme(th);
    } catch (e) {
      console.error('Failed to refresh database state:', e);
    }
  }, []);

  // Subscribe to SQLiteEngine internal changes
  useEffect(() => {
    const engine = SQLiteEngine.getInstance();
    const unsub = engine.subscribe(() => {
      storageEngine.markDirty();
      refreshDatabaseState();
    });
    return unsub;
  }, [storageEngine, refreshDatabaseState]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        storageEngine.save().then((ok) => {
          if (ok) toastApi.success('Database saved successfully!');
        });
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        storageEngine.openFile().then((ok) => {
          if (ok) {
            toastApi.success('Database opened successfully!');
            refreshDatabaseState();
          }
        });
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setActiveView('ide');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [storageEngine, toastApi, refreshDatabaseState]);

  // Navigate to Table View
  const handleSelectTable = (tableName: string) => {
    const engine = SQLiteEngine.getInstance();
    try {
      const startTime = performance.now();
      const res = engine.query(`SELECT * FROM "${tableName}" LIMIT 500;`);
      const execTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

      setActiveQueryResult({
        columns: res.columns,
        values: res.values,
        execTimeMs,
        sqlQuery: `SELECT * FROM "${tableName}" LIMIT 500;`,
      });
      setActiveQueryTitle(`Table: ${tableName}`);
      setActiveView(`table:${tableName}`);
    } catch (err: any) {
      toastApi.error('Error opening table: ' + err.message);
    }
  };

  // Navigate to Query View
  const handleSelectQuery = (q: SavedQuery) => {
    const engine = SQLiteEngine.getInstance();
    try {
      const results = engine.exec(q.query);
      if (results.length > 0) {
        setActiveQueryResult(results[0]);
        setActiveQueryTitle(q.name);
        setActiveView(`query:${q.id}`);
      }
    } catch (err: any) {
      toastApi.error('Error running query: ' + err.message);
    }
  };

  // Open Spreadsheet with specific data
  const handleOpenSpreadsheet = (
    data?: { columns: string[]; values: any[][] },
    sheetName: string = 'Data'
  ) => {
    if (data) {
      setSpreadsheetInitialSheets([{ name: sheetName, columns: data.columns, values: data.values }]);
    }
    setActiveView('spreadsheet');
  };

  // Build GAW Context passed to dynamic plugins
  const gawContext: GAWContext = useMemo(() => {
    const engine = SQLiteEngine.getInstance();
    const activePluginRecord =
      plugins.find((p) => `plugin:${p.id}` === activeView) || plugins[0] || ({} as PluginRecord);

    return {
      db: {
        query: (sql, params) => engine.query(sql, params),
        queryObjects: (sql, params) => engine.queryObjects(sql, params),
        run: (sql, params) => {
          const res = engine.run(sql, params);
          eventBusApi.emit('db_changed');
          return res;
        },
        exec: (sql) => {
          const res = engine.exec(sql);
          eventBusApi.emit('db_changed');
          return res;
        },
        getTables: () => engine.getSchema().map((s) => s.name),
        getSchema: () => engine.getSchema(),
        getTableData: (name, limit = 50) => {
          const r = engine.query(`SELECT * FROM "${name}" LIMIT ${limit};`);
          return { columns: r.columns, values: r.values };
        },
      },
      toast: toastApi,
      dialog: dialogApi,
      navigation: {
        navigate: (route) => setActiveView(route),
        openQuery: (sql) => {
          setActiveView('ide');
        },
        openSpreadsheet: (data, sheetName) => handleOpenSpreadsheet(data, sheetName),
        openReport: (repId) => setActiveView(`report:${repId}`),
        openPlugin: (plgId) => setActiveView(`plugin:${plgId}`),
      },
      eventBus: eventBusApi,
      theme,
      plugin: activePluginRecord,
    };
  }, [plugins, activeView, toastApi, dialogApi, eventBusApi, theme]);

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md w-full p-6 bg-slate-900 border border-red-500/50 rounded-xl shadow-2xl space-y-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-8 h-8 flex-shrink-0" />
            <h1 className="text-lg font-bold">Failed to Initialize SQLite Engine</h1>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-mono">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
          >
            Retry Launch
          </button>
        </div>
      </div>
    );
  }

  if (!isEngineReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-2xl animate-pulse">
            GAW
          </div>
          <div className="text-center">
            <h2 className="text-base font-bold text-white">Loading SQLite Engine (WebAssembly)</h2>
            <p className="text-xs text-slate-400 mt-1">Mounting portable database runtime...</p>
          </div>
        </div>
      </div>
    );
  }

  // Active object references
  const currentPlugin = plugins.find((p) => activeView === `plugin:${p.id}`);
  const currentReport = reports.find((r) => activeView === `report:${r.id}`);

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${theme === 'vs-dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Application Header & Menus */}
      <Navbar
        appTitle={appTitle}
        storageMeta={storageMeta}
        theme={theme}
        onThemeToggle={() => {
          const next = theme === 'vs-dark' ? 'vs-light' : 'vs-dark';
          setTheme(next);
          SQLiteEngine.getInstance().setSetting('theme', next);
        }}
        onNewDatabase={() => {
          SQLiteEngine.getInstance().createDefaultDatabase();
          toastApi.info('Created new database.');
          refreshDatabaseState();
          setActiveView('ide');
        }}
        onOpenFile={async () => {
          const ok = await storageEngine.openFile();
          if (ok) {
            toastApi.success('Opened database file successfully.');
            refreshDatabaseState();
          }
        }}
        onSaveFile={async () => {
          const ok = await storageEngine.save();
          if (ok) toastApi.success('Saved to disk file handle.');
        }}
        onSaveAsFile={async () => {
          await storageEngine.saveAs();
        }}
        onOpenDropbox={() => setShowDropboxModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenAI={() => setShowAIModal(true)}
        onOpenIDE={(tab) => setActiveView('ide')}
        onOpenSpreadsheet={() => handleOpenSpreadsheet()}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onResetDefault={() => {
          SQLiteEngine.getInstance().createDefaultDatabase();
          toastApi.success('Reset database to Northwind Modern template.');
          refreshDatabaseState();
          setActiveView('plugin:plugin_crm');
        }}
      />

      {/* Main Workspace Area (Sidebar + Active View) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* MS Access Object Navigation Pane */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          tables={tables}
          queries={queries}
          reports={reports}
          plugins={plugins}
          activeView={activeView}
          onSelectTable={handleSelectTable}
          onSelectQuery={handleSelectQuery}
          onSelectReport={(r) => setActiveView(`report:${r.id}`)}
          onSelectPlugin={(p) => setActiveView(`plugin:${p.id}`)}
          onOpenSpreadsheet={() => handleOpenSpreadsheet()}
          onOpenIDE={() => setActiveView('ide')}
          onNewReport={() => {
            setReportToEdit(null);
            setShowReportBuilder(true);
          }}
          onOpenAI={() => setShowAIModal(true)}
          theme={theme}
        />

        {/* Center Canvas */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-slate-900">
          {/* View 1: Active Dynamic TSX Plugin */}
          {activeView.startsWith('plugin:') && currentPlugin && (
            <div className="flex-1 overflow-hidden">
              <PluginHost
                code={currentPlugin.code}
                pluginName={currentPlugin.name}
                pluginId={currentPlugin.id}
                theme={theme}
                gawContext={gawContext}
                onOpenInIDE={() => setActiveView('ide')}
              />
            </div>
          )}

          {/* View 2: Table or Query Grid */}
          {(activeView.startsWith('table:') || activeView.startsWith('query:')) && activeQueryResult && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-white">{activeQueryTitle}</span>
                {activeView.startsWith('query:') && (
                  <button
                    onClick={() => setActiveView('ide')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    Edit Query in IDE
                  </button>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <QueryGrid
                  result={activeQueryResult}
                  onOpenInSpreadsheet={handleOpenSpreadsheet}
                  title={activeQueryTitle}
                  theme={theme}
                />
              </div>
            </div>
          )}

          {/* View 3: Publication Report Viewer */}
          {activeView.startsWith('report:') && currentReport && (
            <div className="flex-1 overflow-hidden">
              <ReportViewer
                report={currentReport}
                onEdit={() => {
                  setReportToEdit(currentReport);
                  setShowReportBuilder(true);
                }}
                onBack={() => setActiveView('plugin:plugin_crm')}
                theme={theme}
              />
            </div>
          )}

          {/* View 4: Embedded Spreadsheet Studio */}
          {activeView === 'spreadsheet' && (
            <div className="flex-1 overflow-hidden">
              <SpreadsheetView
                initialSheets={spreadsheetInitialSheets}
                onClose={() => setActiveView('plugin:plugin_crm')}
                theme={theme}
              />
            </div>
          )}

          {/* View 5: Internal Monaco Editor IDE */}
          {activeView === 'ide' && (
            <div className="flex-1 overflow-hidden">
              <GAWIDE
                onOpenSpreadsheet={handleOpenSpreadsheet}
                onOpenAI={() => setShowAIModal(true)}
                theme={theme}
                gawContext={gawContext}
              />
            </div>
          )}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        storageMeta={storageMeta}
        tableCount={tables.length}
        pluginCount={plugins.length}
        theme={theme}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {/* Modals & Dialogs */}
      {/* 1. Conflict Resolution Dialog */}
      {activeConflict && (
        <ConflictDialog
          conflict={activeConflict}
          onKeepLocal={async () => {
            await storageEngine.resolveConflictKeepLocal();
            setActiveConflict(null);
            toastApi.success('Local state overwritten to disk.');
          }}
          onReloadDisk={async () => {
            await storageEngine.resolveConflictReloadDisk();
            setActiveConflict(null);
            refreshDatabaseState();
            toastApi.info('Reloaded from disk.');
          }}
          onSaveCopy={async () => {
            await storageEngine.resolveConflictSaveCopy();
            setActiveConflict(null);
            toastApi.success('Saved local state as new copy.');
          }}
        />
      )}

      {/* 2. Dropbox Modal */}
      {showDropboxModal && (
        <DropboxModal
          onClose={() => setShowDropboxModal(false)}
          onFileLoaded={(fn) => {
            toastApi.success(`Loaded database ${fn} from Dropbox!`);
            refreshDatabaseState();
          }}
        />
      )}

      {/* 3. Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          theme={theme}
          onThemeChange={(newTheme) => {
            setTheme(newTheme);
            SQLiteEngine.getInstance().setSetting('theme', newTheme);
          }}
        />
      )}

      {/* 4. AI Specification Exporter Modal */}
      {showAIModal && (
        <AIAssistant
          onClose={() => setShowAIModal(false)}
          onInstallPlugin={(plg) => {
            const engine = SQLiteEngine.getInstance();
            const now = new Date().toISOString();
            engine.run(
              'INSERT OR REPLACE INTO t_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [plg.id, plg.name, '1.0.0', 1, plg.icon, plg.menu_category, plg.route, plg.description, plg.code, now, now]
            );
            toastApi.success(`Installed plugin "${plg.name}" into SQLite!`);
            refreshDatabaseState();
            setActiveView(`plugin:${plg.id}`);
          }}
          theme={theme}
        />
      )}

      {/* 5. Report Builder Modal */}
      {showReportBuilder && (
        <ReportBuilder
          report={reportToEdit}
          onSave={(savedRep) => {
            toastApi.success(`Report "${savedRep.name}" saved!`);
            refreshDatabaseState();
            setShowReportBuilder(false);
            setActiveView(`report:${savedRep.id}`);
          }}
          onClose={() => setShowReportBuilder(false)}
        />
      )}

      {/* In-App Dialog Modal (confirm / alert / prompt) */}
      {dialogConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-white">GAW Dialog</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{dialogConfig.message}</p>
            {dialogConfig.type === 'prompt' && (
              <input
                type="text"
                autoFocus
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100"
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              {dialogConfig.type === 'confirm' && (
                <button
                  onClick={() => {
                    dialogConfig.resolve(false);
                    setDialogConfig(null);
                  }}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  if (dialogConfig.type === 'confirm') dialogConfig.resolve(true);
                  else if (dialogConfig.type === 'alert') dialogConfig.resolve(undefined);
                  else if (dialogConfig.type === 'prompt') dialogConfig.resolve(promptInput);
                  setDialogConfig(null);
                }}
                className="px-4 py-1 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications Overlay */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2.5 rounded-lg shadow-xl border text-xs font-medium text-white transition animate-in slide-in-from-top-2 ${
              t.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : t.type === 'error'
                ? 'bg-red-950/90 border-red-500/40 text-red-200'
                : t.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                : 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
            }`}
          >
            {t.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Offline Connectivity Notification */}
      <OfflineIndicator />
    </div>
  );
}
