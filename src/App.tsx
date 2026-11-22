/**
 * Official Documentation:
 * - React Hooks (useState, useEffect, useCallback, useMemo, useRef): https://react.dev/reference/react
 * - sql.js (SQLite WebAssembly): https://sql.js.org/
 * - Monaco Editor React: https://github.com/suren-atoyan/monaco-editor-react
 */
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { SQLiteEngine } from './engine/sqliteEngine';
import { FileStorageEngine } from './engine/fileStorage';
import { H2BridgeEngine, formatProviderLabel } from './engine/h2Bridge';
import { PluginEngine } from './engine/pluginEngine';
import { TableSchema, SavedQuery, QueryResult } from './types/sqlite';
import { PluginRecord, GAWContext, isSystemPlugin } from './types/plugin';
import { SavedReport } from './types/report';
import { ConflictDetails, StorageMetadata } from './types/storage';
import { RecentFilesManager } from './engine/recentFiles';
import { safeStorage } from './utils/storage';
import { logDebugStage, APP_START_TIME } from './utils/debugLogger';

import { QueryGrid } from './components/QueryGrid';
import { MultiQueryResultsView } from './components/MultiQueryResultsView';
import type { TargetTabInfo } from './components/IDE/GAWIDE';
import { PluginHost } from './components/PluginHost';
import { ConflictDialog } from './components/ConflictDialog';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DEFAULT_HELP_PLUGIN_CODE } from './engine/defaultPlugins';
import { FiveRegionLayout } from './components/FiveRegionLayout';

// Code-split heavy secondary views and modals so initial app startup stays lightweight
const GAWIDE = lazy(() => import('./components/IDE/GAWIDE').then((m) => ({ default: m.GAWIDE })));
const SpreadsheetView = lazy(() => import('./components/SpreadsheetView').then((m) => ({ default: m.SpreadsheetView })));
const ReportViewer = lazy(() => import('./components/ReportViewer').then((m) => ({ default: m.ReportViewer })));
const ReportBuilder = lazy(() => import('./components/ReportBuilder').then((m) => ({ default: m.ReportBuilder })));
const AIAssistant = lazy(() => import('./components/AIAssistant').then((m) => ({ default: m.AIAssistant })));
const AddPluginModal = lazy(() => import('./components/AddPluginModal').then((m) => ({ default: m.AddPluginModal })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));

