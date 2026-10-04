import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SQLiteEngine } from './engine/sqliteEngine';
import { FileStorageEngine } from './engine/fileStorage';
import { DropboxSyncEngine } from './engine/dropboxSync';
import { PluginEngine } from './engine/pluginEngine';
import { TableSchema, SavedQuery, QueryResult } from './types/sqlite';
import { PluginRecord, GAWContext } from './types/plugin';
import { SavedReport } from './types/report';
import { ConflictDetails, StorageMetadata } from './types/storage';
import { RecentFilesManager } from './engine/recentFiles';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { QueryGrid } from './components/QueryGrid';
import { GAWIDE, TargetTabInfo } from './components/IDE/GAWIDE';
import { SpreadsheetView } from './components/SpreadsheetView';
import { ReportViewer } from './components/ReportViewer';
import { ReportBuilder } from './components/ReportBuilder';
import { PluginHost } from './components/PluginHost';
import { AIAssistant } from './components/AIAssistant';
import { AddPluginModal } from './components/AddPluginModal';
import { DropboxModal } from './components/DropboxModal';
import { SettingsModal } from './components/SettingsModal';
import { ConflictDialog } from './components/ConflictDialog';
import { OfflineIndicator } from './components/OfflineIndicator';
import { FilePane } from './components/panes/FilePane';
import { ViewPane } from './components/panes/ViewPane';
import { DatabasePane } from './components/panes/DatabasePane';
import { PluginsPane } from './components/panes/PluginsPane';
import { HelpPane } from './components/panes/HelpPane';

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
  Cloud,
} from 'lucide-react';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export default function App() {
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Theme (reads from localStorage immediately for zero-flicker initialization)
  const [theme, setTheme] = useState<'vs-dark' | 'vs-light'>(() => {
    const saved = localStorage.getItem('gaw_theme');
    if (saved === 'vs-dark' || saved === 'vs-light') return saved;
    return 'vs-dark';
  });

  // Navigation: Active Route & Active View
  // Routes: 'file' | 'view' | 'database' | 'plugins' | 'help'
  // Views: 'file', 'view', 'database', 'plugins', 'help', 'table:...', 'query:...', 'report:...', 'plugin:...', 'ide', 'spreadsheet'
  const [activeRoute, setActiveRoute] = useState<'file' | 'view' | 'database' | 'plugins' | 'help'>('file');
  const [activeView, setActiveView] = useState<string>('file');

  // Sidebar state loaded from & persisted to localStorage
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('gaw_sidebar_open');
    if (saved !== null) return saved === 'true';
    return false;
  });

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('gaw_sidebar_open', String(next));
      return next;
    });
  }, []);

  const setSidebarOpenWithStorage = useCallback((open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem('gaw_sidebar_open', String(open));
  }, []);

  // Hash Navigation Helper
  const navigateTo = useCallback((route: string, view?: string) => {
    let targetHash = `#${route}`;
    if (view && view !== route) {
      if (view.startsWith('table:')) targetHash = `#table/${view.replace('table:', '')}`;
      else if (view.startsWith('query:')) targetHash = `#query/${view.replace('query:', '')}`;
      else if (view.startsWith('report:')) targetHash = `#report/${view.replace('report:', '')}`;
      else if (view.startsWith('plugin:')) targetHash = `#plugin/${view.replace('plugin:', '')}`;
      else if (view === 'spreadsheet') targetHash = '#spreadsheet';
      else if (view === 'ide') targetHash = '#ide';
    }
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, []);

  // Database metadata & collections
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const [appTitle, setAppTitle] = useState('New Application');

  // Active query result for table/query views
  const [activeQueryResult, setActiveQueryResult] = useState<QueryResult | null>(null);
  const [activeQueryTitle, setActiveQueryTitle] = useState<string>('');

  // Storage and Sync Metadata
  const storageEngine = useMemo(() => FileStorageEngine.getInstance(), []);
  const dropboxEngine = useMemo(() => DropboxSyncEngine.getInstance(), []);
  const [storageMeta, setStorageMeta] = useState<StorageMetadata>(storageEngine.getMetadata());
  const [activeConflict, setActiveConflict] = useState<ConflictDetails | null>(null);

  // Modals
  const [showDropboxModal, setShowDropboxModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [reportToEdit, setReportToEdit] = useState<SavedReport | null>(null);
  const [showAddPluginModal, setShowAddPluginModal] = useState(false);
  const [oauthCallbackStatus, setOauthCallbackStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [oauthCallbackError, setOauthCallbackError] = useState<string>('');

  // Target tab to open and edit in IDE
  const [ideTargetTab, setIdeTargetTab] = useState<TargetTabInfo | null>(null);

  // VS Code Studio full-interface mode toggle (stored in localStorage)
  const [isVSCodeMode, setIsVSCodeMode] = useState<boolean>(() => {
    return localStorage.getItem('gaw_vscode_mode') === 'true';
  });

  const handleToggleVSCodeMode = useCallback(() => {
    setIsVSCodeMode((prev) => {
      const next = !prev;
      localStorage.setItem('gaw_vscode_mode', String(next));
      return next;
    });
    setActiveView('ide');
  }, []);

  // Keyboard shortcut listener for Ctrl+Shift+F or Ctrl+Shift+M to toggle full VS Code mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'F' || e.key === 'f' || e.key === 'M' || e.key === 'm')
      ) {
        e.preventDefault();
        handleToggleVSCodeMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleVSCodeMode]);

  // Two-Stage Deletion Confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    stage: 1 | 2;
    type: 'plugin' | 'table' | 'query' | 'report';
    id: string;
    name: string;
  } | null>(null);

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

  const handleConfirmDialog = useCallback(
    (message: string) => dialogApi.confirm(message),
    [dialogApi]
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

      const title = engine.getSetting('app_title', 'New Application');
      setAppTitle(title);
    } catch (e) {
      console.error('Failed to refresh database state:', e);
    }
  }, []);

  // On initial load or refresh, set saving to manual only
  useEffect(() => {
    storageEngine.setAutoSyncEnabled(false);
    storageEngine.setAutoSyncInterval(0);
    dropboxEngine.setAutoSyncEnabled(false);
    dropboxEngine.setAutoSyncInterval(0);
  }, [storageEngine, dropboxEngine]);

  // Automatically connect to previous active storage target on startup (remember local or dropbox)
  useEffect(() => {
    dropboxEngine.autoConnectIfActive().then((connected) => {
      if (connected) {
        refreshDatabaseState();
      }
    });
  }, [dropboxEngine, refreshDatabaseState]);

  // Handle OAuth callback (Dropbox PKCE) and listen for popup messages
  useEffect(() => {
    // 1. Check if the current window was loaded as the OAuth callback redirect
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const isAuthCallback = window.location.pathname.startsWith('/auth/callback') || searchParams.has('code');

    if (code && isAuthCallback) {
      setOauthCallbackStatus('processing');
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'DROPBOX_OAUTH_CODE', code }, '*');
        } catch (e) {
          console.error('Failed to postMessage to opener:', e);
        }
      }
      localStorage.setItem('dropbox_pending_code', code);

      // Exchange code in current window (handles both popup and direct redirect)
      const dropbox = DropboxSyncEngine.getInstance();
      const storedRedirect =
        sessionStorage.getItem('dropbox_redirect_uri') ||
        localStorage.getItem('dropbox_redirect_uri') ||
        `${window.location.origin}/`;

      dropbox
        .exchangeCode(code, storedRedirect)
        .then((success) => {
          if (success) {
            dropbox.setActiveTarget('dropbox');
            storageEngine.setActiveTarget('dropbox');
            setOauthCallbackStatus('success');
            setTimeout(() => {
              try {
                window.close();
              } catch (e) {}
            }, 800);
          } else {
            setOauthCallbackStatus('error');
            setOauthCallbackError('Token validation failed after code exchange.');
          }
        })
        .catch((err: any) => {
          setOauthCallbackStatus('error');
          setOauthCallbackError(err.message || 'Dropbox connection failed');
        })
        .finally(() => {
          window.history.replaceState({}, '', window.location.pathname || '/');
        });
    }

    // 2. Main window listener: receive OAuth code from popup window
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'DROPBOX_OAUTH_CODE' && event.data.code) {
        const dropbox = DropboxSyncEngine.getInstance();
        const storedRedirect =
          sessionStorage.getItem('dropbox_redirect_uri') ||
          localStorage.getItem('dropbox_redirect_uri') ||
          `${window.location.origin}/`;
        try {
          const success = await dropbox.exchangeCode(event.data.code, storedRedirect);
          if (success) {
            dropbox.setActiveTarget('dropbox');
            storageEngine.setActiveTarget('dropbox');
            addToast('success', 'Connected to Dropbox successfully!');
            refreshDatabaseState();
          }
        } catch (err: any) {
          addToast('error', `Dropbox connection failed: ${err.message}`);
        }
      }
    };

    // 3. Fallback & Cross-tab sync: storage event listener
    const handleStorageEvent = async (e: StorageEvent) => {
      if (e.key === 'gaw_dropbox_auth_broadcast' || e.key === 'gaw_dropbox_config') {
        dropboxEngine.reloadFromStorage();
        refreshDatabaseState();
      }
      if (e.key === 'dropbox_pending_code' && e.newValue) {
        const pendingCode = e.newValue;
        localStorage.removeItem('dropbox_pending_code');
        const dropbox = DropboxSyncEngine.getInstance();
        const storedRedirect =
          sessionStorage.getItem('dropbox_redirect_uri') ||
          localStorage.getItem('dropbox_redirect_uri') ||
          `${window.location.origin}/`;
        try {
          const success = await dropbox.exchangeCode(pendingCode, storedRedirect);
          if (success) {
            dropbox.setActiveTarget('dropbox');
            storageEngine.setActiveTarget('dropbox');
            addToast('success', 'Connected to Dropbox successfully!');
            refreshDatabaseState();
          }
        } catch (err: any) {
          // If already exchanged, ignore gracefully
        }
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [addToast, refreshDatabaseState, storageEngine, dropboxEngine]);

  // Open any object in IDE
  const handleOpenInIDE = useCallback(
    (tab?: { type: 'plugin' | 'table' | 'query' | 'report' | 'sql'; id?: string; name?: string; code?: string }) => {
      if (tab && (tab.id || tab.name || tab.code)) {
        setIdeTargetTab({
          type: tab.type,
          id: tab.id,
          name: tab.name,
          code: tab.code,
          timestamp: Date.now(),
        });
      }
      setActiveView('ide');
      setActiveRoute('view');
      navigateTo('view', 'ide');
    },
    [navigateTo]
  );

  // Trigger two-stage deletion confirmation
  const handleDeleteObject = useCallback(
    (type: 'plugin' | 'table' | 'query' | 'report', id: string, name: string) => {
      if (type === 'table') {
        const engine = SQLiteEngine.getInstance();
        if (engine.isSystemTable(name)) {
          toastApi.error(`Table "${name}" is a protected system table and cannot be deleted.`);
          return;
        }
      }
      if (type === 'plugin' && (id === 'plugin_manager' || id === 'plugin_local_storage' || id === 'plugin_file_manager')) {
        toastApi.warning(`"${name}" is a core system plugin and cannot be removed to maintain application operation.`);
        return;
      }
      setDeleteTarget({
        stage: 1,
        type,
        id,
        name,
      });
    },
    [toastApi]
  );

  // Execute confirmed deletion
  const executeDeleteObject = useCallback(() => {
    if (!deleteTarget) return;
    const { type, id, name } = deleteTarget;
    if (type === 'plugin' && (id === 'plugin_manager' || id === 'plugin_local_storage' || id === 'plugin_file_manager')) {
      toastApi.warning(`Cannot delete core system plugin "${name}".`);
      setDeleteTarget(null);
      return;
    }
    const engine = SQLiteEngine.getInstance();

    try {
      if (type === 'table') {
        engine.deleteTable(name);
      } else if (type === 'plugin') {
        engine.deletePlugin(id);
      } else if (type === 'query') {
        engine.deleteQuery(id);
      } else if (type === 'report') {
        engine.deleteReport(id);
      }

      toastApi.success(`Permanently deleted ${type} "${name}".`);
      refreshDatabaseState();

      if (
        (type === 'table' && activeView === `table:${name}`) ||
        (type === 'plugin' && activeView === `plugin:${id}`) ||
        (type === 'query' && activeView === `query:${id}`) ||
        (type === 'report' && activeView === `report:${id}`)
      ) {
        setActiveView('plugin:plugin_crm');
      }
    } catch (err: any) {
      toastApi.error(`Failed to delete ${type}: ${err.message}`);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, toastApi, refreshDatabaseState, activeView]);

  // Subscribe to SQLiteEngine internal changes
  useEffect(() => {
    const engine = SQLiteEngine.getInstance();
    const unsub = engine.subscribe(() => {
      storageEngine.markDirty();
      refreshDatabaseState();
    });
    return unsub;
  }, [storageEngine, refreshDatabaseState]);

  // Sync real-time storage & sync target changes
  useEffect(() => {
    const unsubStorage = storageEngine.onStatusChange((meta) => {
      setStorageMeta(meta);
    });
    const unsubDropbox = dropboxEngine.subscribe(() => {
      setStorageMeta(storageEngine.getMetadata());
    });
    return () => {
      unsubStorage();
      unsubDropbox();
    };
  }, [storageEngine, dropboxEngine]);

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
            setSidebarOpen(true);
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
  const handleSelectTable = useCallback((tableName: string, updateHash: boolean = true) => {
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
      setActiveRoute('view');
      if (updateHash) {
        navigateTo('view', `table:${tableName}`);
      }
    } catch (err: any) {
      toastApi.error('Error opening table: ' + err.message);
    }
  }, [navigateTo, toastApi]);

  // Navigate to Query View
  const handleSelectQuery = useCallback((q: SavedQuery, updateHash: boolean = true) => {
    const engine = SQLiteEngine.getInstance();
    try {
      const results = engine.exec(q.query);
      if (results.length > 0) {
        setActiveQueryResult(results[0]);
        setActiveQueryTitle(q.name);
        setActiveView(`query:${q.id}`);
        setActiveRoute('view');
        if (updateHash) {
          navigateTo('view', `query:${q.id}`);
        }
      }
    } catch (err: any) {
      toastApi.error('Error running query: ' + err.message);
    }
  }, [navigateTo, toastApi]);

  // Open Spreadsheet with specific data
  const handleOpenSpreadsheet = useCallback((
    data?: { columns: string[]; values: any[][] },
    sheetName: string = 'Data',
    updateHash: boolean = true
  ) => {
    if (data) {
      setSpreadsheetInitialSheets([{ name: sheetName, columns: data.columns, values: data.values }]);
    }
    setActiveView('spreadsheet');
    setActiveRoute('view');
    if (updateHash) {
      navigateTo('view', 'spreadsheet');
    }
  }, [navigateTo]);

  // Hash route parsing and synchronization
  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (!hash || hash === 'file') {
        setActiveRoute('file');
        setActiveView('file');
        if (!window.location.hash || window.location.hash === '#') {
          window.location.hash = '#file';
        }
      } else if (hash === 'view') {
        setActiveRoute('view');
        setActiveView('view');
      } else if (hash === 'database') {
        setActiveRoute('database');
        setActiveView('database');
      } else if (hash === 'plugins') {
        setActiveRoute('plugins');
        setActiveView('plugins');
      } else if (hash === 'help') {
        setActiveRoute('help');
        setActiveView('help');
      } else if (hash === 'spreadsheet') {
        setActiveRoute('view');
        setActiveView('spreadsheet');
      } else if (hash.startsWith('ide')) {
        setActiveRoute('view');
        setActiveView('ide');
      } else if (hash.startsWith('table/')) {
        const tName = hash.replace('table/', '');
        handleSelectTable(tName, false);
      } else if (hash.startsWith('query/')) {
        const qId = hash.replace('query/', '');
        const q = queries.find((item) => item.id === qId);
        if (q) {
          handleSelectQuery(q, false);
        } else {
          setActiveRoute('view');
          setActiveView(`query:${qId}`);
        }
      } else if (hash.startsWith('report/')) {
        const rId = hash.replace('report/', '');
        setActiveRoute('view');
        setActiveView(`report:${rId}`);
      } else if (hash.startsWith('plugin/')) {
        const pId = hash.replace('plugin/', '');
        setActiveRoute('plugins');
        setActiveView(`plugin:${pId}`);
      }
    };

    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, [queries, tables, handleSelectTable, handleSelectQuery]);

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
        openIDE: (tab) => handleOpenInIDE(tab),
      },
      eventBus: eventBusApi,
      theme,
      plugin: activePluginRecord,
      storage: {
        getMetadata: () => storageEngine.getMetadata(),
        save: async () => {
          const ok = await storageEngine.save();
          if (ok) refreshDatabaseState();
          return ok;
        },
        saveAs: async (suggestedName) => {
          const ok = await storageEngine.saveAs(suggestedName);
          if (ok) refreshDatabaseState();
          return ok;
        },
        openFile: async () => {
          const ok = await storageEngine.openFile();
          if (ok) {
            toastApi.success('Database opened successfully.');
            setSidebarOpen(true);
            refreshDatabaseState();
          }
          return ok;
        },
        exportDownload: (fileName) => storageEngine.exportDownload(fileName),
        setAutoSyncInterval: (sec) => storageEngine.setAutoSyncInterval(sec),
        setAutoSyncEnabled: (en) => storageEngine.setAutoSyncEnabled(en),
        setActiveTarget: (target) => {
          storageEngine.setActiveTarget(target);
          dropboxEngine.setActiveTarget(target);
          refreshDatabaseState();
        },
        onStatusChange: (listener) => storageEngine.onStatusChange(listener),
      },
      dropbox: {
        getConfig: () => dropboxEngine.getConfig(),
        setAccessToken: async (token) => {
          const ok = await dropboxEngine.setAccessToken(token);
          refreshDatabaseState();
          return ok;
        },
        setClientId: (clientId) => dropboxEngine.setClientId(clientId),
        disconnect: () => {
          dropboxEngine.disconnect();
          refreshDatabaseState();
        },
        validateToken: async () => dropboxEngine.validateToken(),
        initiateOAuthFlow: async (clientId, redirectUri) => dropboxEngine.initiateOAuthFlow(clientId, redirectUri),
        listDatabaseFiles: async (folderPath) => dropboxEngine.listDatabaseFiles(folderPath),
        downloadFile: async (fileItem) => {
          const ok = await dropboxEngine.downloadFile(fileItem);
          if (ok) {
            setSidebarOpen(true);
            refreshDatabaseState();
            toastApi.success(`Loaded ${fileItem.name} from Dropbox.`);
          }
          return ok;
        },
        uploadActiveDatabase: async (targetPath) => dropboxEngine.uploadActiveDatabase(targetPath),
        setAutoSyncInterval: (sec) => dropboxEngine.setAutoSyncInterval(sec),
        setAutoSyncEnabled: (en) => dropboxEngine.setAutoSyncEnabled(en),
        setActiveTarget: (target) => {
          dropboxEngine.setActiveTarget(target);
          storageEngine.setActiveTarget(target);
          refreshDatabaseState();
        },
        subscribe: (listener) => dropboxEngine.subscribe(listener),
        getCurrentRemoteFile: () => dropboxEngine.getCurrentRemoteFile(),
        getLastSyncTime: () => dropboxEngine.getLastSyncTime(),
      },
      plugins: {
        getAll: () => SQLiteEngine.getInstance().getPlugins(),
        toggleEnabled: (pluginId, enabled) => {
          SQLiteEngine.getInstance().setPluginEnabled(pluginId, enabled);
          refreshDatabaseState();
          eventBusApi.emit('db_changed');
        },
        delete: (pluginId) => {
          if (pluginId === 'plugin_manager' || pluginId === 'plugin_local_storage' || pluginId === 'plugin_file_manager') {
            toastApi.warning('Core system plugins cannot be deleted.');
            return;
          }
          SQLiteEngine.getInstance().deletePlugin(pluginId);
          refreshDatabaseState();
          eventBusApi.emit('db_changed');
        },
        importPlugin: (plugin) => {
          if (!plugin.id || !plugin.name || !plugin.code) return;
          SQLiteEngine.getInstance().savePlugin({
            id: plugin.id,
            name: plugin.name,
            version: plugin.version || '1.0.0',
            enabled: plugin.enabled !== undefined ? plugin.enabled : 1,
            icon: plugin.icon || 'Puzzle',
            menu_category: plugin.menu_category || 'Custom',
            route: plugin.route || `/${plugin.id}`,
            description: plugin.description || '',
            code: plugin.code,
          });
          refreshDatabaseState();
          eventBusApi.emit('db_changed');
        },
        openInIDE: (pluginId, name) => {
          const p = SQLiteEngine.getInstance().getPlugins().find((item) => item.id === pluginId);
          handleOpenInIDE({
            type: 'plugin',
            id: pluginId,
            name: name || p?.name,
            code: p?.code,
          });
        },
        openAddModal: () => {
          setShowAddPluginModal(true);
        },
      },
      workspace: {
        toggleSidebar: () => setSidebarOpen((prev) => !prev),
        openSidebar: () => setSidebarOpen(true),
        setSidebarOpen: (open: boolean) => setSidebarOpen(open),
        isSidebarOpen: () => sidebarOpen,
        getRecentFiles: () => RecentFilesManager.getRecentFiles(),
        addRecentFile: (item) => {
          RecentFilesManager.addRecentFile(item);
          eventBusApi.emit('recent_files_changed');
        },
        removeRecentFile: (id) => {
          RecentFilesManager.removeRecentFile(id);
          eventBusApi.emit('recent_files_changed');
        },
        clearRecentFiles: () => {
          RecentFilesManager.clearRecentFiles();
          eventBusApi.emit('recent_files_changed');
        },
        loadNorthwindDemo: () => {
          SQLiteEngine.getInstance().createNorthwindDemoDatabase();
          RecentFilesManager.addRecentFile({
            name: 'Northwind Modern Commerce Demo',
            source: 'demo',
            path: 'northwind_commerce.db',
          });
          setSidebarOpen(true);
          refreshDatabaseState();
          setActiveView('plugin:plugin_crm');
          setActiveRoute('plugins');
          navigateTo('plugins', 'plugin:plugin_crm');
          toastApi.success('Northwind Demo database opened.');
        },
        closeDatabase: async () => {
          storageEngine.closeFile();
          SQLiteEngine.getInstance().createMinimalDatabase('new_database.sqlite', 'New Application', 'None');
          refreshDatabaseState();
          setActiveView('file');
          setActiveRoute('file');
          navigateTo('file', 'file');
          toastApi.info('Active database reset to new database.');
        },
      },
    };
  }, [
    plugins,
    activeView,
    sidebarOpen,
    toastApi,
    dialogApi,
    eventBusApi,
    theme,
    storageEngine,
    dropboxEngine,
    handleOpenInIDE,
    handleOpenSpreadsheet,
    refreshDatabaseState,
  ]);

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

  if (oauthCallbackStatus !== 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl animate-fade-in">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Cloud className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white">Dropbox Authentication</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {oauthCallbackStatus === 'success'
              ? 'Successfully authenticated with Dropbox!'
              : oauthCallbackStatus === 'error'
              ? oauthCallbackError || 'Authentication failed. Please verify your credentials.'
              : 'Verifying authorization code and securing session...'}
          </p>
          {oauthCallbackStatus === 'success' && (
            <div className="pt-2 space-y-3">
              <p className="text-[11px] text-emerald-400 font-semibold">
                ✓ Connected! You can now close this window and return to your application.
              </p>
              <button
                onClick={() => {
                  try {
                    window.close();
                  } catch (e) {
                    setOauthCallbackStatus('idle');
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition active:scale-95"
              >
                Close Window
              </button>
            </div>
          )}
          {oauthCallbackStatus === 'error' && (
            <div className="pt-2">
              <button
                onClick={() => setOauthCallbackStatus('idle')}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95"
              >
                Return to Application
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isEngineReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-amber-400/60 animate-pulse bg-slate-900 flex items-center justify-center p-1">
            <img src="/gawkyy-cat-256x256.png" alt="Gawkyy" className="w-full h-full object-cover" />
          </div>
          <div className="text-center">
            <h2 className="text-base font-bold text-white">Loading Gawkyy...</h2>
            <p className="text-xs text-slate-400 mt-1">Mounting portable database runtime (sql.js WebAssembly)...</p>
          </div>
        </div>
      </div>
    );
  }

  // Active object references
  const currentPlugin = plugins.find((p) => activeView === `plugin:${p.id}`);
  const currentReport = reports.find((r) => activeView === `report:${r.id}`);

  const isFullVSCode = activeView === 'ide' && isVSCodeMode;

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${theme === 'vs-dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Top Application Header & Menus (Hidden in full VS Code mode) */}
      {!isFullVSCode && (
        <Navbar
          theme={theme}
          activeRoute={activeRoute}
          onSelectRoute={(route) => {
            setActiveRoute(route as any);
            setActiveView(route);
            navigateTo(route, route);
          }}
          onThemeToggle={() => {
            const next = theme === 'vs-dark' ? 'vs-light' : 'vs-dark';
            setTheme(next);
            localStorage.setItem('gaw_theme', next);
            eventBusApi.emit('theme_changed', next);
          }}
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={sidebarOpen}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      )}

      {/* Main Workspace Area (Sidebar + Active View) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
        {/* Desktop Sidebar: rendered before main on desktop */}
        {!isFullVSCode && (
          <div className="hidden md:flex h-full">
            <Sidebar
              isOpen={sidebarOpen}
              onToggle={handleToggleSidebar}
              tables={tables}
              queries={queries}
              reports={reports}
              plugins={plugins}
              activeView={activeView}
              onSelectTable={(tableName) => {
                handleSelectTable(tableName);
              }}
              onSelectQuery={(q) => {
                handleSelectQuery(q);
              }}
              onSelectReport={(r) => {
                setActiveView(`report:${r.id}`);
                setActiveRoute('view');
                navigateTo('view', `report:${r.id}`);
              }}
              onSelectPlugin={(p) => {
                setActiveView(`plugin:${p.id}`);
                setActiveRoute('plugins');
                navigateTo('plugins', `plugin:${p.id}`);
              }}
              onOpenSpreadsheet={() => handleOpenSpreadsheet()}
              onOpenIDE={handleOpenInIDE}
              onNewReport={() => {
                setReportToEdit(null);
                setShowReportBuilder(true);
              }}
              onEditReportVisual={(r) => {
                setReportToEdit(r);
                setShowReportBuilder(true);
              }}
              onDeleteObject={handleDeleteObject}
              onAddPlugin={() => setShowAddPluginModal(true)}
              onOpenAI={() => setShowAIModal(true)}
              theme={theme}
            />
          </div>
        )}

        {/* Center Canvas */}
        <main
          className={`flex-1 flex flex-col overflow-hidden min-w-0 select-text ${
            sidebarOpen ? 'max-md:portrait:hidden' : ''
          } ${theme === 'vs-dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}
        >
          {/* Pane 1: File Route */}
          {activeRoute === 'file' && activeView === 'file' && (
            <FilePane
              storageMeta={storageMeta}
              theme={theme}
              onNewDatabase={() => {
                SQLiteEngine.getInstance().createMinimalDatabase('new_database.sqlite', 'New Application', 'None');
                toastApi.success('Created new database (new_database.sqlite).');
                refreshDatabaseState();
                setActiveRoute('file');
                setActiveView('file');
                navigateTo('file', 'file');
              }}
              onOpenFile={async () => {
                const ok = await storageEngine.openFile();
                if (ok) {
                  toastApi.success('Opened database file successfully.');
                  setSidebarOpenWithStorage(true);
                  refreshDatabaseState();
                  setActiveView('view');
                  navigateTo('view', 'view');
                }
              }}
              onOpenDropbox={() => setShowDropboxModal(true)}
              onOpenFileManager={() => {
                setActiveView('plugin:plugin_file_manager');
                setActiveRoute('plugins');
                navigateTo('plugins', 'plugin:plugin_file_manager');
              }}
              onOpenDemo={() => {
                SQLiteEngine.getInstance().createNorthwindDemoDatabase();
                RecentFilesManager.addRecentFile({
                  name: 'Northwind Modern Commerce Demo',
                  source: 'demo',
                  path: 'northwind_commerce.db',
                });
                toastApi.success('Loaded Northwind Modern Commerce Demo.');
                setSidebarOpenWithStorage(true);
                refreshDatabaseState();
                setActiveView('plugin:plugin_crm');
                setActiveRoute('plugins');
                navigateTo('plugins', 'plugin:plugin_crm');
              }}
              onOpenSettings={() => setShowSettingsModal(true)}
              onOpenPlugin={(pId) => {
                setActiveView(`plugin:${pId}`);
                setActiveRoute('plugins');
                navigateTo('plugins', `plugin:${pId}`);
              }}
              onToast={addToast}
              onConfirm={handleConfirmDialog}
            />
          )}

          {/* Pane 2: View Hub */}
          {activeRoute === 'view' && activeView === 'view' && (
            <ViewPane
              theme={theme}
              tables={tables}
              queries={queries}
              reports={reports}
              plugins={plugins}
              isVSCodeMode={isVSCodeMode}
              onOpenSpreadsheet={() => handleOpenSpreadsheet()}
              onOpenIDE={handleOpenInIDE}
              onToggleVSCodeMode={handleToggleVSCodeMode}
              onSelectView={(v) => {
                setActiveView(v);
                navigateTo('view', v);
              }}
            />
          )}

          {/* Pane 3: Database Hub */}
          {activeRoute === 'database' && activeView === 'database' && (
            <DatabasePane
              theme={theme}
              tables={tables}
              onOpenIDE={handleOpenInIDE}
              onOpenSettings={() => setShowSettingsModal(true)}
              onResetDefault={() => {
                SQLiteEngine.getInstance().createNorthwindDemoDatabase();
                toastApi.success('Loaded Northwind Modern Commerce template.');
                setSidebarOpenWithStorage(true);
                refreshDatabaseState();
                setActiveView('plugin:plugin_crm');
                setActiveRoute('plugins');
                navigateTo('plugins', 'plugin:plugin_crm');
              }}
              onSelectView={(v) => {
                setActiveView(v);
                navigateTo('view', v);
              }}
              onToast={addToast}
            />
          )}

          {/* Pane 4: Plugins Marketplace / Hub */}
          {activeRoute === 'plugins' && activeView === 'plugins' && (
            <PluginsPane
              theme={theme}
              plugins={plugins}
              onOpenIDE={handleOpenInIDE}
              onAddPlugin={() => setShowAddPluginModal(true)}
              onSelectView={(v) => {
                setActiveView(v);
                navigateTo('plugins', v);
              }}
              onTogglePlugin={(plugin) => {
                const newEnabled = plugin.enabled === 1 ? false : true;
                SQLiteEngine.getInstance().setPluginEnabled(plugin.id, newEnabled);
                refreshDatabaseState();
                toastApi.info(`${plugin.name} is now ${newEnabled ? 'enabled' : 'disabled'}.`);
              }}
            />
          )}

          {/* Pane 5: Help Route */}
          {activeRoute === 'help' && activeView === 'help' && (
            <HelpPane
              theme={theme}
              onOpenAI={() => setShowAIModal(true)}
              onOpenSettings={() => setShowSettingsModal(true)}
              onOpenPlugin={(pId) => {
                setActiveView(`plugin:${pId}`);
                setActiveRoute('plugins');
                navigateTo('plugins', `plugin:${pId}`);
              }}
            />
          )}

          {/* View 1: Active Dynamic TSX Plugin */}
          {activeView.startsWith('plugin:') && currentPlugin && (
            <div className="flex-1 min-h-0 h-full w-full overflow-hidden flex flex-col select-text">
              <PluginHost
                code={currentPlugin.code}
                pluginName={currentPlugin.name}
                pluginId={currentPlugin.id}
                theme={theme}
                gawContext={gawContext}
                onOpenInIDE={() => handleOpenInIDE({ type: 'plugin', id: currentPlugin.id, name: currentPlugin.name })}
              />
            </div>
          )}

          {/* View 2: Table or Query Grid */}
          {(activeView.startsWith('table:') || activeView.startsWith('query:')) && activeQueryResult && (
            <div className="flex-1 flex flex-col overflow-hidden select-text">
              <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveView('view');
                      navigateTo('view', 'view');
                    }}
                    className="text-slate-400 hover:text-white transition"
                    title="Back to View Hub"
                  >
                    ← View
                  </button>
                  <span className="text-slate-600">/</span>
                  <span className="font-bold text-white">{activeQueryTitle}</span>
                </div>
                {activeView.startsWith('query:') && (
                  <button
                    onClick={() => {
                      const qId = activeView.replace('query:', '');
                      const foundQ = queries.find((q) => q.id === qId);
                      handleOpenInIDE({ type: 'query', id: qId, name: foundQ?.name || activeQueryTitle });
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  >
                    Edit Query in IDE
                  </button>
                )}
                {activeView.startsWith('table:') && (
                  <button
                    onClick={() => {
                      const tName = activeView.replace('table:', '');
                      handleOpenInIDE({ type: 'table', name: tName });
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  >
                    Edit Structure in IDE
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
            <div className="flex-1 overflow-hidden select-text">
              <ReportViewer
                report={currentReport}
                onEdit={() => {
                  setReportToEdit(currentReport);
                  setShowReportBuilder(true);
                }}
                onBack={() => {
                  setActiveView('view');
                  navigateTo('view', 'view');
                }}
                theme={theme}
              />
            </div>
          )}

          {/* View 4: Embedded Spreadsheet Studio */}
          {activeView === 'spreadsheet' && (
            <div className="flex-1 overflow-hidden select-text">
              <SpreadsheetView
                initialSheets={spreadsheetInitialSheets}
                onClose={() => {
                  setActiveView('view');
                  navigateTo('view', 'view');
                }}
                theme={theme}
              />
            </div>
          )}

          {/* View 5: Internal Monaco Editor IDE */}
          {activeView === 'ide' && (
            <div className="flex-1 overflow-hidden select-text">
              <GAWIDE
                targetTab={ideTargetTab}
                onClearTargetTab={() => setIdeTargetTab(null)}
                onOpenSpreadsheet={handleOpenSpreadsheet}
                onOpenAI={() => setShowAIModal(true)}
                theme={theme}
                gawContext={gawContext}
                isVSCodeMode={isVSCodeMode}
                onToggleVSCodeMode={handleToggleVSCodeMode}
              />
            </div>
          )}
        </main>

        {/* Mobile Side Panel: rendered at the end AFTER plugin/pane output, but BEFORE bottom status bar! */}
        {/* If mobile is in portrait mode, it takes up the whole screen height! */}
        {!isFullVSCode && sidebarOpen && (
          <div className="flex md:hidden w-full max-md:portrait:h-full max-md:portrait:flex-1 max-md:landscape:h-72 border-t border-slate-800 overflow-hidden">
            <Sidebar
              isOpen={sidebarOpen}
              onToggle={handleToggleSidebar}
              tables={tables}
              queries={queries}
              reports={reports}
              plugins={plugins}
              activeView={activeView}
              onSelectTable={(tableName) => {
                handleSelectTable(tableName);
                setSidebarOpenWithStorage(false);
              }}
              onSelectQuery={(q) => {
                handleSelectQuery(q);
                setSidebarOpenWithStorage(false);
              }}
              onSelectReport={(r) => {
                setActiveView(`report:${r.id}`);
                setActiveRoute('view');
                navigateTo('view', `report:${r.id}`);
                setSidebarOpenWithStorage(false);
              }}
              onSelectPlugin={(p) => {
                setActiveView(`plugin:${p.id}`);
                setActiveRoute('plugins');
                navigateTo('plugins', `plugin:${p.id}`);
                setSidebarOpenWithStorage(false);
              }}
              onOpenSpreadsheet={() => {
                handleOpenSpreadsheet();
                setSidebarOpenWithStorage(false);
              }}
              onOpenIDE={(tab) => {
                handleOpenInIDE(tab);
                setSidebarOpenWithStorage(false);
              }}
              onNewReport={() => {
                setReportToEdit(null);
                setShowReportBuilder(true);
                setSidebarOpenWithStorage(false);
              }}
              onEditReportVisual={(r) => {
                setReportToEdit(r);
                setShowReportBuilder(true);
                setSidebarOpenWithStorage(false);
              }}
              onDeleteObject={handleDeleteObject}
              onAddPlugin={() => setShowAddPluginModal(true)}
              onOpenAI={() => setShowAIModal(true)}
              theme={theme}
            />
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        storageMeta={storageMeta}
        tableCount={tables.length}
        pluginCount={plugins.length}
        theme={theme}
        onOpenSettings={() => setShowSettingsModal(true)}
        isVSCodeMode={isVSCodeMode}
        onToggleVSCodeMode={handleToggleVSCodeMode}
        activeView={activeView}
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
            localStorage.setItem('gaw_theme', newTheme);
            eventBusApi.emit('theme_changed', newTheme);
          }}
        />
      )}

      {/* 3b. Add Dynamic Plugin Modal (Local File/Directory, Dropbox, or IDE) */}
      {showAddPluginModal && (
        <AddPluginModal
          onClose={() => setShowAddPluginModal(false)}
          onPluginAdded={(newPlugin, openInIDE) => {
            toastApi.success(`Installed dynamic plugin "${newPlugin.name}" into SQLite!`);
            refreshDatabaseState();
            if (openInIDE) {
              handleOpenInIDE({ type: 'plugin', id: newPlugin.id, name: newPlugin.name });
            } else {
              setActiveView(`plugin:${newPlugin.id}`);
            }
          }}
          onOpenDropboxSettings={() => {
            setShowAddPluginModal(false);
            setActiveView('plugin:plugin_dropbox_sync');
          }}
          theme={theme}
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

      {/* 6. Two-Stage Deletion Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-text">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 text-slate-100 flex flex-col space-y-4">
            {deleteTarget.stage === 1 ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-950/80 border border-amber-600/60 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white capitalize">
                      Delete {deleteTarget.type}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Step 1 of 2: Verify item selection
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                  <p className="text-slate-300">
                    Are you sure you want to remove this {deleteTarget.type} from the database?
                  </p>
                  <p className="font-mono text-amber-400 font-semibold truncate">
                    {deleteTarget.name}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      setDeleteTarget((prev) => (prev ? { ...prev, stage: 2 } : null))
                    }
                    className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition"
                  >
                    Continue to Final Warning...
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-950/80 border border-red-600/60 flex items-center justify-center text-red-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      ⚠️ Permanent Deletion Warning
                    </h3>
                    <p className="text-xs text-red-400 font-semibold">
                      Step 2 of 2: Irreversible Action
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-xs space-y-2">
                  <p className="text-red-200">
                    This action <strong>CANNOT</strong> be undone. The {deleteTarget.type}{' '}
                    <strong className="text-white font-mono">"{deleteTarget.name}"</strong> will be permanently removed from your SQLite database.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Click below to execute the permanent deletion.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                  >
                    Keep Object (Cancel)
                  </button>
                  <button
                    onClick={executeDeleteObject}
                    className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-950/50 transition"
                  >
                    Yes, Permanently Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* In-App Dialog Modal (confirm / alert / prompt) */}
      {dialogConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <img src="/gawkyy-cat-64x64.png" alt="Gawkyy" className="w-4 h-4 rounded-full" />
              <span>Gawkyy Dialog</span>
            </h3>
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