import {
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Code2,
  Sparkles,
  LayoutGrid,
  ArrowRight,
} from 'lucide-react';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export default function App() {
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [theme, setTheme] = useState<'vs-dark' | 'vs-light'>(() => {
    const saved = safeStorage.getItem('gaw_theme');
    if (saved === 'vs-dark' || saved === 'vs-light') return saved;
    return 'vs-dark';
  });

  // Synchronize documentElement dark class with active theme
  useEffect(() => {
    if (theme === 'vs-dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Mode state: strictly 2 modes — 'ide' (full workspace studio) and 'app' (end-user application)
  const [mode, setMode] = useState<'ide' | 'app'>(() => {
    const saved = safeStorage.getItem('gaw_mode');
    return saved === 'app' ? 'app' : 'ide';
  });

  // Navigation: Active Route & Active View
  // Routes: 'file' | 'database' | 'plugins' | 'help'
  // Views: 'ide', 'app_hub', 'table:...', 'query:...', 'report:...', 'plugin:...', 'spreadsheet'
  const [activeRoute, setActiveRoute] = useState<'file' | 'database' | 'plugins' | 'help'>(() => {
    const saved = safeStorage.getItem('gaw_mode');
    return saved === 'app' ? 'plugins' : 'file';
  });
  const [activeView, setActiveView] = useState<string>(() => {
    const saved = safeStorage.getItem('gaw_mode');
    return saved === 'app' ? 'app_hub' : 'ide';
  });

  const [lastAppView, setLastAppView] = useState<string | null>(() => {
    return safeStorage.getItem('gaw_last_app_view') || null;
  });

  const [appSettings, setAppSettings] = useState<{
    appName: string;
    appDescription: string;
    initialPlugin: string;
  }>({
    appName: 'New App',
    appDescription: '',
    initialPlugin: 'main',
  });

  // Database metadata & collections
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [plugins, setPlugins] = useState<PluginRecord[]>([]);
  const userPlugins = useMemo(() => plugins.filter((p) => !isSystemPlugin(p) && p.enabled === 1), [plugins]);
  const activePluginsByArea = useMemo(() => {
    const map: Record<'top' | 'bottom' | 'left' | 'right' | 'middle', PluginRecord | null> = {
      top: null,
      bottom: null,
      left: null,
      right: null,
      middle: null,
    };
    plugins.forEach((p) => {
      if (p.enabled !== 0) {
        const area = (p.target_area || p.targetArea || 'middle') as string;
        if (area !== 'not_shown' && area !== 'none' && area in map && !map[area as keyof typeof map]) {
          map[area as keyof typeof map] = p;
        }
      }
    });
    return map;
  }, [plugins]);
  const [appTitle, setAppTitle] = useState('New Application');

  // Layout area dimensions state (persisted to localStorage & t_settings when DB active)
  const [topHeight, setTopHeight] = useState<number>(() => {
    const saved = safeStorage.getItem('gaw_layout_top_height');
    return saved ? Math.max(40, Math.min(400, parseInt(saved, 10))) : 96;
  });
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    const saved = safeStorage.getItem('gaw_layout_bottom_height');
    return saved ? Math.max(20, Math.min(300, parseInt(saved, 10))) : 28;
  });
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = safeStorage.getItem('gaw_layout_left_width');
    return saved ? Math.max(160, Math.min(600, parseInt(saved, 10))) : 280;
  });
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = safeStorage.getItem('gaw_layout_right_width');
    return saved ? Math.max(160, Math.min(600, parseInt(saved, 10))) : 300;
  });

  // Track whether an actual user database file is currently being worked on
  const [isDbActive, setIsDbActive] = useState<boolean>(() => {
    return safeStorage.getItem('gaw_db_active') === 'true';
  });

  // Sidebar state (applies to App Mode layout panes when not hidden; collapsed by default in App Mode)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      safeStorage.setItem('gaw_sidebar_open', String(next));
      return next;
    });
  }, []);

  // Hash Navigation Helper
  const navigateTo = useCallback((route: string, view?: string) => {
    let targetHash = `#${route}`;
    if (view && view !== route) {
      if (view === 'app_hub') targetHash = '#app_hub';
      else if (view.startsWith('table:')) targetHash = `#table/${view.replace('table:', '')}`;
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

  // Helper to determine initial App mode view according to the 3 rules
  const getInitialAppView = useCallback(
    (pluginsList: PluginRecord[], initialPluginSetting: string): string => {
      const activeUserPlugins = pluginsList.filter((p) => !isSystemPlugin(p) && p.enabled === 1);
      // Rule 1: If there is only one user plugin, it is shown.
      if (activeUserPlugins.length === 1) {
        return `plugin:${activeUserPlugins[0].id}`;
      }
      // Rule 2: If there is a plugin with the name in the initial_plugin setting, it is shown.
      if (activeUserPlugins.length > 1) {
        const query = (initialPluginSetting || 'main').trim().toLowerCase();
        const matching = activeUserPlugins.find(
          (p) =>
            p.id.toLowerCase() === query ||
            p.name.toLowerCase() === query ||
            p.route?.toLowerCase() === query ||
            p.route?.toLowerCase() === `/${query}`
        );
        if (matching) {
          return `plugin:${matching.id}`;
        }
        // Rule 3: If there's more than one plugin and none of them tie up with the initial_plugin setting name,
        // then give the user a list of user plugins so that one can be chosen.
        return 'app_hub';
      }
      return 'app_hub';
    },
    []
  );

  // Active query result for table/query views (supporting multiple queries separated by semicolons)
  const [activeQueryResult, setActiveQueryResult] = useState<QueryResult | null>(null);
  const [activeQueryResults, setActiveQueryResults] = useState<QueryResult[]>([]);
  const [activeSavedQuery, setActiveSavedQuery] = useState<SavedQuery | null>(null);
  const [activeQueryTitle, setActiveQueryTitle] = useState<string>('');

  // Storage and Clockie H2 Extension Bridge Engines
  const storageEngine = useMemo(() => FileStorageEngine.getInstance(), []);
  const h2Engine = useMemo(() => H2BridgeEngine.getInstance(), []);
  const [storageMeta, setStorageMeta] = useState<StorageMetadata>(storageEngine.getMetadata());
  const [activeConflict, setActiveConflict] = useState<ConflictDetails | null>(null);

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [reportToEdit, setReportToEdit] = useState<SavedReport | null>(null);
  const [showAddPluginModal, setShowAddPluginModal] = useState(false);

  // Target tab to open and edit in IDE
  const [ideTargetTab, setIdeTargetTab] = useState<TargetTabInfo | null>(null);
  const [currentIdeTarget, setCurrentIdeTarget] = useState<TargetTabInfo | null>(null);
  const ideSaveDirtyRef = useRef<(() => Promise<void>) | null>(null);

  // Two-Stage Deletion Confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    stage: 1 | 2;
    type: 'plugin' | 'table' | 'query' | 'report';
    id: string;
    name: string;
  } | null>(null);

  // Spreadsheet Transfer data & source info
  const [spreadsheetInitialSheets, setSpreadsheetInitialSheets] = useState<
    Array<{ name: string; columns: string[]; values: any[][] }> | undefined
  >(undefined);
  const [spreadsheetSource, setSpreadsheetSource] = useState<{
    type: 'query' | 'table';
    id?: string;
    name: string;
  } | null>(null);
  const spreadsheetReturnTargetRef = useRef<{
    type: 'query' | 'table';
    id?: string;
    name: string;
  } | null>(null);

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

  const handleToggleTheme = useCallback(() => {
    const next = theme === 'vs-dark' ? 'vs-light' : 'vs-dark';
    setTheme(next);
    safeStorage.setItem('gaw_theme', next);
    eventBusApi.emit('theme_changed', next);
  }, [theme, eventBusApi]);

  // Initialize SQLite Engine & Record Startup Milestones
  useEffect(() => {
    let mounted = true;
    const reactMountMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    logDebugStage('App Component Initial Mount', APP_START_TIME, reactMountMs, 'app', 'React DOM content mounted');

    (async () => {
      try {
        const engine = SQLiteEngine.getInstance();
        const appReadyStartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

        // App Ready Step 1: Storage Handle and Permissions Sync
        const step1StartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        // File storage engine instance initialization check
        const step1EndMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        logDebugStage('App Ready 1: File Storage Handle Check', step1StartMs, step1EndMs, 'storage', 'Persisted browser file handle verified');

        // App Ready Step 2: SQLite Engine Async Initialization
        const step2StartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        await engine.init();
        const step2EndMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        logDebugStage('App Ready 2: SQLite Engine Ready Wait', step2StartMs, step2EndMs, 'database', 'SQLite engine instance fully initialized');

        if (mounted) {
          // App Ready Step 3: Engine Saved Status & State Flag Set
          const step3StartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          storageEngine.markSaved();
          setIsEngineReady(true);
          const step3EndMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          logDebugStage('App Ready 3: Engine State Flag Set', step3StartMs, step3EndMs, 'app', 'isEngineReady state set to true');

          // App Ready Step 4: Database State & Schema Hydration
          const step4StartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          refreshDatabaseState();
          const step4EndMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          logDebugStage('App Ready 4: Database State & Schema Hydration', step4StartMs, step4EndMs, 'database', 'Tables, queries, reports and plugins loaded into React state');

          // App Ready Step 5: Route & Hash Resolution
          const step5StartMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const hash = window.location.hash.replace(/^#\/?/, '').trim();
          if (hash.startsWith('table/')) {
            const tName = hash.replace('table/', '');
            handleSelectTable(tName, false);
          } else if (hash.startsWith('query/')) {
            const qId = hash.replace('query/', '');
            const allQ = engine.getSavedQueries();
            const q = allQ.find((item) => item.id === qId);
            if (q) handleSelectQuery(q, false);
          }
          const step5EndMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          logDebugStage('App Ready 5: Initial Route & Hash Navigation', step5StartMs, step5EndMs, 'app', 'Initial route resolved');

          const appReadyEndMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          logDebugStage('App Engine Ready State', appReadyStartMs, appReadyEndMs, 'app', 'All engine systems ready and interactive');

          const fullReadyMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          logDebugStage('Total App Startup Duration', APP_START_TIME, fullReadyMs, 'system', 'Full application loaded and interactive');
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

  // Subscribe to storage status, Clockie H2 bridge updates, and unified conflict notifications
  useEffect(() => {
    const unsubStatus = storageEngine.onStatusChange((meta) => {
      setStorageMeta(meta);
    });

    storageEngine.onConflict((conflict) => {
      setActiveConflict(conflict);
    });

    h2Engine.onConflict((conflict) => {
      setActiveConflict(conflict);
    });

    h2Engine.onNotify((level, message) => {
      addToast(level, message);
    });

    return () => {
      unsubStatus();
    };
  }, [storageEngine, h2Engine, addToast]);

  // Synchronize layout dimensions with t_settings if a database is currently active
  const syncLayoutWithDatabase = useCallback((active: boolean) => {
    if (!active) return;
    const engine = SQLiteEngine.getInstance();
    try {
      const savedTop = engine.getSetting('layout_top_height');
      const savedBottom = engine.getSetting('layout_bottom_height');
      const savedLeft = engine.getSetting('layout_left_width');
      const savedRight = engine.getSetting('layout_right_width');

      if (savedTop && savedBottom && savedLeft && savedRight) {
        const t = Math.max(40, Math.min(400, parseInt(savedTop, 10)));
        const b = Math.max(20, Math.min(300, parseInt(savedBottom, 10)));
        const l = Math.max(160, Math.min(600, parseInt(savedLeft, 10)));
        const r = Math.max(160, Math.min(600, parseInt(savedRight, 10)));

        setTopHeight(t);
        setBottomHeight(b);
        setLeftWidth(l);
        setRightWidth(r);

        safeStorage.setItem('gaw_layout_top_height', String(t));
        safeStorage.setItem('gaw_layout_bottom_height', String(b));
        safeStorage.setItem('gaw_layout_left_width', String(l));
        safeStorage.setItem('gaw_layout_right_width', String(r));
      } else {
        const curTop = parseInt(safeStorage.getItem('gaw_layout_top_height') || '96', 10);
        const curBottom = parseInt(safeStorage.getItem('gaw_layout_bottom_height') || '28', 10);
        const curLeft = parseInt(safeStorage.getItem('gaw_layout_left_width') || '280', 10);
        const curRight = parseInt(safeStorage.getItem('gaw_layout_right_width') || '300', 10);

        setTopHeight(curTop);
        setBottomHeight(curBottom);
        setLeftWidth(curLeft);
        setRightWidth(curRight);
      }
    } catch (e) {
      console.error('Failed to sync layout settings with database:', e);
    }
  }, []);

  // Handle layout resizing from drag handles
  const handleLayoutDimensionsChange = useCallback(
    (dims: { topHeight: number; bottomHeight: number; leftWidth: number; rightWidth: number }) => {
      setTopHeight(dims.topHeight);
      setBottomHeight(dims.bottomHeight);
      setLeftWidth(dims.leftWidth);
      setRightWidth(dims.rightWidth);

      // Always update local browser storage
      safeStorage.setItem('gaw_layout_top_height', String(dims.topHeight));
      safeStorage.setItem('gaw_layout_bottom_height', String(dims.bottomHeight));
      safeStorage.setItem('gaw_layout_left_width', String(dims.leftWidth));
      safeStorage.setItem('gaw_layout_right_width', String(dims.rightWidth));

      // Only add or update entries in t_settings when an actual database file is active
      if (isDbActive) {
        try {
          const engine = SQLiteEngine.getInstance();
          engine.setSetting('layout_top_height', String(dims.topHeight));
          engine.setSetting('layout_bottom_height', String(dims.bottomHeight));
          engine.setSetting('layout_left_width', String(dims.leftWidth));
          engine.setSetting('layout_right_width', String(dims.rightWidth));
        } catch (e) {
          console.error('Failed to update layout in t_settings:', e);
        }
      }
    },
    [isDbActive]
  );

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

      const name = engine.getSetting('app_name', 'New App');
      const desc = engine.getSetting('app_description') || engine.getSetting('app_descripton', '');
      const initPlugin = engine.getSetting('initial_plugin', 'main');
      setAppSettings({ appName: name, appDescription: desc, initialPlugin: initPlugin });

      if (safeStorage.getItem('gaw_db_active') === 'true') {
        syncLayoutWithDatabase(true);
      }
    } catch (e) {
      console.error('Failed to refresh database state:', e);
    }
  }, [syncLayoutWithDatabase]);

  // On initial startup/refresh in App mode, determine initial view according to the 3 rules:
  // 1. If there is only one user plugin, it is shown.
  // 2. If there is a plugin with the name in the initial_plugin setting, it is shown.
  // 3. If there's more than one plugin and none of them tie up with the initial_plugin setting name, then give user list (app_hub).
  const hasAppliedAppModeInitialView = useRef(false);
  useEffect(() => {
    if (!isEngineReady || plugins.length === 0 || hasAppliedAppModeInitialView.current) return;
    if (mode === 'app') {
      hasAppliedAppModeInitialView.current = true;
      const initialView = getInitialAppView(plugins, appSettings.initialPlugin);
      setActiveView(initialView);
      setLastAppView(initialView);
      safeStorage.setItem('gaw_last_app_view', initialView);
      if (initialView.startsWith('plugin:')) {
        setActiveRoute('plugins');
        navigateTo('plugins', initialView);
      } else {
        setActiveRoute('plugins');
        navigateTo('plugins', initialView);
      }
    }
  }, [isEngineReady, plugins, mode, appSettings.initialPlugin, getInitialAppView, navigateTo]);

  // Keep lastAppView synchronized while user navigates in App Mode
  useEffect(() => {
    if (!activeView || activeView === 'ide') return;
    if (mode === 'app') {
      setLastAppView(activeView);
      safeStorage.setItem('gaw_last_app_view', activeView);
    }
  }, [activeView, mode]);

  // On initial load or refresh, mark internal state as unchanged until a change is made
  useEffect(() => {
    storageEngine.setUserModified(false);
    storageEngine.setInternalStateModifiedTime(null);
    storageEngine.markSaved();
  }, [storageEngine]);

  // Wire remote Clockie H2 file reloads so React state and compiled plugin modules refresh cleanly
  useEffect(() => {
    h2Engine.onRemoteReload(() => {
      PluginEngine.clearCache();
      refreshDatabaseState();
      syncLayoutWithDatabase(true);
      eventBusApi.emit('storage_changed');
    });
  }, [h2Engine, refreshDatabaseState, syncLayoutWithDatabase, eventBusApi]);

  // Connect to Clockie H2 Extension Bridge v1.5 once SQLite is ready (non-blocking 2.5s probe)
  // If this tab was launched directly from Clockie H2 File Manager on a .db/.sqlite file, open it automatically.
  const hasAttemptedH2BootRef = useRef(false);
  useEffect(() => {
    if (!isEngineReady || hasAttemptedH2BootRef.current) return;
    hasAttemptedH2BootRef.current = true;

    let cancelled = false;
    h2Engine.connect(2500).then(async (connected) => {
      if (cancelled || !connected) return;
      const state = h2Engine.getState();
      const scope = state.launchedScope;
      if (state.sessionMode === 'launched' && scope) {
        if (
          scope.launchedItemType === 'file' &&
          scope.primaryRelativePath &&
          /\.(db|sqlite|sqlite3)$/i.test(scope.primaryRelativePath)
        ) {
          try {
            const ok = await h2Engine.openDatabase({
              provider: scope.provider,
              relativePath: scope.primaryRelativePath,
              driveRoot: false,
            });
            if (!cancelled && ok) {
              PluginEngine.clearCache();
              setIsDbActive(true);
              safeStorage.setItem('gaw_db_active', 'true');
              setSidebarOpen(true);
              refreshDatabaseState();
              syncLayoutWithDatabase(true);
              eventBusApi.emit('storage_changed');
              addToast('success', `Opened ${scope.primaryRelativePath} via Clockie H2 (${formatProviderLabel(scope.provider)}).`);
            }
          } catch (err: any) {
            if (!cancelled) {
              addToast('error', `Failed to open launched Clockie H2 file: ${err?.message || 'Unknown error'}`);
            }
          }
        } else if (scope.launchedItemType === 'folder') {
          addToast('info', `Clockie H2 launched folder "${scope.rootName || scope.provider}". Select a database in Clockie H2 Drives.`);
          if (mode === 'ide') {
            setIdeTargetTab({
              type: 'plugin',
              id: 'plugin_clockie_h2',
              name: 'Clockie H2 Drives',
              openInView: true,
              timestamp: Date.now(),
            });
          } else {
            setActiveView('plugin:plugin_clockie_h2');
            setActiveRoute('file');
            navigateTo('file', 'plugin:plugin_clockie_h2');
          }
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isEngineReady, h2Engine, refreshDatabaseState, syncLayoutWithDatabase, eventBusApi, addToast, mode, navigateTo]);

  // Open any object in IDE Mode
  const handleOpenInIDE = useCallback(
    (tab?: { type: 'plugin' | 'table' | 'query' | 'report' | 'sql'; id?: string; name?: string; code?: string; openInView?: boolean }) => {
      if (tab && (tab.id || tab.name || tab.code)) {
        setIdeTargetTab({
          type: tab.type,
          id: tab.id,
          name: tab.name,
          code: tab.code,
          openInView: tab.openInView,
          timestamp: Date.now(),
        });
      }
      setMode('ide');
      safeStorage.setItem('gaw_mode', 'ide');
      setActiveView('ide');
      setActiveRoute('file');
      navigateTo('file', 'ide');
      eventBusApi.emit('mode_changed', 'ide');
      eventBusApi.emit('view_changed', 'ide', 'file');
    },
    [navigateTo, eventBusApi]
  );

  // Toggle between IDE Mode and App Mode (auto-saves dirty IDE tabs before switching to App)
  const handleToggleMode = useCallback(
    async (newMode: 'ide' | 'app' | 'dev') => {
      const normalizedMode: 'ide' | 'app' = newMode === 'dev' ? 'ide' : newMode;
      if (normalizedMode === mode) return;

      if (normalizedMode === 'app') {
        if (ideSaveDirtyRef.current) {
          await ideSaveDirtyRef.current();
        }
        const engine = SQLiteEngine.getInstance();
        const freshPlugins = engine.getPlugins();
        const freshInitPlugin = engine.getSetting('initial_plugin', 'main');
        refreshDatabaseState();

        setSidebarOpen(false);
        safeStorage.setItem('gaw_sidebar_open', 'false');

        const isLastAppViewValid =
          lastAppView &&
          (lastAppView === 'app_hub' ||
            lastAppView === 'spreadsheet' ||
            lastAppView.startsWith('report:') ||
            lastAppView.startsWith('query:') ||
            lastAppView.startsWith('table:') ||
            freshPlugins.some((p) => `plugin:${p.id}` === lastAppView));

        const targetView = isLastAppViewValid
          ? lastAppView!
          : getInitialAppView(freshPlugins, freshInitPlugin);

        setMode('app');
        safeStorage.setItem('gaw_mode', 'app');
        setActiveView(targetView);

        let targetRoute: 'file' | 'database' | 'plugins' | 'help' = 'plugins';
        if (targetView.startsWith('plugin:')) {
          const pId = targetView.replace('plugin:', '');
          targetRoute =
            pId === 'plugin_file_manager' || pId === 'plugin_local_storage' || pId === 'plugin_clockie_h2'
              ? 'file'
              : pId === 'plugin_database_management'
              ? 'database'
              : pId === 'plugin_help'
              ? 'help'
              : 'plugins';
        } else if (
          targetView.startsWith('table:') ||
          targetView.startsWith('query:') ||
          targetView.startsWith('report:') ||
          targetView === 'spreadsheet'
        ) {
          targetRoute = 'file';
        }

        setActiveRoute(targetRoute);
        navigateTo(targetRoute, targetView);
        eventBusApi.emit('mode_changed', 'app');
        eventBusApi.emit('view_changed', targetView, targetRoute);
      } else {
        if (activeView && activeView !== 'ide') {
          setLastAppView(activeView);
          safeStorage.setItem('gaw_last_app_view', activeView);
        }

        // If user was inspecting a specific object in App mode, open its corresponding tab in IDE
        let targetToOpen: TargetTabInfo | undefined;
        if (activeView.startsWith('plugin:')) {
          const pId = activeView.replace('plugin:', '');
          const p = plugins.find((x) => x.id === pId);
          targetToOpen = { type: 'plugin', id: pId, name: p?.name || pId, timestamp: Date.now() };
        } else if (activeView.startsWith('table:')) {
          targetToOpen = { type: 'table', name: activeView.replace('table:', ''), timestamp: Date.now() };
        } else if (activeView.startsWith('query:')) {
          const qId = activeView.replace('query:', '');
          const q = queries.find((x) => x.id === qId);
          targetToOpen = { type: 'query', id: qId, name: q?.name || activeQueryTitle || 'Query', timestamp: Date.now() };
        } else if (activeView.startsWith('report:')) {
          const rId = activeView.replace('report:', '');
          const r = reports.find((x) => x.id === rId);
          targetToOpen = { type: 'report', id: rId, name: r?.name || 'Report', timestamp: Date.now() };
        } else if (activeView === 'spreadsheet' && spreadsheetSource) {
          if (spreadsheetSource.type === 'table') {
            targetToOpen = { type: 'table', name: spreadsheetSource.name, timestamp: Date.now() };
          } else {
            targetToOpen = {
              type: 'query',
              id: spreadsheetSource.id,
              name: spreadsheetSource.name,
              timestamp: Date.now(),
            };
          }
        }

        if (targetToOpen) {
          setIdeTargetTab(targetToOpen);
        }

        setMode('ide');
        safeStorage.setItem('gaw_mode', 'ide');
        setActiveView('ide');
        setActiveRoute('file');
        navigateTo('file', 'ide');
        eventBusApi.emit('mode_changed', 'ide');
        eventBusApi.emit('view_changed', 'ide', 'file');
      }
    },
    [
      mode,
      activeView,
      lastAppView,
      plugins,
      queries,
      reports,
      activeQueryTitle,
      spreadsheetSource,
      refreshDatabaseState,
      getInitialAppView,
      navigateTo,
      eventBusApi,
    ]
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
      if (
        type === 'plugin' &&
        (id === 'plugin_manager' || id === 'plugin_local_storage' || id === 'plugin_file_manager' || id === 'plugin_clockie_h2')
      ) {
        toastApi.warning(`"${name}" is a core system plugin and cannot be removed to maintain application operation.`);
        return;
      }
      if (type === 'query') {
        const engine = SQLiteEngine.getInstance();
        try {
          engine.deleteQuery(id);
          toastApi.info(`Deleted query "${name}". Press Ctrl+Z or Edit -> Undo to restore.`);
          refreshDatabaseState();
          if (activeView === `query:${id}`) {
            setActiveView('plugin:plugin_crm');
          }
        } catch (err: any) {
          toastApi.error(`Failed to delete query: ${err.message}`);
        }
        return;
      }
      setDeleteTarget({
        stage: 1,
        type,
        id,
        name,
      });
    },
    [toastApi, refreshDatabaseState, activeView]
  );

  // Execute confirmed deletion
  const executeDeleteObject = useCallback(() => {
    if (!deleteTarget) return;
    const { type, id, name } = deleteTarget;
    if (
      type === 'plugin' &&
      (id === 'plugin_manager' || id === 'plugin_local_storage' || id === 'plugin_file_manager' || id === 'plugin_clockie_h2')
    ) {
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

  // Subscribe to SQLiteEngine internal changes (notify local storage + optional H2 debounced auto-save)
  useEffect(() => {
    const engine = SQLiteEngine.getInstance();
    const unsub = engine.subscribe((isUserMutation?: boolean) => {
      if (isUserMutation && isEngineReady) {
        storageEngine.markDirty(true);
        h2Engine.notifyLocalMutation();
      }
      refreshDatabaseState();
    });
    return unsub;
  }, [storageEngine, h2Engine, refreshDatabaseState, isEngineReady]);

  // Sync Clockie H2 bridge state updates into storage metadata and plugin event bus
  useEffect(() => {
    const unsubH2 = h2Engine.subscribe(() => {
      setStorageMeta(storageEngine.getMetadata());
      eventBusApi.emit('storage_changed');
    });
    return () => {
      unsubH2();
    };
  }, [storageEngine, h2Engine, eventBusApi]);

  // Global Keyboard Shortcuts for App Mode (Ctrl+S save database, Ctrl+O open file)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // When in IDE Mode, Monaco IDE handles keyboard shortcuts (Ctrl+S, etc.) natively
      if (mode === 'ide') {
        return;
      }
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (h2Engine.hasActiveFile()) {
          h2Engine.saveDatabase().catch((err: any) => {
            toastApi.error(err?.message || 'Clockie H2 save failed.');
          });
        } else {
          storageEngine.save().then((ok) => {
            if (ok) toastApi.success('Database saved successfully!');
          });
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        storageEngine.openFile().then((ok) => {
          if (ok) {
            PluginEngine.clearCache();
            toastApi.success('Database opened successfully!');
            refreshDatabaseState();
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [storageEngine, h2Engine, toastApi, refreshDatabaseState, mode]);

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
      setActiveRoute('file');
      if (updateHash) {
        navigateTo('file', `table:${tableName}`);
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
      setActiveQueryResults(results);
      setActiveSavedQuery(q);
      setActiveQueryTitle(q.name);
      if (results.length > 0) {
        setActiveQueryResult(results[0]);
      } else {
        setActiveQueryResult(null);
      }
      setActiveView(`query:${q.id}`);
      setActiveRoute('file');
      if (updateHash) {
        navigateTo('file', `query:${q.id}`);
      }
    } catch (err: any) {
      toastApi.error('Error running query: ' + err.message);
    }
  }, [navigateTo, toastApi]);

  // Re-run Active Query
  const handleRerunActiveQuery = useCallback(() => {
    if (!activeSavedQuery) return;
    const engine = SQLiteEngine.getInstance();
    try {
      const allQ = engine.getSavedQueries();
      const current = allQ.find((x) => x.id === activeSavedQuery.id) || activeSavedQuery;
      const results = engine.exec(current.query);
      setActiveQueryResults(results);
      if (results.length > 0) {
        setActiveQueryResult(results[0]);
      }
      toastApi.success('Query re-executed');
    } catch (err: any) {
      toastApi.error('Error running query: ' + err.message);
    }
  }, [activeSavedQuery, toastApi]);

  // Add New Table via pro-forma CREATE TABLE query
  const handleNewTable = useCallback(() => {
    const engine = SQLiteEngine.getInstance();
    const existingTables = engine.getSchema().map((s) => s.name);
    let baseName = 'new_table';
    let counter = 1;
    while (existingTables.includes(baseName)) {
      counter++;
      baseName = `new_table_${counter}`;
    }
    const proFormaSql = `-- Pro-forma statement to create a new table\nDROP TABLE IF EXISTS "${baseName}";\n\nCREATE TABLE "${baseName}" (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  description TEXT,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n`;

    const newId = `q_create_${baseName}_${Date.now()}`;
    const queryName = `Create ${baseName} Table`;
    const newQuery: SavedQuery = {
      id: newId,
      name: queryName,
      description: `Pro-forma query to create table "${baseName}"`,
      query: proFormaSql,
      created_at: new Date().toISOString(),
    };

    engine.saveQuery(newQuery);
    // Do not run query immediately! Automatically switch to IDE and display the SQL creation code
    handleOpenInIDE({
      type: 'query',
      id: newId,
      name: queryName,
      code: proFormaSql,
    });
    toastApi.info(`Opened table creation query "${queryName}" in IDE. Review and press Ctrl+Enter to execute or Ctrl+Shift+K to view results.`);
  }, [handleOpenInIDE, toastApi]);

  // Add New View via pro-forma CREATE VIEW query
  const handleNewView = useCallback(() => {
    const engine = SQLiteEngine.getInstance();
    const existingSchema = engine.getSchema().map((s) => s.name);
    let baseName = 'new_view';
    let counter = 1;
    while (existingSchema.includes(baseName)) {
      counter++;
      baseName = `new_view_${counter}`;
    }
    const firstTable = engine.getSchema().find((t) => t.type !== 'view' && !t.isSystem && !engine.isSystemTable(t.name))?.name || 'customers';
    const proFormaSql = `-- Pro-forma statement to create a new database view\nDROP VIEW IF EXISTS "${baseName}";\n\nCREATE VIEW "${baseName}" AS\n  SELECT * FROM "${firstTable}";\n`;

    const newId = `q_create_view_${baseName}_${Date.now()}`;
    const queryName = `Create ${baseName} View`;
    const newQuery: SavedQuery = {
      id: newId,
      name: queryName,
      description: `Pro-forma query to create view "${baseName}"`,
      query: proFormaSql,
      created_at: new Date().toISOString(),
    };

    engine.saveQuery(newQuery);
    handleOpenInIDE({
      type: 'query',
      id: newId,
      name: queryName,
      code: proFormaSql,
    });
    toastApi.info(`Opened view creation query "${queryName}" in IDE. Review and press Ctrl+Enter to execute or Ctrl+Shift+K to view results.`);
  }, [handleOpenInIDE, toastApi]);

  // Add New Query
  const handleNewQuery = useCallback(() => {
    const engine = SQLiteEngine.getInstance();
    const existingQueries = engine.getSavedQueries().map((q) => q.name);
    let baseName = 'New_Query';
    let counter = 1;
    while (existingQueries.includes(baseName)) {
      counter++;
      baseName = `New_Query_${counter}`;
    }
    const newId = `q_${baseName.toLowerCase()}_${Date.now()}`;
    const firstTable = engine.getSchema().find((t) => !t.isSystem && !engine.isSystemTable(t.name))?.name || 'customers';
    const querySql = `-- SQL Query\nSELECT * FROM "${firstTable}" LIMIT 25;\n`;
    const newQuery: SavedQuery = {
      id: newId,
      name: baseName,
      description: `Custom query ${baseName}`,
      query: querySql,
      created_at: new Date().toISOString(),
    };

    engine.saveQuery(newQuery);
    refreshDatabaseState();

    if (mode === 'ide') {
      handleOpenInIDE({
        type: 'query',
        id: newId,
        name: baseName,
        code: querySql,
      });
    } else {
      handleSelectQuery(newQuery);
    }
    toastApi.info(`Created query "${baseName}". Edit and press Ctrl+Enter to execute or Ctrl+Shift+K to view results.`);
  }, [mode, handleOpenInIDE, handleSelectQuery, refreshDatabaseState, toastApi]);

  // Select Plugin
  const handleSelectPlugin = useCallback((p: PluginRecord, updateHash: boolean = true) => {
    setActiveView(`plugin:${p.id}`);
    setActiveRoute('plugins');
    if (mode === 'app') {
      setLastAppView(`plugin:${p.id}`);
      safeStorage.setItem('gaw_last_app_view', `plugin:${p.id}`);
    }
    if (updateHash) {
      navigateTo('plugins', `plugin:${p.id}`);
    }
  }, [mode, navigateTo]);

  // Select Report
  const handleSelectReport = useCallback((r: SavedReport, updateHash: boolean = true) => {
    setActiveView(`report:${r.id}`);
    setActiveRoute('file');
    if (updateHash) {
      navigateTo('file', `report:${r.id}`);
    }
  }, [navigateTo]);

  // Open Spreadsheet with specific data & track source item
  const handleOpenSpreadsheet = useCallback((
    data?: { columns: string[]; values: any[][] },
    sheetName: string = 'Data',
    updateHash: boolean = true,
    sourceInfo?: { type: 'query' | 'table'; id?: string; name: string } | null
  ) => {
    if (data) {
      setSpreadsheetInitialSheets([{ name: sheetName, columns: data.columns, values: data.values }]);
    }
    let src = sourceInfo;
    if (!src) {
      if (activeView.startsWith('query:')) {
        src = {
          type: 'query',
          id: activeSavedQuery?.id || activeView.replace('query:', ''),
          name: activeSavedQuery?.name || activeQueryTitle || sheetName,
        };
      } else if (activeView.startsWith('table:')) {
        src = {
          type: 'table',
          name: activeView.replace('table:', ''),
        };
      }
    }
    if (src) {
      setSpreadsheetSource(src);
    }
    setActiveView('spreadsheet');
    setActiveRoute('file');
    if (updateHash) {
      navigateTo('file', 'spreadsheet');
    }
  }, [activeView, activeSavedQuery, activeQueryTitle, navigateTo]);

  // Return to Query or Table view from Spreadsheet View
  const handleReturnFromSpreadsheet = useCallback(() => {
    const fallbackView = getInitialAppView(plugins, appSettings.initialPlugin);
    if (!spreadsheetSource) {
      setActiveView(fallbackView);
      navigateTo('plugins', fallbackView);
      return;
    }
    const engine = SQLiteEngine.getInstance();
    if (spreadsheetSource.type === 'table') {
      handleSelectTable(spreadsheetSource.name);
    } else if (spreadsheetSource.type === 'query') {
      const allQueries = engine.getSavedQueries();
      const q = (spreadsheetSource.id ? allQueries.find((x) => x.id === spreadsheetSource.id) : null) ||
        allQueries.find((x) => x.name === spreadsheetSource.name);
      if (q) {
        handleSelectQuery(q);
      } else {
        setActiveView(fallbackView);
        navigateTo('plugins', fallbackView);
      }
    } else {
      setActiveView(fallbackView);
      navigateTo('plugins', fallbackView);
    }
  }, [spreadsheetSource, handleSelectTable, handleSelectQuery, navigateTo, plugins, appSettings.initialPlugin, getInitialAppView]);

  // Global Ctrl+Shift+F toggle directly between IDE Mode and App Mode (auto-saves dirty tabs when leaving IDE)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === 'F' || e.key === 'f')
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        handleToggleMode(mode === 'ide' ? 'app' : 'ide');
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [mode, handleToggleMode]);

  // Global Shift+Ctrl+D shortcut: In IDE Mode, toggle IDE Primary Side Bar (pass through in App Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isD = (e.key && e.key.toLowerCase() === 'd') || e.code === 'KeyD' || e.keyCode === 68;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.shiftKey && isD) {
        if (mode !== 'ide') {
          // Pass-through in App Mode to browser or user plugin
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        eventBusApi.emit('ide_toggle_sidebar');
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [mode, eventBusApi]);

  const isEngineReadyRef = useRef(isEngineReady);
  useEffect(() => {
    isEngineReadyRef.current = isEngineReady;
  }, [isEngineReady]);

  const queriesRef = useRef(queries);
  useEffect(() => {
    queriesRef.current = queries;
  }, [queries]);

  // Hash route parsing and synchronization
  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim();
      if (!hash || hash === 'file' || hash === 'plugin/plugin_file_manager') {
        setActiveRoute('file');
        setActiveView('plugin:plugin_file_manager');
        if (!window.location.hash || window.location.hash === '#') {
          window.location.hash = '#file';
        }
      } else if (hash === 'database' || hash === 'plugin/plugin_database_management') {
        setActiveRoute('database');
        setActiveView('plugin:plugin_database_management');
      } else if (hash === 'plugins' || hash === 'plugin/plugin_manager') {
        setActiveRoute('plugins');
        setActiveView('plugin:plugin_manager');
      } else if (hash === 'help' || hash === 'plugin/plugin_help') {
        setActiveRoute('help');
        setActiveView('plugin:plugin_help');
      } else if (hash === 'spreadsheet') {
        setActiveRoute('file');
        setActiveView('spreadsheet');
      } else if (hash.startsWith('ide')) {
        setActiveRoute('file');
        setActiveView('ide');
      } else if (hash === 'app_hub') {
        setActiveRoute('plugins');
        setActiveView('app_hub');
      } else if (hash.startsWith('table/')) {
        const tName = hash.replace('table/', '');
        setActiveRoute('file');
        setActiveView(`table:${tName}`);
        if (isEngineReadyRef.current) {
          handleSelectTable(tName, false);
        }
      } else if (hash.startsWith('query/')) {
        const qId = hash.replace('query/', '');
        setActiveRoute('file');
        setActiveView(`query:${qId}`);
        if (isEngineReadyRef.current) {
          const q = queriesRef.current.find((item) => item.id === qId);
          if (q) {
            handleSelectQuery(q, false);
          }
        }
      } else if (hash.startsWith('report/')) {
        const rId = hash.replace('report/', '');
        setActiveRoute('file');
        setActiveView(`report:${rId}`);
      } else if (hash.startsWith('plugin/')) {
        const pId = hash.replace('plugin/', '');
        const targetRoute =
          pId === 'plugin_file_manager' || pId === 'plugin_local_storage' || pId === 'plugin_clockie_h2'
            ? 'file'
            : pId === 'plugin_database_management'
            ? 'database'
            : pId === 'plugin_help'
            ? 'help'
            : 'plugins';
        setActiveRoute(targetRoute as any);
        setActiveView(`plugin:${pId}`);
      }
    };

    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, [handleSelectTable, handleSelectQuery]);

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
      theme,
      mode,
      activeRoute,
      activeView,
      appName: appSettings.appName,
      appDescription: appSettings.appDescription,
      navigation: {
        navigate: (route: string) => {
          setActiveRoute(route as any);
          setActiveView(route);
          navigateTo(route, route);
          eventBusApi.emit('view_changed', route, route);
        },
        selectView: (v: string) => {
          if (mode === 'ide') {
            if (v.startsWith('plugin:')) {
              const pId = v.replace('plugin:', '');
              const p = SQLiteEngine.getInstance().getPlugins().find((x) => x.id === pId);
              handleOpenInIDE({ type: 'plugin', id: pId, name: p?.name || pId, openInView: true });
              return;
            }
            if (v.startsWith('table:')) {
              const tName = v.replace('table:', '');
              handleOpenInIDE({ type: 'table', name: tName, openInView: true });
              return;
            }
            if (v.startsWith('query:')) {
              const qId = v.replace('query:', '');
              const q = SQLiteEngine.getInstance().getSavedQueries().find((x) => x.id === qId);
              handleOpenInIDE({ type: 'query', id: qId, name: q?.name || qId, openInView: true });
              return;
            }
            if (v.startsWith('report:')) {
              const rId = v.replace('report:', '');
              const r = SQLiteEngine.getInstance().getSavedReports().find((x) => x.id === rId);
              handleOpenInIDE({ type: 'report', id: rId, name: r?.name || rId, openInView: true });
              return;
            }
            if (v === 'spreadsheet') {
              handleOpenInIDE({ type: 'plugin', id: 'plugin_spreadsheet_studio', name: 'Spreadsheet Studio', openInView: true });
              return;
            }
          }

          if (v.startsWith('query:')) {
            const qId = v.replace('query:', '');
            const engine = SQLiteEngine.getInstance();
            const q = engine.getSavedQueries().find((x) => x.id === qId);
            if (q) {
              handleSelectQuery(q);
              eventBusApi.emit('view_changed', v, 'file');
              return;
            }
          } else if (v.startsWith('table:')) {
            const tName = v.replace('table:', '');
            handleSelectTable(tName);
            eventBusApi.emit('view_changed', v, 'file');
            return;
          } else if (v.startsWith('report:')) {
            const rId = v.replace('report:', '');
            const engine = SQLiteEngine.getInstance();
            const r = engine.getSavedReports().find((x) => x.id === rId);
            if (r) {
              handleSelectReport(r);
              eventBusApi.emit('view_changed', v, 'file');
              return;
            }
          }

          setActiveView(v);
          if (v.startsWith('plugin:')) {
            const pId = v.replace('plugin:', '');
            const targetRoute =
              pId === 'plugin_file_manager' || pId === 'plugin_local_storage' || pId === 'plugin_clockie_h2'
                ? 'file'
                : pId === 'plugin_database_management'
                ? 'database'
                : pId === 'plugin_help'
                ? 'help'
                : 'plugins';
            setActiveRoute(targetRoute as any);
            navigateTo(targetRoute, v);
            eventBusApi.emit('view_changed', v, targetRoute);
          } else if (v === 'app_hub') {
            setActiveRoute('plugins');
            navigateTo('plugins', 'app_hub');
            eventBusApi.emit('view_changed', v, 'plugins');
          } else {
            navigateTo(activeRoute, v);
            eventBusApi.emit('view_changed', v, activeRoute);
          }
        },
        openQuery: (sql?: string) => {
          handleOpenInIDE(sql ? { type: 'sql', code: sql } : { type: 'sql' });
        },
        openSpreadsheet: (data?: any, sheetName?: string) => handleOpenSpreadsheet(data, sheetName),
        openReport: (repId: string) => {
          if (mode === 'ide') {
            const r = SQLiteEngine.getInstance().getSavedReports().find((x) => x.id === repId);
            handleOpenInIDE({ type: 'report', id: repId, name: r?.name || repId, openInView: true });
            return;
          }
          setActiveView(`report:${repId}`);
          setActiveRoute('file');
          navigateTo('file', `report:${repId}`);
          eventBusApi.emit('view_changed', `report:${repId}`, 'file');
        },
        openPlugin: (plgId: string) => {
          if (mode === 'ide') {
            const p = SQLiteEngine.getInstance().getPlugins().find((x) => x.id === plgId);
            handleOpenInIDE({ type: 'plugin', id: plgId, name: p?.name || plgId, openInView: true });
            return;
          }
          setActiveView(`plugin:${plgId}`);
          setActiveRoute('plugins');
          navigateTo('plugins', `plugin:${plgId}`);
          eventBusApi.emit('view_changed', `plugin:${plgId}`, 'plugins');
        },
        openIDE: (tab?: any) => handleOpenInIDE(tab),
        openAI: () => setShowAIModal(true),
        openSettings: () => {
          if (mode === 'ide') {
            handleOpenInIDE({ type: 'plugin', id: 'plugin_settings', name: 'Settings & Workspace Preferences', openInView: true });
          } else {
            setActiveView('plugin:plugin_settings');
            setActiveRoute('plugins');
            navigateTo('plugins', 'plugin:plugin_settings');
            eventBusApi.emit('view_changed', 'plugin:plugin_settings', 'plugins');
          }
        },
        toggleTheme: handleToggleTheme,
        setMode: (m: 'ide' | 'app' | 'dev') => handleToggleMode(m),
      },
      eventBus: eventBusApi,
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
            PluginEngine.clearCache();
            setIsDbActive(true);
            safeStorage.setItem('gaw_db_active', 'true');
            toastApi.success('Database opened successfully.');
            setSidebarOpen(true);
            refreshDatabaseState();
            syncLayoutWithDatabase(true);
          }
          return ok;
        },
        exportDownload: (fileName) => storageEngine.exportDownload(fileName),
        setActiveTarget: (target) => {
          storageEngine.setActiveTarget(target);
          refreshDatabaseState();
        },
        onStatusChange: (listener) => storageEngine.onStatusChange(listener),
        setFileName: (name: string) => {
          SQLiteEngine.getInstance().activeDbName = name;
          storageEngine.markDirty(true);
          refreshDatabaseState();
        },
        markDirty: () => {
          storageEngine.markDirty(true);
          refreshDatabaseState();
        },
      },
      bridge: {
        getState: () => h2Engine.getState(),
        subscribe: (listener) => h2Engine.subscribe(listener),
        connect: () => h2Engine.connect(6000),
        reconnect: () => h2Engine.reconnect(),
        disconnect: () => h2Engine.disconnect(),
        setAutoSaveEnabled: (enabled) => h2Engine.setAutoSaveEnabled(enabled),
        openDatabase: async (opts) => {
          const ok = await h2Engine.openDatabase(opts);
          if (ok) {
            PluginEngine.clearCache();
            setIsDbActive(true);
            safeStorage.setItem('gaw_db_active', 'true');
            setSidebarOpen(true);
            refreshDatabaseState();
            syncLayoutWithDatabase(true);
            eventBusApi.emit('storage_changed');
            const label = opts.name || opts.relativePath.split('/').pop() || 'database';
            toastApi.success(`Loaded ${label} via Clockie H2 (${formatProviderLabel(opts.provider)}).`);
          }
          return ok;
        },
        saveDatabase: async () => {
          const ok = await h2Engine.saveDatabase();
          if (ok) refreshDatabaseState();
          return ok;
        },
        saveDatabaseAs: async (opts) => {
          const ok = await h2Engine.saveDatabaseAs(opts);
          if (ok) {
            setIsDbActive(true);
            safeStorage.setItem('gaw_db_active', 'true');
            refreshDatabaseState();
          }
          return ok;
        },
        requestTree: (opts) => h2Engine.getClient().requestTree(opts),
        listFolder: (opts) => h2Engine.getClient().listFolder(opts),
        statFile: (opts) => h2Engine.getClient().statFile(opts),
        readFile: (opts) => h2Engine.getClient().readFile(opts),
        readBinaryFile: (opts) => h2Engine.getClient().readBinaryFile(opts),
        saveFile: (opts) => h2Engine.getClient().saveFile(opts),
        saveBinaryFile: (opts) => h2Engine.getClient().saveBinaryFile(opts),
        createFolder: (opts) => h2Engine.getClient().createFolder(opts),
        deleteFile: (opts) => h2Engine.getClient().deleteFile(opts),
        deleteFolder: (opts) => h2Engine.getClient().deleteFolder(opts),
        moveFile: (opts) => h2Engine.getClient().moveFile(opts),
        moveFolder: (opts) => h2Engine.getClient().moveFolder(opts),
        observeFile: (opts) => h2Engine.getClient().observeFile(opts),
        observeFolder: (opts) => h2Engine.getClient().observeFolder(opts),
        unobserve: (arg) => h2Engine.getClient().unobserve(arg),
        onFileChanged: (handler) => h2Engine.getClient().onFileChanged(handler),
        onFolderChanged: (handler) => h2Engine.getClient().onFolderChanged(handler),
      },
      plugins: {
        getAll: () => SQLiteEngine.getInstance().getPlugins(),
        toggleEnabled: (pluginId, enabled) => {
          SQLiteEngine.getInstance().setPluginEnabled(pluginId, enabled);
          refreshDatabaseState();
          eventBusApi.emit('db_changed');
        },
        delete: (pluginId) => {
          if (
            pluginId === 'plugin_manager' ||
            pluginId === 'plugin_local_storage' ||
            pluginId === 'plugin_file_manager' ||
            pluginId === 'plugin_clockie_h2'
          ) {
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
            target_area: plugin.target_area || plugin.targetArea || 'middle',
          });
          refreshDatabaseState();
          eventBusApi.emit('db_changed');
        },
        setTargetArea: (pluginId, area) => {
          SQLiteEngine.getInstance().setPluginTargetArea(pluginId, area);
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
        getTables: () => tables,
        getQueries: () => queries,
        getReports: () => reports,
        getPlugins: () => plugins,
        newTable: handleNewTable,
        newView: handleNewView,
        newQuery: handleNewQuery,
        newReport: () => {
          setReportToEdit(null);
          setShowReportBuilder(true);
        },
        deleteObject: handleDeleteObject,
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
          setIsDbActive(true);
          safeStorage.setItem('gaw_db_active', 'true');
          SQLiteEngine.getInstance().createNorthwindDemoDatabase();
          RecentFilesManager.addRecentFile({
            name: 'Northwind Modern Commerce Demo',
            source: 'demo',
            path: 'northwind_commerce.db',
          });
          setSidebarOpen(true);
          refreshDatabaseState();
          syncLayoutWithDatabase(true);
          setActiveView('plugin:plugin_crm');
          setActiveRoute('plugins');
          navigateTo('plugins', 'plugin:plugin_crm');
          toastApi.success('Northwind Demo database opened.');
        },
        createNewDatabase: (name, title, company) => {
          setIsDbActive(true);
          safeStorage.setItem('gaw_db_active', 'true');
          SQLiteEngine.getInstance().createMinimalDatabase(name || 'new_database.sqlite', title || 'New Application', company || 'None');
          refreshDatabaseState();
          syncLayoutWithDatabase(true);
          setActiveView('plugin:plugin_crm');
          setActiveRoute('plugins');
          navigateTo('plugins', 'plugin:plugin_crm');
          toastApi.success('Created new database.');
        },
        closeDatabase: async () => {
          setIsDbActive(false);
          safeStorage.setItem('gaw_db_active', 'false');
          h2Engine.detachActiveFile();
          storageEngine.closeFile();
          PluginEngine.clearCache();
          SQLiteEngine.getInstance().createMinimalDatabase('new_database.sqlite', 'New Application', 'None');
          refreshDatabaseState();

          // Restore layout settings from local browser storage (or defaults)
          const savedTop = safeStorage.getItem('gaw_layout_top_height');
          const savedBottom = safeStorage.getItem('gaw_layout_bottom_height');
          const savedLeft = safeStorage.getItem('gaw_layout_left_width');
          const savedRight = safeStorage.getItem('gaw_layout_right_width');

          setTopHeight(savedTop ? parseInt(savedTop, 10) : 96);
          setBottomHeight(savedBottom ? parseInt(savedBottom, 10) : 28);
          setLeftWidth(savedLeft ? parseInt(savedLeft, 10) : 280);
          setRightWidth(savedRight ? parseInt(savedRight, 10) : 300);

          setActiveView('plugin:plugin_file_manager');
          setActiveRoute('file');
          navigateTo('file', 'plugin:plugin_file_manager');
          toastApi.info('Active database closed.');
        },
      },
    };
  }, [
    plugins,
    activeView,
    activeRoute,
    mode,
    appSettings,
    sidebarOpen,
    toastApi,
    dialogApi,
    eventBusApi,
    theme,
    storageEngine,
    h2Engine,
    handleOpenInIDE,
    handleOpenSpreadsheet,
    handleToggleMode,
    handleToggleTheme,
    refreshDatabaseState,
    syncLayoutWithDatabase,
  ]);

  // Helper for returning to the initial App Hub / primary App view (declared before early returns per Rules of Hooks)
  const handleBackToAppHub = useCallback(() => {
    const hubView = getInitialAppView(plugins, appSettings.initialPlugin);
    setActiveView(hubView);
    setActiveRoute('plugins');
    navigateTo('plugins', hubView);
  }, [getInitialAppView, plugins, appSettings.initialPlugin, navigateTo]);

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
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl ring-2 ring-sky-400/60 animate-pulse bg-slate-900 flex items-center justify-center p-1">
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
  const currentPlugin =
    plugins.find((p) => activeView === `plugin:${p.id}`) ||
    (activeView === 'help' || activeView === 'plugin:plugin_help'
      ? plugins.find((p) => p.id === 'plugin_help') || {
          id: 'plugin_help',
          name: 'Help & System Guide',
          version: '1.0.0',
          enabled: 1,
          icon: 'HelpCircle',
          menu_category: 'System & Documentation',
          route: '/help',
          description: 'Comprehensive user manual, complete technology stack catalog with documentation links, plugin authoring guide, and application walkthrough.',
          code: DEFAULT_HELP_PLUGIN_CODE,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : undefined);
  const currentReport = reports.find((r) => activeView === `report:${r.id}`);

  const isFullIDE = mode === 'ide';

  // 1. Top Area Content: Active top plugin if present in App Mode (default: Header and Navbar plugin)
  const topPlugin = activePluginsByArea.top;
  const topContent = !isFullIDE && topPlugin ? (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <PluginHost
        code={topPlugin.code}
        pluginName={topPlugin.name}
        pluginId={topPlugin.id}
        theme={theme}
        gawContext={gawContext}
        onOpenInIDE={() => handleOpenInIDE({ type: 'plugin', id: topPlugin.id, name: topPlugin.name })}
      />
    </div>
  ) : null;

  // 2. Left Area Content: Active left plugin if present in App Mode
  const leftPlugin = activePluginsByArea.left;
  const leftContent = !isFullIDE && sidebarOpen && leftPlugin ? (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <PluginHost
        code={leftPlugin.code}
        pluginName={leftPlugin.name}
        pluginId={leftPlugin.id}
        theme={theme}
        gawContext={gawContext}
        onOpenInIDE={() => handleOpenInIDE({ type: 'plugin', id: leftPlugin.id, name: leftPlugin.name })}
      />
    </div>
  ) : null;

  // 3. Right Area Content: Active right plugin if present in App Mode
  const rightPlugin = activePluginsByArea.right;
  const rightContent = !isFullIDE && rightPlugin ? (
    <div className="w-full h-full flex flex-col overflow-hidden bg-slate-900 border-l border-slate-800">
      <PluginHost
        code={rightPlugin.code}
        pluginName={rightPlugin.name}
        pluginId={rightPlugin.id}
        theme={theme}
        gawContext={gawContext}
        onOpenInIDE={() => handleOpenInIDE({ type: 'plugin', id: rightPlugin.id, name: rightPlugin.name })}
      />
    </div>
  ) : null;

  // Check whether any explicit App Mode view matched
  const isPluginView = activeView.startsWith('plugin:') && Boolean(currentPlugin);
  const isQueryView = activeView.startsWith('query:');
  const isTableView = activeView.startsWith('table:') && Boolean(activeQueryResult);
  const isReportView = activeView.startsWith('report:') && Boolean(currentReport);
  const isSpreadsheetView = activeView === 'spreadsheet';
  const showAppHub =
    !isFullIDE &&
    (activeView === 'app_hub' || (!isPluginView && !isQueryView && !isTableView && !isReportView && !isSpreadsheetView));

  // 4. Middle Area Content: IDE Mode (Full Screen) OR App Mode Views
  const middleContent = (
    <main
      className={`flex-1 flex flex-col overflow-hidden min-w-0 h-full w-full select-text ${
        theme === 'vs-dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* IDE Mode: Full Monaco IDE Workspace */}
      {isFullIDE ? (
        <div className="flex-1 overflow-hidden select-text">
          <Suspense fallback={<div className="p-6 text-xs text-slate-400">Loading IDE...</div>}>
            <GAWIDE
              initialTab={ideTargetTab || undefined}
              targetTab={ideTargetTab}
              onClearTargetTab={() => setIdeTargetTab(null)}
              onOpenSpreadsheet={handleOpenSpreadsheet}
              onOpenAI={() => setShowAIModal(true)}
              onOpenAddPluginModal={() => setShowAddPluginModal(true)}
              onEditReportVisual={(rep) => {
                setReportToEdit(rep);
                setShowReportBuilder(true);
              }}
              onNewReportVisual={() => {
                setReportToEdit(null);
                setShowReportBuilder(true);
              }}
              onRegisterSaveDirtyHandler={(fn) => {
                ideSaveDirtyRef.current = fn;
              }}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              mode={mode}
              onToggleMode={handleToggleMode}
              gawContext={gawContext}
              onActiveTabChange={(target) => setCurrentIdeTarget(target)}
              onDeleteObject={handleDeleteObject}
            />
          </Suspense>
        </div>
      ) : (
        <>
          {/* App Mode View 0: App Hub / Launcher when multiple or zero user plugins exist */}
          {showAppHub && (
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 select-text">
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/40 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
                      <LayoutGrid className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className={`text-xl font-bold ${theme === 'vs-dark' ? 'text-white' : 'text-slate-900'}`}>
                        {appSettings.appName || appTitle || 'Application Hub'}
                      </h1>
                      <p className={`text-xs mt-0.5 ${theme === 'vs-dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        {appSettings.appDescription || 'Select an enabled user component below to launch it in App Mode.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleMode('ide')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                    title="Switch to IDE Mode (Ctrl+Shift+F)"
                  >
                    <Code2 className="w-4 h-4" />
                    <span>Open IDE Mode</span>
                    <kbd className="opacity-80 text-[10px] px-1.5 py-0.5 bg-black/25 rounded border border-white/20 font-mono ml-0.5">
                      Ctrl+Shift+F
                    </kbd>
                  </button>
                </div>

                {userPlugins.length === 0 ? (
                  <div className={`p-8 rounded-2xl border text-center space-y-3 ${
                    theme === 'vs-dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h2 className={`text-base font-bold ${theme === 'vs-dark' ? 'text-white' : 'text-slate-900'}`}>
                      No Enabled User Components Yet
                    </h2>
                    <p className={`text-xs max-w-md mx-auto leading-relaxed ${theme === 'vs-dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Switch to IDE Mode with Ctrl+Shift+F to build or enable custom TSX components, queries, and reports for this application.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleToggleMode('ide')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition cursor-pointer"
                      >
                        <Code2 className="w-4 h-4" />
                        <span>Switch to IDE Mode (Ctrl+Shift+F)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userPlugins.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPlugin(p)}
                        className={`group text-left p-5 rounded-xl border transition flex flex-col justify-between gap-4 cursor-pointer ${
                          theme === 'vs-dark'
                            ? 'bg-slate-950/80 border-slate-800 hover:border-blue-500/60 hover:bg-slate-900'
                            : 'bg-white border-slate-200 hover:border-blue-500 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600/15 border border-emerald-500/30 text-emerald-400">
                              <Sparkles className="w-4 h-4" />
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-600/15 text-blue-400 border border-blue-500/25">
                              v{p.version || '1.0.0'}
                            </span>
                          </div>
                          <h3 className={`text-sm font-bold ${theme === 'vs-dark' ? 'text-white' : 'text-slate-900'}`}>
                            {p.name}
                          </h3>
                          <p className={`text-xs line-clamp-2 ${theme === 'vs-dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                            {p.description || 'Custom TSX user component'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs font-semibold text-blue-400 group-hover:text-blue-300 pt-2 border-t border-slate-800/30">
                          <span>Open Component</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* App Mode View 1: Active Dynamic TSX Plugin */}
          {isPluginView && currentPlugin && (
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

          {/* App Mode View 2a: Saved Query with Multi-Statement Results */}
          {isQueryView && (
            <MultiQueryResultsView
              savedQuery={activeSavedQuery}
              results={activeQueryResults}
              title={activeQueryTitle || 'Query Results'}
              theme={theme}
              onOpenInIDE={handleOpenInIDE}
              onOpenSpreadsheet={handleOpenSpreadsheet}
              onBackToView={handleBackToAppHub}
              onRerunQuery={handleRerunActiveQuery}
            />
          )}

          {/* App Mode View 2b: Table Grid */}
          {isTableView && activeQueryResult && (
            <div className={`flex-1 flex flex-col overflow-hidden select-text ${theme === 'vs-dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
              <div className={`px-4 py-2 border-b flex items-center justify-between text-xs flex-shrink-0 ${
                theme === 'vs-dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBackToAppHub}
                    className={`transition cursor-pointer ${theme === 'vs-dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-black'}`}
                    title="Back to Application Hub"
                  >
                    ← App Hub
                  </button>
                  <span className="text-slate-500">/</span>
                  <span className={`font-bold ${theme === 'vs-dark' ? 'text-white' : 'text-slate-900'}`}>{activeQueryTitle}</span>
                </div>
                <button
                  onClick={() => {
                    const tName = activeView.replace('table:', '');
                    handleOpenInIDE({ type: 'table', name: tName });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition active:scale-95 cursor-pointer"
                  title="Edit table DDL in IDE Mode (Ctrl+Shift+F)"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Edit Structure in IDE</span>
                  <kbd className="opacity-80 text-[10px] px-1 bg-black/30 rounded border border-white/20 font-mono ml-0.5">
                    Ctrl+Shift+F
                  </kbd>
                </button>
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

          {/* App Mode View 3: Publication Report Viewer */}
          {isReportView && currentReport && (
            <div className="flex-1 overflow-hidden select-text">
              <Suspense fallback={<div className="p-6 text-xs text-slate-400">Loading report...</div>}>
                <ReportViewer
                  report={currentReport}
                  onEdit={() => {
                    setReportToEdit(currentReport);
                    setShowReportBuilder(true);
                  }}
                  onOpenInIDE={handleOpenInIDE}
                  onBack={handleBackToAppHub}
                  theme={theme}
                />
              </Suspense>
            </div>
          )}

          {/* App Mode View 4: Embedded Spreadsheet Studio */}
          {isSpreadsheetView && (
            <div className="flex-1 overflow-hidden select-text">
              <Suspense fallback={<div className="p-6 text-xs text-slate-400">Loading spreadsheet studio...</div>}>
                <SpreadsheetView
                  initialSheets={spreadsheetInitialSheets}
                  sourceInfo={spreadsheetSource}
                  onReturnToSource={handleReturnFromSpreadsheet}
                  onClose={handleBackToAppHub}
                  theme={theme}
                />
              </Suspense>
            </div>
          )}
        </>
      )}
    </main>
  );

  // 5. Bottom Area Content: Active bottom plugin if present in App Mode
  const bottomPlugin = activePluginsByArea.bottom;
  const bottomContent = !isFullIDE && bottomPlugin ? (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <PluginHost
        code={bottomPlugin.code}
        pluginName={bottomPlugin.name}
        pluginId={bottomPlugin.id}
        theme={theme}
        gawContext={gawContext}
        onOpenInIDE={() => handleOpenInIDE({ type: 'plugin', id: bottomPlugin.id, name: bottomPlugin.name })}
      />
    </div>
  ) : null;

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${theme === 'vs-dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <FiveRegionLayout
        theme={theme}
        topContent={topContent}
        leftContent={leftContent}
        rightContent={rightContent}
        middleContent={middleContent}
        bottomContent={bottomContent}
        topHeight={topHeight}
        bottomHeight={bottomHeight}
        leftWidth={leftWidth}
        rightWidth={rightWidth}
        onDimensionsChange={handleLayoutDimensionsChange}
      />

      {/* Modals & Dialogs */}
      {/* 1. Conflict Resolution Dialog (Local Disk & Clockie H2) */}
      {activeConflict && (
        <ConflictDialog
          conflict={activeConflict}
          onKeepLocal={async () => {
            if (activeConflict.source === 'h2') {
              await h2Engine.resolveConflictKeepLocal();
            } else {
              await storageEngine.resolveConflictKeepLocal();
              toastApi.success('Local state overwritten to disk.');
            }
            setActiveConflict(null);
            refreshDatabaseState();
          }}
          onReloadDisk={async () => {
            if (activeConflict.source === 'h2') {
              await h2Engine.resolveConflictReloadRemote();
              toastApi.info(`Reloaded latest version from ${formatProviderLabel(activeConflict.provider)}.`);
            } else {
              await storageEngine.resolveConflictReloadDisk();
              toastApi.info('Reloaded from disk.');
            }
            PluginEngine.clearCache();
            setActiveConflict(null);
            refreshDatabaseState();
          }}
          onSaveCopy={async () => {
            if (activeConflict.source === 'h2') {
              await h2Engine.resolveConflictSaveCopy();
            } else {
              await storageEngine.resolveConflictSaveCopy();
              toastApi.success('Saved local state as new copy.');
            }
            setActiveConflict(null);
            refreshDatabaseState();
          }}
        />
      )}

      {/* 2. Settings Modal */}
      {showSettingsModal && (
        <Suspense fallback={null}>
          <SettingsModal
            onClose={() => setShowSettingsModal(false)}
            theme={theme}
            onThemeChange={(newTheme) => {
              setTheme(newTheme);
              safeStorage.setItem('gaw_theme', newTheme);
              eventBusApi.emit('theme_changed', newTheme);
            }}
            onSettingsSaved={() => {
              refreshDatabaseState();
              toastApi.success('Updated application settings.');
            }}
          />
        </Suspense>
      )}

      {/* 3. Add Dynamic Plugin Modal (Local File/Directory, Clockie H2 Drives, or IDE) */}
      {showAddPluginModal && (
        <Suspense fallback={null}>
          <AddPluginModal
            onClose={() => setShowAddPluginModal(false)}
            onPluginAdded={(newPlugin, openInIDE) => {
              toastApi.success(`Installed dynamic plugin "${newPlugin.name}" into SQLite!`);
              refreshDatabaseState();
              if (openInIDE || mode === 'ide') {
                handleOpenInIDE({ type: 'plugin', id: newPlugin.id, name: newPlugin.name });
              } else {
                setActiveView(`plugin:${newPlugin.id}`);
              }
            }}
            onOpenBridgeSettings={() => {
              setShowAddPluginModal(false);
              if (mode === 'ide') {
                handleOpenInIDE({ type: 'plugin', id: 'plugin_clockie_h2', name: 'Clockie H2 Drives', openInView: true });
              } else {
                setActiveView('plugin:plugin_clockie_h2');
                setActiveRoute('file');
                navigateTo('file', 'plugin:plugin_clockie_h2');
              }
            }}
            theme={theme}
          />
        </Suspense>
      )}

      {/* 4. AI Specification Exporter Modal */}
      {showAIModal && (
        <Suspense fallback={null}>
          <AIAssistant
            onClose={() => setShowAIModal(false)}
            onInstallPlugin={(plg) => {
              const engine = SQLiteEngine.getInstance();
              const now = new Date().toISOString();
              engine.run(
                'INSERT OR REPLACE INTO t_gaw_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [plg.id, plg.name, '1.0.0', 1, plg.icon, plg.menu_category, plg.route, plg.description, plg.code, now, now]
              );
              engine.notifyChange(true);
              toastApi.success(`Installed plugin "${plg.name}" into SQLite!`);
              refreshDatabaseState();
              if (mode === 'ide') {
                handleOpenInIDE({ type: 'plugin', id: plg.id, name: plg.name });
              } else {
                setActiveView(`plugin:${plg.id}`);
              }
            }}
            theme={theme}
          />
        </Suspense>
      )}

      {/* 5. Report Builder Modal */}
      {showReportBuilder && (
        <Suspense fallback={null}>
          <ReportBuilder
            report={reportToEdit}
            onSave={(savedRep) => {
              toastApi.success(`Report "${savedRep.name}" saved!`);
              refreshDatabaseState();
              setShowReportBuilder(false);
              if (mode === 'ide') {
                handleOpenInIDE({ type: 'report', id: savedRep.id, name: savedRep.name });
              } else {
                setActiveView(`report:${savedRep.id}`);
              }
            }}
            onClose={() => setShowReportBuilder(false)}
          />
        </Suspense>
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
