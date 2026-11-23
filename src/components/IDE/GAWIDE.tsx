/**
 * Official Documentation:
 * - Monaco Editor React: https://github.com/suren-atoyan/monaco-editor-react
 * - React Hooks (useState, useEffect, useCallback, useMemo, useRef): https://react.dev/reference/react
 * - sql.js (SQLite WebAssembly): https://sql.js.org/
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  Play,
  Save,
  Plus,
  X,
  Code2,
  Database,
  FileCode,
  Sparkles,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Eye,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Table as TableIcon,
  FileText,
  Search,
  Files,
  Puzzle,
  Settings,
  Terminal,
  Check,
  Maximize2,
  Minimize2,
  Command,
  Sliders,
  ExternalLink,
  RefreshCw,
  Folder,
  ArrowRight,
  Sun,
  Moon,
  Undo,
  Redo,
  Info,
  HelpCircle,
  Key,
  Trash2,
  Copy,
  Pencil,
  Upload,
  Wand2,
  HardDrive,
  Keyboard,
  Activity,
} from 'lucide-react';

const SaveAsIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <span className="relative inline-flex items-center justify-center flex-shrink-0">
    <Save className={className} />
    <Pencil className="w-2 h-2 absolute -bottom-0.5 -right-0.5 text-sky-400 stroke-[2.5] bg-slate-900 rounded-full p-[0.5px]" />
  </span>
);
import { SQLiteEngine } from '../../engine/sqliteEngine';
import { PluginEngine } from '../../engine/pluginEngine';
import { FileStorageEngine } from '../../engine/fileStorage';
import { H2BridgeEngine } from '../../engine/h2Bridge';
import { QueryResult, SavedQuery, TableSchema } from '../../types/sqlite';
import { PluginRecord, SYSTEM_PLUGIN_IDS, isSystemPlugin } from '../../types/plugin';
import { SavedReport } from '../../types/report';
import { H2Provider, StorageMetadata } from '../../types/storage';
import { safeStorage } from '../../utils/storage';
import { QueryGrid } from '../QueryGrid';
import { PluginHost } from '../PluginHost';
import { ReportViewer } from '../ReportViewer';
import { MultiQueryResultsView } from '../MultiQueryResultsView';
import { CodeFormatter } from '../../engine/formatter';
import { GAW_TYPES_DECLARATION } from './gawTypesDeclaration';
import { REACT_TYPES_DECLARATION, LUCIDE_TYPES_DECLARATION } from './vendorTypesDeclaration';
import {
  CustomShortcutOverrides,
  ShortcutActionId,
  buildShortcutLookup,
  formatBindingsForMenu,
  getEffectiveBindings,
  keyboardEventToKeyToken,
  keyboardEventToStepString,
  loadCustomShortcuts,
  resetCustomShortcuts,
  saveCustomShortcuts,
} from './ideShortcuts';
import { ShortcutsModal } from './ShortcutsModal';
import { BridgeInteractionsModal } from './BridgeInteractionsModal';

export interface TabItem {
  id: string;
  title: string;
  type: 'sql' | 'plugin' | 'table' | 'query' | 'report' | 'types' | 'json';
  content: string;
  savedContent?: string;
  isDirty?: boolean;
  pluginId?: string;
  queryId?: string;
  tableName?: string;
  reportId?: string;
}

export interface TargetTabInfo {
  type: 'sql' | 'plugin' | 'table' | 'query' | 'report';
  id?: string;
  name?: string;
  code?: string;
  timestamp?: number;
  openInView?: boolean;
}

interface GAWIDEProps {
  initialTab?: TargetTabInfo;
  targetTab?: TargetTabInfo | null;
  onClearTargetTab?: () => void;
  onOpenSpreadsheet?: (data: { columns: string[]; values: any[][] }, sheetName?: string) => void;
  onOpenAI?: () => void;
  onOpenAddPluginModal?: () => void;
  onEditReportVisual?: (report: SavedReport) => void;
  onNewReportVisual?: () => void;
  onRegisterSaveDirtyHandler?: (fn: () => Promise<void>) => void;
  theme?: 'vs-dark' | 'vs-light';
  onToggleTheme?: () => void;
  mode?: 'ide' | 'app';
  onToggleMode?: (mode: 'ide' | 'app') => void;
  gawContext?: any;
  onActiveTabChange?: (target: TargetTabInfo | null) => void;
  onDeleteObject?: (type: 'plugin' | 'table' | 'query' | 'report', id: string, name: string) => void;
}

export type MenuKey =
  | 'App'
  | 'File'
  | 'Edit'
  | 'Selection'
  | 'Bridge'
  | 'View'
  | 'Go'
  | 'Run'
  | 'Terminal'
  | 'Tools'
  | 'Help';

interface MenuItemDef {
  label: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
  children?: MenuItemDef[];
}

type ActivityBarTab = 'explorer' | 'search' | 'extensions' | 'settings';

export const GAWIDE: React.FC<GAWIDEProps> = ({
  initialTab,
  targetTab,
  onClearTargetTab,
  onOpenSpreadsheet,
  onOpenAI,
  onOpenAddPluginModal,
  onEditReportVisual,
  onNewReportVisual,
  onRegisterSaveDirtyHandler,
  theme = 'vs-dark',
  onToggleTheme,
  mode = 'ide',
  onToggleMode,
  gawContext,
  onActiveTabChange,
  onDeleteObject,
}) => {
  const engine = SQLiteEngine.getInstance();
  const storageEngine = useMemo(() => FileStorageEngine.getInstance(), []);
  const h2BridgeEngine = useMemo(() => H2BridgeEngine.getInstance(), []);
  const [storageMeta, setStorageMeta] = useState<StorageMetadata>(() => storageEngine.getMetadata());
  const editorRef = useRef<any>(null);
  const isDark = theme === 'vs-dark';

  // Subscribe to storage metadata updates for live database filename, size, and sync indicator
  useEffect(() => {
    const unsub = storageEngine.onStatusChange((meta) => {
      setStorageMeta(meta);
    });
    return () => {
      unsub();
    };
  }, [storageEngine]);

  // Monaco IDE Layout state
  const [activeActivity, setActiveActivity] = useState<ActivityBarTab>('explorer');
  const [isPrimarySidebarOpen, setIsPrimarySidebarOpen] = useState(true);

  useEffect(() => {
    const unsub = gawContext?.eventBus?.on('ide_toggle_sidebar', () => {
      setIsPrimarySidebarOpen((prev) => !prev);
    });
    return () => {
      unsub?.();
    };
  }, [gawContext?.eventBus]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [openSubmenuKey, setOpenSubmenuKey] = useState<string | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Standardized IDE shortcuts, chord state, and Bridge Interactions Log modal
  const [customShortcuts, setCustomShortcuts] = useState<CustomShortcutOverrides>(() =>
    loadCustomShortcuts()
  );
  const [shortcutModalTab, setShortcutModalTab] = useState<'system' | 'custom' | null>(null);
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [showBridgeLogModal, setShowBridgeLogModal] = useState(false);
  const [pendingChordPrefix, setPendingChordPrefix] = useState<string | null>(null);
  const pendingChordPrefixRef = useRef<string | null>(null);
  const pendingChordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shortcutLookup = useMemo(() => buildShortcutLookup(customShortcuts), [customShortcuts]);
  const getMenuShortcut = useCallback(
    (actionId: ShortcutActionId): string =>
      formatBindingsForMenu(getEffectiveBindings(actionId, customShortcuts)),
    [customShortcuts]
  );

  const clearPendingChord = useCallback(() => {
    if (pendingChordTimerRef.current) {
      clearTimeout(pendingChordTimerRef.current);
      pendingChordTimerRef.current = null;
    }
    pendingChordPrefixRef.current = null;
    setPendingChordPrefix(null);
  }, []);

  useEffect(() => {
    return () => {
      if (pendingChordTimerRef.current) {
        clearTimeout(pendingChordTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setOpenSubmenuKey(null);
  }, [activeMenu]);

  const handleUpdateCustomShortcuts = useCallback((next: CustomShortcutOverrides) => {
    setCustomShortcuts(next);
    saveCustomShortcuts(next);
  }, []);

  const handleResetCustomShortcuts = useCallback(() => {
    resetCustomShortcuts();
    setCustomShortcuts({});
    gawContext?.toast?.info?.('Custom keyboard shortcuts reset to system defaults.');
  }, [gawContext]);

  const menubarRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<any>(null);
  const handleSaveActiveTabRef = useRef<() => void>(() => {});
  const saveDirtyTabsRef = useRef<() => Promise<void>>(async () => {});
  const handleDeleteActiveItemRef = useRef<() => void>(() => {});
  const handleToggleCommentsRef = useRef<() => void>(() => {});
  const handleToggleViewInIDERef = useRef<() => void>(() => {});
  const handleOpenSaveAsRef = useRef<() => void>(() => {});
  const shortcutActionHandlersRef = useRef<Partial<Record<ShortcutActionId, () => void>>>({});
  const savedCursorPosRef = useRef<Record<string, { lineNumber: number; column: number }>>({});
  const sqlCompletionProviderRef = useRef<any>(null);
  const deletedQueriesUndoStackRef = useRef<
    Array<{
      id: string;
      name: string;
      description: string;
      query: string;
      params?: string;
      layout?: string;
      created_at?: string;
    }>
  >([]);
  const closedTabsStackRef = useRef<
    Array<{
      tab: TabItem;
      index: number;
      wasViewToggled: boolean;
    }>
  >([]);
  const [closedTabsCount, setClosedTabsCount] = useState(0);

  const [formatOnSave, setFormatOnSave] = useState(() => {
    return safeStorage.getItem('gaw_format_on_save') !== 'false';
  });
  const [editorFontSize, setEditorFontSize] = useState(13);
  const [editorTabSize, setEditorTabSize] = useState(2);
  const [showMinimap, setShowMinimap] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Explorer Tree Expansion with persistence across leaving/returning to IDE
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {
      plugins: true,
      pluginsUser: true,
      pluginsSystem: true,
      tables: true,
      tablesUser: true,
      tablesSystem: false,
      views: true,
      viewsUser: true,
      viewsSystem: false,
      queries: true,
      reports: true,
    };
    try {
      const saved = safeStorage.getItem('gaw_ide_expanded_folders');
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Error reading gaw_ide_expanded_folders:', e);
    }
    return defaults;
  });

  const toggleFolder = useCallback((folder: string) => {
    setExpandedFolders((prev) => {
      const next = { ...prev, [folder]: !prev[folder] };
      try {
        safeStorage.setItem('gaw_ide_expanded_folders', JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving gaw_ide_expanded_folders:', e);
      }
      return next;
    });
  }, []);

  // Primary Sidebar Scroll Position Persistence across leaving/returning to IDE
  const sidebarContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedScroll = safeStorage.getItem('gaw_ide_sidebar_scroll');
    if (savedScroll && sidebarContentRef.current) {
      sidebarContentRef.current.scrollTop = Number(savedScroll) || 0;
    }
  }, []);

  const handleSidebarScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    safeStorage.setItem('gaw_ide_sidebar_scroll', String(e.currentTarget.scrollTop));
  }, []);

  // Primary Sidebar adjustable width state with persistence
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = safeStorage.getItem('gaw_ide_sidebar_width');
    return saved ? Math.max(180, Math.min(650, parseInt(saved, 10))) : 260;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  useEffect(() => {
    if (!isResizingSidebar) return;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      const containerLeft = sidebarContainerRef.current?.getBoundingClientRect().left ?? 48;
      const newWidth = Math.max(180, Math.min(650, e.clientX - containerLeft));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      safeStorage.setItem('gaw_ide_sidebar_width', sidebarWidthRef.current.toString());
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar]);

  // Full-Text Search in Files State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchCase, setSearchMatchCase] = useState(false);

  // Tab management
  const [tabs, setTabs] = useState<TabItem[]>(() => {
    let initialList: TabItem[] = [];
    if (initialTab?.type === 'sql') {
      const cleanName = initialTab.name ? initialTab.name.replace(/\.sql$/i, '') : 'Query';
      initialList = [
        {
          id: 'tab_sql_1',
          title: cleanName,
          type: 'sql',
          content:
            initialTab.code ||
            'SELECT ship_country, COUNT(id) AS total_orders, ROUND(SUM(total_amount), 2) AS total_revenue\nFROM orders\nGROUP BY ship_country\nORDER BY total_revenue DESC;',
        },
      ];
    } else if (initialTab?.type === 'query') {
      const q = engine.getSavedQueries().find((x) => x.id === initialTab.id || x.name === initialTab.name);
      const cleanName = (initialTab.name || (q ? q.name : 'Query')).replace(/\.sql$/i, '');
      initialList = [
        {
          id: `tab_query_${initialTab.id || (q ? q.id : Date.now())}`,
          title: cleanName,
          type: 'query',
          content: initialTab.code || (q ? q.query : 'SELECT 1;'),
          queryId: initialTab.id || (q ? q.id : undefined),
        },
      ];
    } else if (initialTab?.type === 'table' && initialTab.name) {
      const cleanName = initialTab.name.replace(/\.sql$/i, '');
      initialList = [
        {
          id: `tab_table_${cleanName}`,
          title: cleanName,
          type: 'table',
          content: engine.getTableIDEScript(cleanName),
          tableName: cleanName,
        },
      ];
    } else if (initialTab?.type === 'plugin' && initialTab.id) {
      const plugins = engine.getPlugins();
      const p = plugins.find((item) => item.id === initialTab.id);
      if (p) {
        initialList = [
          {
            id: `tab_plugin_${p.id}`,
            title: `${p.name}.tsx`,
            type: 'plugin',
            content: p.code,
            pluginId: p.id,
          },
        ];
      }
    }
    if (initialList.length === 0) {
      const defaultPlugins = engine.getPlugins();
      const helloPlugin = defaultPlugins.find((p) => p.id === 'plugin_hello_world') || defaultPlugins[0];
      initialList = [
        ...(helloPlugin
          ? [
              {
                id: `tab_plugin_${helloPlugin.id}`,
                title: `${helloPlugin.name}.tsx`,
                type: 'plugin' as const,
                content: helloPlugin.code,
                pluginId: helloPlugin.id,
              },
            ]
          : []),
      ];
    }
    return initialList.map((t) => ({
      ...t,
      savedContent: t.content,
      isDirty: false,
    }));
  });

  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || '');
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const tabsRef = useRef<TabItem[]>(tabs);
  tabsRef.current = tabs;

  // Toggle View inside IDE (Ctrl+Shift+K) - Code <-> Preview/Data/Results/Report
  const [toggledTabIds, setToggledTabIds] = useState<Record<string, boolean>>({});
  const toggledTabIdsRef = useRef<Record<string, boolean>>(toggledTabIds);
  toggledTabIdsRef.current = toggledTabIds;
  const isViewToggled = !!(activeTabId && toggledTabIds[activeTabId]);

  const handleToggleViewInIDE = useCallback(() => {
    if (!activeTabId) return;
    setToggledTabIds((prev) => ({
      ...prev,
      [activeTabId]: !prev[activeTabId],
    }));
  }, [activeTabId]);

  // Close a single tab and record it on the Undo Close Tab stack (allows closing down to 0 tabs)
  const closeTab = useCallback((idToClose: string) => {
    const currentTabs = tabsRef.current;
    const idx = currentTabs.findIndex((t) => t.id === idToClose);
    if (idx === -1) return;

    const closingTab = currentTabs[idx];
    closedTabsStackRef.current.push({
      tab: closingTab,
      index: idx,
      wasViewToggled: Boolean(toggledTabIdsRef.current[closingTab.id]),
    });
    if (closedTabsStackRef.current.length > 25) {
      closedTabsStackRef.current.shift();
    }
    setClosedTabsCount(closedTabsStackRef.current.length);

    const nextTabs = currentTabs.filter((t) => t.id !== idToClose);
    setTabs(nextTabs);
    setActiveTabId((currentActive) => {
      if (currentActive === idToClose) {
        const fallback = nextTabs[Math.min(idx, nextTabs.length - 1)];
        return fallback ? fallback.id : '';
      }
      return currentActive;
    });
  }, []);

  // Close all open tabs and record them so Undo Close Tab restores the most recently active tab first
  const closeAllTabs = useCallback(() => {
    const currentTabs = tabsRef.current;
    if (currentTabs.length === 0) return;

    const inactiveEntries = currentTabs
      .map((tab, index) => ({
        tab,
        index,
        wasViewToggled: Boolean(toggledTabIdsRef.current[tab.id]),
      }))
      .filter((entry) => entry.tab.id !== activeTabId);

    const activeEntry = currentTabs
      .map((tab, index) => ({
        tab,
        index,
        wasViewToggled: Boolean(toggledTabIdsRef.current[tab.id]),
      }))
      .find((entry) => entry.tab.id === activeTabId);

    const orderedToPush = activeEntry ? [...inactiveEntries, activeEntry] : inactiveEntries;
    closedTabsStackRef.current.push(...orderedToPush);
    if (closedTabsStackRef.current.length > 25) {
      closedTabsStackRef.current = closedTabsStackRef.current.slice(-25);
    }
    setClosedTabsCount(closedTabsStackRef.current.length);
    setTabs([]);
    setActiveTabId('');
  }, [activeTabId]);

  // Restore the most recently closed IDE tab in its previous slot and view-toggle state
  const handleUndoCloseTab = useCallback(() => {
    const entry = closedTabsStackRef.current.pop();
    setClosedTabsCount(closedTabsStackRef.current.length);
    if (!entry) {
      gawContext?.toast?.info?.('No recently closed tabs to restore.');
      return;
    }

    setTabs((prev) => {
      if (prev.some((t) => t.id === entry.tab.id)) {
        return prev;
      }
      const next = [...prev];
      const insertAt = Math.max(0, Math.min(entry.index, next.length));
      next.splice(insertAt, 0, entry.tab);
      return next;
    });
    if (entry.wasViewToggled) {
      setToggledTabIds((prev) => ({
        ...prev,
        [entry.tab.id]: true,
      }));
    }
    setActiveTabId(entry.tab.id);
  }, [gawContext]);

  const getTargetFromTab = useCallback((tab?: TabItem | null): TargetTabInfo | null => {
    if (!tab) return null;
    if (tab.type === 'table') {
      const name = tab.tableName || tab.title.replace(/\.sql$/i, '');
      return { type: 'table', name };
    }
    if (tab.type === 'query' || tab.type === 'sql') {
      const qId = tab.queryId;
      const name = tab.title.replace(/\.sql$/i, '');
      return { type: 'query', id: qId, name };
    }
    if (tab.type === 'plugin') {
      const pId = tab.pluginId;
      const name = tab.title.replace(/\.tsx$/i, '');
      return { type: 'plugin', id: pId, name };
    }
    if (tab.type === 'report') {
      const rId = tab.reportId;
      const name = tab.title.replace(/\.json$/i, '');
      return { type: 'report', id: rId, name };
    }
    return null;
  }, []);

  const currentTargetInfo = useMemo(() => getTargetFromTab(activeTab), [activeTab, getTargetFromTab]);
  const lastNotifiedTargetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTargetInfo) {
      if (lastNotifiedTargetKeyRef.current !== null) {
        lastNotifiedTargetKeyRef.current = null;
        onActiveTabChange?.(null);
      }
      return;
    }
    const key = `${currentTargetInfo.type}:${currentTargetInfo.id || ''}:${currentTargetInfo.name || ''}`;
    if (lastNotifiedTargetKeyRef.current !== key) {
      lastNotifiedTargetKeyRef.current = key;
      onActiveTabChange?.(currentTargetInfo);
    }
  }, [currentTargetInfo, onActiveTabChange]);

  // Switch from IDE mode to App mode after auto-saving any dirty editor tabs
  const handleSwitchToAppMode = useCallback(async () => {
    await saveDirtyTabsRef.current?.();
    onToggleMode?.('app');
  }, [onToggleMode]);

  // Execution outputs for SQL
  const [queryResults, setQueryResults] = useState<QueryResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Live compilation status for TSX plugins
  const [compileStatus, setCompileStatus] = useState<{
    valid: boolean;
    error?: string;
  }>({ valid: true });

  // Monaco diagnostic marker statistics (errors & warnings)
  const [markerStats, setMarkerStats] = useState({ errors: 0, warnings: 0 });

  const updateMarkers = useCallback(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) {
      setMarkerStats({ errors: 0, warnings: 0 });
      return;
    }
    try {
      const markers = monacoRef.current.editor.getModelMarkers({ resource: model.getUri() });
      let errors = 0;
      let warnings = 0;
      markers.forEach((m: any) => {
        const severity = m.severity;
        if (severity === monacoRef.current.MarkerSeverity.Error || severity === 8) {
          errors++;
        } else if (severity === monacoRef.current.MarkerSeverity.Warning || severity === 4) {
          warnings++;
        }
      });

      if (activeTab?.type === 'plugin' && !compileStatus.valid && compileStatus.error && errors === 0) {
        errors = 1;
      }

      setMarkerStats({ errors, warnings });
    } catch {
      // ignore
    }
  }, [compileStatus, activeTab?.type]);

  // Preview panel toggle for plugins
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);

  // Open Modal / Dropdown State in standard mode
  const [showOpenMenu, setShowOpenMenu] = useState(false);
  const [openSearch, setOpenSearch] = useState('');
  const [openFilter, setOpenFilter] = useState<'all' | 'plugins' | 'tables' | 'queries' | 'reports'>('all');
  const openMenuRef = useRef<HTMLDivElement>(null);

  // Close Open menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuRef.current && !openMenuRef.current.contains(e.target as Node)) {
        setShowOpenMenu(false);
      }
    };
    if (showOpenMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOpenMenu]);

  // Database reactive version
  const [dbVersion, setDbVersion] = useState(0);
  useEffect(() => {
    return engine.subscribe(() => {
      setDbVersion((v) => v + 1);
    });
  }, [engine]);

  // Asynchronous query/view result computation for toggled view in IDE (Code <-> Preview/Data/Results/Report)
  const [toggledResultsState, setToggledResultsState] = useState<QueryResult[]>([]);
  const lastExecutedTabContentRef = useRef<string>('');

  useEffect(() => {
    if (!isViewToggled || !activeTab) {
      setToggledResultsState([]);
      lastExecutedTabContentRef.current = '';
      return;
    }

    const currentTabKey = `${activeTab.id}:${activeTab.type}:${activeTab.content}`;

    // If queryResults from runCurrentQuery exists and activeTab is a query, use it
    if ((activeTab.type === 'query' || activeTab.type === 'sql') && queryResults.length > 0) {
      const formatted = queryResults.map((r) => {
        if (!r.columns || r.columns.length === 0 || (r.columns.length === 2 && r.columns[0] === 'status')) {
          return { ...r, columns: ['Status'], values: [['Sql statement ran successfully']] };
        }
        return r;
      });
      setToggledResultsState(formatted);
      return;
    }

    // Skip re-executing identical tab content when dbVersion updates due to DDL mutations (prevents infinite CPU loops)
    if (lastExecutedTabContentRef.current === currentTabKey) {
      return;
    }
    lastExecutedTabContentRef.current = currentTabKey;

    try {
      if (activeTab.type === 'table') {
        const tableName = (activeTab.tableName || activeTab.title).replace(/\.sql$/i, '');

        // First try read-only SELECT * query which NEVER triggers notifyChange or reactivity loops
        try {
          const { columns, values } = engine.query(`SELECT * FROM "${tableName}";`);
          if (!columns || columns.length === 0) {
            setToggledResultsState([{ columns: ['Status'], values: [['Sql statement ran successfully']] }]);
          } else {
            setToggledResultsState([{ columns, values }]);
          }
          return;
        } catch {
          // Fallback if SELECT failed
        }

        let execRes: QueryResult[] = [];
        if (activeTab.content && activeTab.content.trim()) {
          try {
            execRes = engine.exec(activeTab.content);
          } catch (e: any) {
            setToggledResultsState([{ columns: ['Error'], values: [[e.message || String(e)]], error: e.message }]);
            return;
          }
        }

        const selectRes = execRes.find(
          (r) => r.columns && r.columns.length > 0 && r.columns[0] !== 'status' && r.columns[0] !== 'error' && r.columns[0] !== 'Status'
        );

        if (selectRes && selectRes.values && selectRes.values.length > 0) {
          setToggledResultsState([selectRes]);
          return;
        }

        setToggledResultsState([{ columns: ['Status'], values: [['Sql statement ran successfully']] }]);
      } else if (activeTab.type === 'query' || activeTab.type === 'sql') {
        if (!activeTab.content || !activeTab.content.trim()) {
          setToggledResultsState([{ columns: ['Status'], values: [['Sql statement ran successfully']] }]);
          return;
        }

        const execRes = engine.exec(activeTab.content);
        if (!execRes || execRes.length === 0) {
          setToggledResultsState([{ columns: ['Status'], values: [['Sql statement ran successfully']] }]);
        } else {
          const formatted = execRes.map((r) => {
            if (!r.columns || r.columns.length === 0 || (r.columns.length === 2 && r.columns[0] === 'status')) {
              return { ...r, columns: ['Status'], values: [['Sql statement ran successfully']] };
            }
            return r;
          });
          setToggledResultsState(formatted);
        }
      }
    } catch (err: any) {
      setToggledResultsState([{ columns: ['Error'], values: [[err.message || String(err)]], error: err.message }]);
    }
  }, [isViewToggled, activeTabId, activeTab?.type, activeTab?.content, activeTab?.tableName, activeTab?.title, queryResults, dbVersion, engine]);

  // Save As Modal State
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [saveAsDescription, setSaveAsDescription] = useState('');
  const [saveAsTarget, setSaveAsTarget] = useState<TargetTabInfo | TabItem | null>(null);

  // Schema state for autocompletion and explorer
  const schema = useMemo(() => engine.getSchema(), [engine, dbVersion]);
  const allPlugins = useMemo(() => engine.getPlugins(), [engine, tabs, dbVersion]);
  const userPlugins = useMemo(() => allPlugins.filter((p) => !isSystemPlugin(p)).sort((a, b) => (a.name || '').localeCompare(b.name || '')), [allPlugins]);
  const systemPlugins = useMemo(() => allPlugins.filter((p) => isSystemPlugin(p)).sort((a, b) => (a.name || '').localeCompare(b.name || '')), [allPlugins]);

  // Helper to retrieve columns for a table schema
  const getTableColumns = useCallback(
    (table: TableSchema) => {
      if (table.columns && table.columns.length > 0) return table.columns;
      try {
        const res = engine.query(`PRAGMA table_info("${table.name}");`);
        if (res && res.values) {
          return res.values.map((c: any) => ({
            cid: Number(c[0]),
            name: String(c[1]),
            type: String(c[2] || 'TEXT'),
            notnull: Number(c[3]),
            dflt_value: c[4],
            pk: Number(c[5]),
          }));
        }
      } catch {
        // ignore
      }
      return [];
    },
    [engine]
  );

  const userTables = useMemo(
    () => schema.filter((t) => t.type !== 'view' && !t.isSystem && !engine.isSystemTable(t.name)),
    [schema, engine]
  );
  const systemTables = useMemo(
    () => schema.filter((t) => t.type !== 'view' && (t.isSystem || engine.isSystemTable(t.name))),
    [schema, engine]
  );
  const userViews = useMemo(
    () => schema.filter((t) => t.type === 'view' && !t.isSystem && !engine.isSystemTable(t.name)),
    [schema, engine]
  );
  const systemViews = useMemo(
    () => schema.filter((t) => t.type === 'view' && (t.isSystem || engine.isSystemTable(t.name))),
    [schema, engine]
  );
  const allTables = useMemo(() => [...userTables, ...systemTables], [userTables, systemTables]);
  const allViews = useMemo(() => [...userViews, ...systemViews], [userViews, systemViews]);
  const allQueries = useMemo(() => engine.getSavedQueries(), [engine, tabs, dbVersion]);
  const allReports = useMemo(() => engine.getSavedReports(), [engine, tabs, dbVersion]);

  // Active item highlighting helper for Explorer Tree
  const isItemActive = useCallback(
    (type: 'plugin' | 'table' | 'query' | 'report' | 'types' | 'json', id?: string, name?: string) => {
      if (!activeTab) return false;
      if (type === 'types') return activeTab.type === 'types';
      if (type === 'json') return activeTab.type === 'json' && activeTab.title === 'package.json';

      const cleanActiveTitle = (activeTab.type === 'table' || activeTab.type === 'query' || activeTab.type === 'sql')
        ? activeTab.title.replace(/\.sql$/i, '')
        : activeTab.title.replace(/\.(tsx|json)$/i, '');
      const cleanInputName = name ? name.replace(/\.(sql|tsx|json)$/i, '') : undefined;

      if (type === 'plugin') {
        if (activeTab.type !== 'plugin') return false;
        return (id && activeTab.pluginId === id) || (cleanInputName && cleanActiveTitle === cleanInputName);
      }
      if (type === 'table') {
        if (activeTab.type !== 'table') return false;
        const activeTableName = activeTab.tableName || cleanActiveTitle;
        return cleanInputName ? activeTableName.toLowerCase() === cleanInputName.toLowerCase() : false;
      }
      if (type === 'query') {
        if (activeTab.type !== 'query' && activeTab.type !== 'sql') return false;
        return (id && activeTab.queryId === id) || (cleanInputName && cleanActiveTitle === cleanInputName);
      }
      if (type === 'report') {
        if (activeTab.type !== 'report') return false;
        return (id && activeTab.reportId === id) || (cleanInputName && cleanActiveTitle === cleanInputName);
      }
      return false;
    },
    [activeTab]
  );

  const getItemClass = useCallback(
    (
      type: 'plugin' | 'table' | 'query' | 'report' | 'types' | 'json',
      id?: string,
      name?: string,
      baseDarkColor = 'text-sky-300',
      baseLightColor = 'text-sky-600'
    ) => {
      const active = isItemActive(type, id, name);
      if (active) {
        return isDark
          ? 'bg-[#094771] text-white font-bold border-l-2 border-l-blue-400 shadow-2xs'
          : 'bg-[#e8f0fe] text-blue-900 font-bold border-l-2 border-l-blue-600 shadow-2xs';
      }
      return isDark
        ? `${baseDarkColor} hover:text-white hover:bg-[#2a2d2e]`
        : `${baseLightColor} hover:text-black hover:bg-slate-100 font-medium`;
    },
    [isItemActive, isDark]
  );

  // Open or Activate an item in a tab
  const openOrActivateItem = useCallback(
    (item: TargetTabInfo | { type: 'types' | 'json'; id?: string; name?: string }) => {
      let tabId = '';
      let title = '';
      let content = '';

      if (item.type === 'plugin' && item.id) {
        const plugins = engine.getPlugins();
        const p = plugins.find((x) => x.id === item.id) || plugins.find((x) => x.name === item.name);
        if (p) {
          tabId = `tab_plugin_${p.id}`;
          title = `${p.name}.tsx`;
          content = p.code;
        }
      } else if (item.type === 'table' && item.name) {
        const cleanName = item.name.replace(/\.sql$/i, '');
        tabId = `tab_table_${cleanName}`;
        title = cleanName;
        content = engine.getTableIDEScript(cleanName);
      } else if (item.type === 'query') {
        const queries = engine.getSavedQueries();
        const q = queries.find((x) => x.id === item.id || x.name === item.name);
        const cleanName = (item.name || (q ? q.name : 'Query')).replace(/\.sql$/i, '');
        tabId = item.id ? `tab_query_${item.id}` : (q ? `tab_query_${q.id}` : `tab_query_${Date.now()}`);
        title = cleanName;
        content = item.code || (q ? q.query : 'SELECT 1;');
      } else if (item.type === 'report') {
        const reports = engine.getSavedReports();
        const r = reports.find((x) => x.id === item.id || x.name === item.name);
        if (r) {
          tabId = `tab_report_${r.id}`;
          title = `${r.name}.json`;
          let parsedConfig = {};
          try {
            parsedConfig = typeof r.config === 'string' ? JSON.parse(r.config) : r.config;
          } catch {
            parsedConfig = {};
          }
          content = JSON.stringify(
            {
              id: r.id,
              name: r.name,
              description: r.description,
              query_id: r.query_id,
              custom_sql: r.custom_sql || '',
              config: parsedConfig,
            },
            null,
            2
          );
        }
      } else if (item.type === 'types') {
        tabId = 'tab_types_gaw';
        title = 'gaw.d.ts';
        content = GAW_TYPES_DECLARATION;
      } else if (item.type === 'json' && item.name === 'package.json') {
        tabId = 'tab_package_json';
        title = 'package.json';
        content = JSON.stringify(
          {
            name: 'gaw-application-workspace',
            version: '1.0.0',
            description: 'Local-first SQLite WebAssembly + React dynamic workspace',
            dependencies: {
              react: '^19.0.0',
              'react-dom': '^19.0.0',
              'lucide-react': '^0.546.0',
              'sql.js': '^1.14.2',
              sucrase: '^3.35.1',
              prettier: '^3.4.2',
            },
          },
          null,
          2
        );
      } else if (item.type === 'sql') {
        if (!item.id && !item.name && !item.code) {
          // General switch to SQL tab: activate existing SQL tab if one exists
          const existingSql = tabs.find((t) => t.type === 'sql');
          if (existingSql) {
            setActiveTabId(existingSql.id);
            setShowOpenMenu(false);
            setShowCommandPalette(false);
            if (onClearTargetTab) onClearTargetTab();
            return;
          }
          tabId = `tab_sql_${Date.now()}`;
          title = 'Query';
          content = '-- SQL Query\nSELECT 1;\n';
        } else {
          tabId = item.id || (item.name ? `tab_sql_${item.name}` : `tab_sql_${Date.now()}`);
          title = item.name ? item.name.replace(/\.sql$/i, '') : 'Query';
          content = item.code || 'SELECT * FROM customers LIMIT 25;';
        }
      }

      if (!tabId) return;

      const cleanTableName = item.type === 'table' && item.name ? item.name.replace(/\.sql$/i, '') : undefined;
      const cleanQueryName = (item.type === 'query' || item.type === 'sql') && item.name ? item.name.replace(/\.sql$/i, '') : undefined;
      const existingMatch = tabs.find(
        (t) =>
          t.id === tabId ||
          (item.type === 'plugin' && item.id && t.pluginId === item.id) ||
          (item.type === 'table' && cleanTableName && (t.tableName === cleanTableName || t.title.replace(/\.sql$/i, '') === cleanTableName)) ||
          (item.type === 'query' && ((item.id && t.queryId === item.id) || (!item.id && cleanQueryName && t.title.replace(/\.sql$/i, '') === cleanQueryName))) ||
          (item.type === 'report' && item.id && t.reportId === item.id)
      );
      const resolvedTabId = existingMatch ? existingMatch.id : tabId;

      if ((item as TargetTabInfo).openInView && resolvedTabId) {
        setToggledTabIds((prev) => ({
          ...prev,
          [resolvedTabId]: true,
        }));
      }

      setTabs((prev) => {
        const existing = prev.find(
          (t) =>
            t.id === tabId ||
            (item.type === 'plugin' && item.id && t.pluginId === item.id) ||
            (item.type === 'table' && cleanTableName && (t.tableName === cleanTableName || t.title.replace(/\.sql$/i, '') === cleanTableName)) ||
            (item.type === 'query' && ((item.id && t.queryId === item.id) || (!item.id && cleanQueryName && t.title.replace(/\.sql$/i, '') === cleanQueryName))) ||
            (item.type === 'report' && item.id && t.reportId === item.id)
        );
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
        const cleanDisplayTitle =
          item.type === 'table'
            ? cleanTableName || title.replace(/\.sql$/i, '')
            : item.type === 'query' || item.type === 'sql'
            ? title.replace(/\.sql$/i, '')
            : title;

        const newTab: TabItem = {
          id: tabId,
          title: cleanDisplayTitle,
          type: item.type as any,
          content,
          savedContent: content,
          isDirty: false,
          pluginId: item.type === 'plugin' ? item.id : undefined,
          tableName: cleanTableName,
          queryId: item.type === 'query' ? item.id : undefined,
          reportId: item.type === 'report' ? item.id : undefined,
        };
        setActiveTabId(tabId);
        return [...prev, newTab];
      });
      setShowOpenMenu(false);
      setShowCommandPalette(false);
      if (onClearTargetTab) onClearTargetTab();
    },
    [engine, tabs, onClearTargetTab]
  );

  const lastTargetTimestampRef = useRef<number | null>(null);

  const handleCloseCommandPalette = useCallback(() => {
    setShowCommandPalette(false);
    setCommandPaletteQuery('');
    setPaletteSelectedIndex(0);
    setTimeout(() => {
      editorRef.current?.focus();
    }, 20);
  }, []);

  // Reset selected command palette index when query changes
  useEffect(() => {
    setPaletteSelectedIndex(0);
  }, [commandPaletteQuery]);

  // Click outside listener for menubar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menubarRef.current && !menubarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setOpenSubmenuKey(null);
      }
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenu]);

  // Unified capture-phase keyboard shortcut & two-step chord engine (IDE Mode only).
  // Uses physical KeyboardEvent.code tokens via ideShortcuts.ts so Alt+ chords work consistently
  // across Windows, Linux, and macOS without leaking second-step characters into Monaco.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Pause IDE shortcut dispatching while the user is recording a custom shortcut
      if (isRecordingShortcut) {
        return;
      }

      // Escape cancels an active chord first, then closes open IDE overlays/menus
      if (e.key === 'Escape') {
        if (pendingChordPrefixRef.current) {
          e.preventDefault();
          e.stopPropagation();
          clearPendingChord();
          return;
        }
        if (shortcutModalTab) {
          e.preventDefault();
          e.stopPropagation();
          setShortcutModalTab(null);
          setTimeout(() => editorRef.current?.focus(), 10);
          return;
        }
        if (showBridgeLogModal) {
          e.preventDefault();
          e.stopPropagation();
          setShowBridgeLogModal(false);
          setTimeout(() => editorRef.current?.focus(), 10);
          return;
        }
        if (showCommandPalette) {
          e.preventDefault();
          e.stopPropagation();
          handleCloseCommandPalette();
          return;
        }
        if (activeMenu) {
          e.preventDefault();
          e.stopPropagation();
          setActiveMenu(null);
          setOpenSubmenuKey(null);
          setTimeout(() => editorRef.current?.focus(), 10);
          return;
        }
        if (showAboutModal) {
          e.preventDefault();
          e.stopPropagation();
          setShowAboutModal(false);
          setTimeout(() => editorRef.current?.focus(), 10);
          return;
        }
        if (showSaveAsModal) {
          e.preventDefault();
          e.stopPropagation();
          setShowSaveAsModal(false);
          setTimeout(() => editorRef.current?.focus(), 10);
          return;
        }
      }

      // Do not trigger background IDE shortcuts while a modal dialog is open
      if (
        showCommandPalette ||
        showSaveAsModal ||
        shortcutModalTab ||
        showBridgeLogModal ||
        showAboutModal
      ) {
        return;
      }

      const step = keyboardEventToStepString(e);
      if (!step) return;

      // 1. If waiting for the second key of a two-step chord (e.g. "Alt+N" -> "C")
      const activePrefix = pendingChordPrefixRef.current;
      if (activePrefix) {
        e.preventDefault();
        e.stopPropagation();
        clearPendingChord();

        const secondMap = shortcutLookup.chordMap.get(activePrefix);
        let matchedAction = secondMap?.get(step);
        // Ergonomic fallback: if user kept Alt held for the second key (e.g. Alt+N then Alt+C),
        // also match against the bare key token so fast chord typing works smoothly.
        if (!matchedAction && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          const bareToken = keyboardEventToKeyToken(e);
          if (bareToken) {
            matchedAction = secondMap?.get(bareToken);
          }
        }
        if (matchedAction) {
          setActiveMenu(null);
          setOpenSubmenuKey(null);
          shortcutActionHandlersRef.current[matchedAction]?.();
        }
        return;
      }

      // 2. Skip unmodified keys when focused inside plain form inputs (Search box, etc.) outside Monaco
      const target = e.target as HTMLElement | null;
      const isMonacoInput = Boolean(target?.closest?.('.monaco-editor'));
      const isPlainFormField =
        !isMonacoInput &&
        Boolean(target) &&
        (target!.tagName === 'INPUT' ||
          target!.tagName === 'TEXTAREA' ||
          target!.tagName === 'SELECT' ||
          target!.isContentEditable);
      if (isPlainFormField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        return;
      }

      // 3. Check if this step initiates a registered two-step chord
      if (shortcutLookup.chordMap.has(step)) {
        e.preventDefault();
        e.stopPropagation();
        pendingChordPrefixRef.current = step;
        setPendingChordPrefix(step);
        if (pendingChordTimerRef.current) {
          clearTimeout(pendingChordTimerRef.current);
        }
        pendingChordTimerRef.current = setTimeout(() => {
          pendingChordPrefixRef.current = null;
          setPendingChordPrefix(null);
          pendingChordTimerRef.current = null;
        }, 1800);
        return;
      }

      // 4. Check single-step shortcuts (Ctrl+S, Alt+S, Alt+Shift+S, Alt+A, Ctrl+Shift+P, etc.)
      const singleAction = shortcutLookup.singleStepMap.get(step);
      if (singleAction) {
        e.preventDefault();
        e.stopPropagation();
        setActiveMenu(null);
        setOpenSubmenuKey(null);
        shortcutActionHandlersRef.current[singleAction]?.();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [
    isRecordingShortcut,
    shortcutModalTab,
    showBridgeLogModal,
    showCommandPalette,
    activeMenu,
    showAboutModal,
    showSaveAsModal,
    handleCloseCommandPalette,
    shortcutLookup,
    clearPendingChord,
  ]);

  // Sync external targetTab request (from Sidebar edit options)
  const lastProcessedTargetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!targetTab) {
      lastProcessedTargetKeyRef.current = null;
      return;
    }
    const key = `${targetTab.type}:${targetTab.id || ''}:${targetTab.name || ''}:${targetTab.timestamp || ''}`;
    if (lastProcessedTargetKeyRef.current === key) {
      return;
    }
    lastProcessedTargetKeyRef.current = key;
    openOrActivateItem(targetTab);
  }, [targetTab, openOrActivateItem]);

  // Update compilation status on plugin edit
  useEffect(() => {
    if (activeTab?.type === 'plugin') {
      const res = PluginEngine.compile(activeTab.content, activeTab.pluginId || 'temp');
      setCompileStatus({
        valid: res.success,
        error: res.error,
      });
    }
  }, [activeTab?.content, activeTab?.type, activeTab?.pluginId]);

  // Update diagnostic marker counts (errors & warnings)
  useEffect(() => {
    const timer = setTimeout(() => {
      updateMarkers();
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTabId, activeTab?.content, compileStatus, updateMarkers]);

  // Prettier Formatting Handler
  const handleFormatDocument = async () => {
    if (!activeTab || activeTab.type === 'types') return;
    setIsFormatting(true);
    try {
      const lang = activeTab.type === 'plugin' ? 'typescript' : activeTab.type === 'report' || activeTab.type === 'json' ? 'json' : 'sql';
      const formatted = await CodeFormatter.format(activeTab.content, lang);
      if (formatted && formatted !== activeTab.content) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  content: formatted,
                  isDirty: formatted !== (t.savedContent !== undefined ? t.savedContent : t.content),
                }
              : t
          )
        );
      }
    } catch (e) {
      console.warn('Format error:', e);
    } finally {
      setIsFormatting(false);
    }
  };

  // Toggle line comments (-- in SQLite) for any partially or fully selected lines
  const handleToggleComments = useCallback(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const selection = editor.getSelection();
    if (!selection) return;

    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;

    // Check whether all non-empty lines in the selection range are already commented
    let allCommented = true;
    let hasNonEmpty = false;

    for (let i = startLine; i <= endLine; i++) {
      const content = model.getLineContent(i);
      const trimmed = content.trim();
      if (trimmed.length > 0) {
        hasNonEmpty = true;
        if (!trimmed.startsWith('--')) {
          allCommented = false;
        }
      }
    }

    if (!hasNonEmpty) return;

    const edits: any[] = [];
    const monacoInstance = monacoRef.current;

    for (let i = startLine; i <= endLine; i++) {
      const content = model.getLineContent(i);
      if (allCommented) {
        // Uncomment: remove leading '-- ' or '--'
        const match = content.match(/^(\s*)--\s?(.*)$/);
        if (match) {
          const newText = match[1] + match[2];
          const range = monacoInstance
            ? new monacoInstance.Range(i, 1, i, content.length + 1)
            : { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: content.length + 1 };
          edits.push({ range, text: newText });
        }
      } else {
        // Comment: prepend '-- '
        const match = content.match(/^(\s*)(.*)$/);
        if (match) {
          const newText = `${match[1]}-- ${match[2]}`;
          const range = monacoInstance
            ? new monacoInstance.Range(i, 1, i, content.length + 1)
            : { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: content.length + 1 };
          edits.push({ range, text: newText });
        }
      }
    }

    if (edits.length > 0) {
      editor.executeEdits('toggle-comment', edits);
    }
  }, []);

  handleToggleCommentsRef.current = handleToggleComments;

  // Setup Monaco completion providers and cursor tracking on mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure SQL line comments in Monaco language registry
    try {
      monaco.languages.setLanguageConfiguration('sql', {
        comments: {
          lineComment: '--',
        },
      });
    } catch {
      // ignore
    }

    // Track Cursor Position for VS Code Status Bar and store in ref
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
      if (activeTabId) {
        savedCursorPosRef.current[activeTabId] = {
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        };
      }
    });

    // Restore saved cursor position when returning to Code View
    if (activeTabId && savedCursorPosRef.current[activeTabId]) {
      const savedPos = savedCursorPosRef.current[activeTabId];
      setTimeout(() => {
        try {
          editor.setPosition(savedPos);
          editor.revealPositionInCenter(savedPos);
          editor.focus();
        } catch (e) {
          // ignore
        }
      }, 30);
    }

    // Track Diagnostic Markers (Errors & Warnings)
    try {
      monaco.editor.onDidChangeMarkers(() => {
        updateMarkers();
      });
    } catch {
      // ignore
    }

    // Note: Ctrl+Shift+F is captured globally in App.tsx to toggle IDE Mode <-> App Mode cleanly without double-firing.

    // Keybinding: Ctrl+Shift+K to toggle view inside IDE
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK, () => {
      handleToggleViewInIDERef.current?.();
    });

    // Keybinding: Ctrl+Shift+S to Save As
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      handleOpenSaveAsRef.current?.();
    });

    // Keybinding: Ctrl+/ to toggle comments
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      handleToggleCommentsRef.current?.();
    });

    // 1. Add TypeScript definitions for GAW Plugin APIs, React, and Lucide React
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      GAW_TYPES_DECLARATION,
      'file:///node_modules/@types/gaw/index.d.ts'
    );
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      REACT_TYPES_DECLARATION,
      'file:///node_modules/@types/react/index.d.ts'
    );
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      LUCIDE_TYPES_DECLARATION,
      'file:///node_modules/@types/lucide-react/index.d.ts'
    );
    const compilerOptions = {
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTextExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
    };
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);

    const diagnosticsOptions = {
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [
        2305, // Module '...' has no exported member '...'
        2307, // Cannot find module '...'
        2614, // Module '...' has no exported member '...'. Did you mean to use 'import ... from "..."' instead?
        2724, // '...' has no exported member named '...'. Did you mean '...'?
        17016, // The 'jsxFragmentFactory' compiler option must be provided
        7016, // Could not find a declaration file for module
        7006, // Parameter implicitly has an 'any' type
      ],
    };
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);

    // 2. Schema-aware SQL Autocomplete (dispose previous provider to prevent duplicates)
    if (sqlCompletionProviderRef.current) {
      try {
        sqlCompletionProviderRef.current.dispose();
      } catch (e) {}
    }

    sqlCompletionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: any[] = [];
        const seenLabels = new Set<string>();

        schema.forEach((t) => {
          if (!seenLabels.has(`table:${t.name}`)) {
            seenLabels.add(`table:${t.name}`);
            suggestions.push({
              label: t.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: t.name,
              detail: t.rowCount !== undefined ? `Table (${t.rowCount} rows)` : `${t.type === 'view' ? 'View' : 'Table'}`,
              range,
            });
          }

          t.columns.forEach((col) => {
            const colKey = `field:${t.name}.${col.name}`;
            if (!seenLabels.has(colKey)) {
              seenLabels.add(colKey);
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: `${t.name}.${col.name} (${col.type || 'TEXT'})`,
                range,
              });
            }
          });
        });

        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'INNER JOIN', 'GROUP BY', 'ORDER BY',
          'LIMIT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'ALTER TABLE', 'ADD COLUMN', 'CREATE TABLE',
          'CREATE INDEX', 'DROP TABLE', 'COUNT', 'SUM', 'AVG', 'ROUND', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
        ];
        keywords.forEach((kw) => {
          if (!seenLabels.has(`kw:${kw}`)) {
            seenLabels.add(`kw:${kw}`);
            suggestions.push({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw,
              range,
            });
          }
        });

        return { suggestions };
      },
    });

    // Keep native Monaco Undo / Redo bindings; all customizable IDE shortcuts and Alt+ chords
    // are dispatched centrally by the capture-phase chord engine so user overrides work inside Monaco.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
      editor.trigger('keyboard', 'undo', null);
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
      editor.trigger('keyboard', 'redo', null);
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
      editor.trigger('keyboard', 'redo', null);
    });
  };

  // Run Query or Compile Plugin or Validate Report
  const runCurrentQuery = () => {
    if (!activeTab) return;
    setIsExecuting(true);

    setTimeout(() => {
      try {
        if (activeTab.type === 'sql' || activeTab.type === 'table' || activeTab.type === 'query') {
          const rawResults = engine.exec(activeTab.content);
          const results = (!rawResults || rawResults.length === 0)
            ? [{ columns: ['Status'], values: [['Sql statement ran successfully']] }]
            : rawResults.map((r) => {
                if (!r.columns || r.columns.length === 0 || (r.columns.length === 2 && r.columns[0] === 'status')) {
                  return { ...r, columns: ['Status'], values: [['Sql statement ran successfully']] };
                }
                return r;
              });
          setQueryResults(results);
          setActiveResultIndex(0);
          engine.notifyChange(true);
        } else if (activeTab.type === 'report') {
          try {
            const parsed = JSON.parse(activeTab.content);
            let sqlToRun = parsed.custom_sql;
            if (!sqlToRun && parsed.query_id) {
              const q = engine.getSavedQueries().find((sq) => sq.id === parsed.query_id);
              if (q) sqlToRun = q.query;
            }
            if (sqlToRun) {
              const rawResults = engine.exec(sqlToRun);
              const results = (!rawResults || rawResults.length === 0)
                ? [{ columns: ['Status'], values: [['Sql statement ran successfully']] }]
                : rawResults.map((r) => {
                    if (!r.columns || r.columns.length === 0 || (r.columns.length === 2 && r.columns[0] === 'status')) {
                      return { ...r, columns: ['Status'], values: [['Sql statement ran successfully']] };
                    }
                    return r;
                  });
              setQueryResults(results);
              setActiveResultIndex(0);
              engine.notifyChange(true);
            } else {
              setQueryResults([
                {
                  columns: ['status', 'message'],
                  values: [['Report JSON Valid', 'No underlying SQL configured for preview.']],
                },
              ]);
            }
          } catch (e: any) {
            setQueryResults([
              {
                columns: ['json_error'],
                values: [[e.message]],
                error: e.message,
              },
            ]);
          }
        } else if (activeTab.type === 'plugin') {
          const res = PluginEngine.compile(activeTab.content, activeTab.pluginId || 'preview');
          setCompileStatus({ valid: res.success, error: res.error });
          setShowLivePreview(true);
        }
      } catch (err: any) {
        setQueryResults([
          {
            columns: ['error'],
            values: [[err.message || String(err)]],
            error: err.message || String(err),
          },
        ]);
      } finally {
        setIsExecuting(false);
      }
    }, 10);
  };

  // Save Plugin, Table DDL, Query, or Report (with Format on Save)
  const handleSaveActiveTab = async (silent: boolean = false) => {
    const currentTab = tabs.find((t) => t.id === activeTabId) || activeTab;
    if (!currentTab) return;

    const currentEditorVal = editorRef.current ? editorRef.current.getValue() : currentTab.content;
    let contentToSave = currentEditorVal;

    // Optional Format on Save with Prettier
    if (formatOnSave && currentTab.type !== 'types') {
      try {
        const lang = currentTab.type === 'plugin' ? 'typescript' : currentTab.type === 'report' || currentTab.type === 'json' ? 'json' : 'sql';
        const formatted = await CodeFormatter.format(contentToSave, lang);
        if (formatted) {
          contentToSave = formatted;
          if (editorRef.current && editorRef.current.getValue() !== formatted) {
            editorRef.current.setValue(formatted);
          }
        }
      } catch {
        // ignore format failure on save
      }
    }

    if (currentTab.type === 'plugin' && currentTab.pluginId) {
      const isSystem = SYSTEM_PLUGIN_IDS.has(currentTab.pluginId);
      if (isSystem) {
        // System plugins are updated in-memory for this session only (not saved to database)
        engine.savePlugin({
          id: currentTab.pluginId,
          name: currentTab.title.replace(/\.(tsx|jsx|ts|js)$/i, ''),
          code: contentToSave,
        });
        PluginEngine.clearCache(currentTab.pluginId);
        setTabs((prev) =>
          prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false } : t))
        );
        if (!silent) gawContext?.toast?.success?.(`Saved ${currentTab.title} (temporary in-memory for this session)`);
      } else {
        const now = new Date().toISOString();
        engine.run('UPDATE t_gaw_plugins SET code = ?, updated_at = ? WHERE id = ?', [
          contentToSave,
          now,
          currentTab.pluginId,
        ]);
        PluginEngine.clearCache(currentTab.pluginId);
        setTabs((prev) =>
          prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false } : t))
        );
        engine.notifyChange(true);
        if (!silent) gawContext?.toast?.success?.(`Saved ${currentTab.title}`);
      }
    } else if (currentTab.type === 'table') {
      const cleanTitle = (currentTab.tableName || currentTab.title).replace(/\.sql$/i, '');
      const existingQueries = engine.getSavedQueries().map((q) => q.name);
      let baseQueryName = `${cleanTitle}_query`;
      let counter = 1;
      while (existingQueries.includes(baseQueryName)) {
        counter++;
        baseQueryName = `${cleanTitle}_query_${counter}`;
      }
      const newQueryId = `q_${cleanTitle.toLowerCase()}_${Date.now()}`;
      const now = new Date().toISOString();

      engine.saveQuery({
        id: newQueryId,
        name: baseQueryName,
        description: `Saved query for table "${cleanTitle}"`,
        query: contentToSave,
        params: '{}',
        layout: '{}',
        created_at: now,
      });
      setDbVersion((v) => v + 1);

      // Keep table tab marked saved
      setTabs((prev) =>
        prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false } : t))
      );

      // Automatically expand queries folder in explorer and move to the newly created query in queries section
      setExpandedFolders((prev) => {
        const next = { ...prev, queries: true };
        safeStorage.setItem('gaw_ide_expanded_folders', JSON.stringify(next));
        return next;
      });

      openOrActivateItem({
        type: 'query',
        id: newQueryId,
        name: baseQueryName,
        code: contentToSave,
      });

      if (!silent) gawContext?.toast?.success?.(`Created new query "${baseQueryName}" with table SQL. Press Ctrl+Enter to run or Ctrl+Shift+K to view results.`);
      return;
    } else if (currentTab.type === 'report' && currentTab.reportId) {
      try {
        const parsed = JSON.parse(contentToSave);
        engine.saveReport({
          id: currentTab.reportId,
          name: parsed.name || currentTab.title.replace(/\.json$/i, ''),
          description: parsed.description || '',
          query_id: parsed.query_id || '',
          custom_sql: parsed.custom_sql || '',
          config: typeof parsed.config === 'string' ? parsed.config : JSON.stringify(parsed.config || {}),
          created_at: parsed.created_at || new Date().toISOString(),
        });
        setTabs((prev) =>
          prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false } : t))
        );
        if (!silent) gawContext?.toast?.success?.(`Saved ${currentTab.title}`);
      } catch (err: any) {
        alert('Invalid JSON in Report configuration: ' + err.message);
      }
    } else if (currentTab.type === 'sql' || currentTab.type === 'query') {
      const queryName = currentTab.title.replace(/\.sql$/i, '');
      const existingQueries = engine.getSavedQueries();
      const existing = existingQueries.find((q) => q.name === queryName || q.id === currentTab.queryId);

      const now = new Date().toISOString();
      let queryId = currentTab.queryId || (existing ? existing.id : `q_${Date.now()}`);
      engine.saveQuery({
        id: queryId,
        name: queryName,
        description: existing?.description || 'Custom Query saved from IDE',
        query: contentToSave,
        params: existing?.params || '{}',
        layout: existing?.layout || '{}',
        created_at: existing?.created_at || now,
      });
      setTabs((prev) =>
        prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false, queryId } : t))
      );
      if (!silent) gawContext?.toast?.success?.(`Saved query "${queryName}"`);
    } else {
      setTabs((prev) =>
        prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false } : t))
      );
      if (!silent) gawContext?.toast?.success?.(`Saved ${currentTab.title}`);
    }
  };

  // Auto-save all dirty editable tabs (plugin, query, sql, report) to in-memory SQLite before switching to App mode
  const saveDirtyTabs = useCallback(async () => {
    const activeEditorVal =
      editorRef.current && !isViewToggled ? editorRef.current.getValue() : null;

    let anyUserMutation = false;
    let savedCount = 0;
    const updatedQueryIds = new Map<string, string>();
    const updatedContents = new Map<string, string>();

    const existingQueries = engine.getSavedQueries();
    const now = new Date().toISOString();

    for (const tab of tabs) {
      const latestContent =
        tab.id === activeTabId && activeEditorVal !== null ? activeEditorVal : tab.content;
      const savedBaseline = tab.savedContent !== undefined ? tab.savedContent : tab.content;
      const dirty = Boolean(tab.isDirty) || latestContent !== savedBaseline;
      if (!dirty) continue;

      if (tab.type === 'plugin' && tab.pluginId) {
        const isSystem = SYSTEM_PLUGIN_IDS.has(tab.pluginId);
        if (isSystem) {
          engine.savePlugin({
            id: tab.pluginId,
            name: tab.title.replace(/\.(tsx|jsx|ts|js)$/i, ''),
            code: latestContent,
          });
        } else {
          engine.run('UPDATE t_gaw_plugins SET code = ?, updated_at = ? WHERE id = ?', [
            latestContent,
            now,
            tab.pluginId,
          ]);
          anyUserMutation = true;
        }
        PluginEngine.clearCache(tab.pluginId);
        updatedContents.set(tab.id, latestContent);
        savedCount++;
      } else if (tab.type === 'query' || tab.type === 'sql') {
        const queryName = tab.title.replace(/\.sql$/i, '');
        const existing = existingQueries.find((q) => q.id === tab.queryId || q.name === queryName);
        const queryId = tab.queryId || (existing ? existing.id : `q_${Date.now()}_${savedCount}`);
        engine.saveQuery({
          id: queryId,
          name: queryName,
          description: existing?.description || 'Custom Query saved from IDE',
          query: latestContent,
          params: existing?.params || '{}',
          layout: existing?.layout || '{}',
          created_at: existing?.created_at || now,
        });
        updatedQueryIds.set(tab.id, queryId);
        updatedContents.set(tab.id, latestContent);
        anyUserMutation = true;
        savedCount++;
      } else if (tab.type === 'report' && tab.reportId) {
        try {
          const parsed = JSON.parse(latestContent);
          engine.saveReport({
            id: tab.reportId,
            name: parsed.name || tab.title.replace(/\.json$/i, ''),
            description: parsed.description || '',
            query_id: parsed.query_id || '',
            custom_sql: parsed.custom_sql || '',
            config: typeof parsed.config === 'string' ? parsed.config : JSON.stringify(parsed.config || {}),
            created_at: parsed.created_at || now,
          });
          updatedContents.set(tab.id, latestContent);
          anyUserMutation = true;
          savedCount++;
        } catch (err: any) {
          gawContext?.toast?.warning?.(`Skipped auto-saving report "${tab.title}": invalid JSON (${err.message})`);
        }
      }
    }

    if (savedCount > 0) {
      setTabs((prev) =>
        prev.map((t) => {
          if (!updatedContents.has(t.id)) return t;
          const nextContent = updatedContents.get(t.id)!;
          return {
            ...t,
            content: nextContent,
            savedContent: nextContent,
            isDirty: false,
            queryId: updatedQueryIds.get(t.id) || t.queryId,
          };
        })
      );
      if (anyUserMutation) {
        engine.notifyChange(true);
      }
      gawContext?.toast?.info?.(`Auto-saved ${savedCount} modified IDE ${savedCount === 1 ? 'tab' : 'tabs'} to SQLite.`);
    }
  }, [tabs, activeTabId, isViewToggled, engine, gawContext]);

  saveDirtyTabsRef.current = saveDirtyTabs;

  // Register stable auto-save callback with App.tsx so Ctrl+Shift+F always saves dirty IDE edits first
  useEffect(() => {
    if (onRegisterSaveDirtyHandler) {
      onRegisterSaveDirtyHandler(async () => {
        await saveDirtyTabsRef.current();
      });
    }
  }, [onRegisterSaveDirtyHandler]);

  // Handle Undo (Restores deleted query if available, otherwise editor undo)
  const handleUndo = useCallback(() => {
    if (deletedQueriesUndoStackRef.current.length > 0) {
      const lastDeleted = deletedQueriesUndoStackRef.current.pop()!;
      try {
        engine.saveQuery({
          id: lastDeleted.id,
          name: lastDeleted.name,
          description: lastDeleted.description || `Query ${lastDeleted.name}`,
          query: lastDeleted.query,
          params: lastDeleted.params || '{}',
          layout: lastDeleted.layout || '{}',
          created_at: lastDeleted.created_at || new Date().toISOString(),
        });
        engine.notifyChange(true);
        setDbVersion((v) => v + 1);
        openOrActivateItem({
          type: 'query',
          id: lastDeleted.id,
          name: lastDeleted.name,
          code: lastDeleted.query,
        });
        gawContext?.toast?.success?.(`Restored query "${lastDeleted.name}"`);
        return;
      } catch (err: any) {
        gawContext?.toast?.error?.(`Failed to restore query: ${err.message}`);
      }
    }
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'undo', null);
      editorRef.current.focus();
    }
  }, [engine, openOrActivateItem, gawContext]);

  // Delete active item (query, table, plugin, report) without modal warnings for queries
  const handleDeleteActiveItem = useCallback(() => {
    const currentTab = tabs.find((t) => t.id === activeTabId) || activeTab;
    if (!currentTab) return;

    const cleanTitle = (currentTab.type === 'table' ? (currentTab.tableName || currentTab.title) : currentTab.title).replace(/\.sql$/i, '');

    if (currentTab.type === 'query' || currentTab.type === 'sql') {
      const existingQueries = engine.getSavedQueries();
      const existing = existingQueries.find((q) => q.id === currentTab.queryId || q.name === cleanTitle);
      if (existing) {
        deletedQueriesUndoStackRef.current.push({
          id: existing.id,
          name: existing.name,
          description: existing.description || '',
          query: existing.query,
          params: existing.params,
          layout: existing.layout,
          created_at: existing.created_at,
        });
        engine.deleteQuery(existing.id);
        closeTab(currentTab.id);
        setDbVersion((v) => v + 1);
        gawContext?.toast?.info?.(`Deleted query "${existing.name}". Press Ctrl+Z or Edit -> Undo to restore.`);
      } else {
        closeTab(currentTab.id);
        gawContext?.toast?.info?.(`Closed unsaved query tab "${cleanTitle}"`);
      }
    } else if (currentTab.type === 'table') {
      const tableName = currentTab.tableName || cleanTitle;
      const dropScript = engine.getTableDropScript(tableName);

      if (editorRef.current) {
        editorRef.current.setValue(dropScript);
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === currentTab.id
            ? { ...t, content: dropScript, savedContent: dropScript, isDirty: false }
            : t
        )
      );

      gawContext?.toast?.info?.(
        `Loaded DROP statement for table "${tableName}". Press Ctrl+/ to uncomment, then Save to create a query.`
      );
      return;
    } else if (currentTab.type === 'plugin' && currentTab.pluginId) {
      if (onDeleteObject) {
        onDeleteObject('plugin', currentTab.pluginId, cleanTitle);
      } else {
        engine.deletePlugin(currentTab.pluginId);
        closeTab(currentTab.id);
        setDbVersion((v) => v + 1);
      }
    } else if (currentTab.type === 'report' && currentTab.reportId) {
      if (onDeleteObject) {
        onDeleteObject('report', currentTab.reportId, cleanTitle);
      } else {
        engine.deleteReport(currentTab.reportId);
        closeTab(currentTab.id);
        setDbVersion((v) => v + 1);
      }
    }
  }, [tabs, activeTabId, activeTab, engine, onDeleteObject, closeTab, gawContext]);

  // Save As Handler - Prefills query name so user can edit/rename query directly
  const handleOpenSaveAs = useCallback((targetItem?: TargetTabInfo | TabItem | null) => {
    const target = targetItem || activeTab;
    setSaveAsTarget(target);
    const rawName = target ? (target as any).name || (target as any).title || 'Query' : 'Query';
    const cleanName = rawName.replace(/\.(sql|tsx|json)$/i, '');
    setSaveAsName(cleanName);
    setSaveAsDescription((target as any)?.description || `Query ${cleanName}`);
    setShowSaveAsModal(true);
  }, [activeTab]);

  const handleConfirmSaveAs = useCallback(() => {
    if (!saveAsName.trim()) return;
    const cleanName = saveAsName.trim().replace(/\.(sql|tsx|json)$/i, '');
    const currentTabToSave = saveAsTarget || activeTab;
    if (!currentTabToSave) return;

    const editorVal = editorRef.current && (currentTabToSave as TabItem).id === activeTabId
      ? editorRef.current.getValue()
      : ((currentTabToSave as TabItem).content || (currentTabToSave as TargetTabInfo).code || '');

    const now = new Date().toISOString();
    const type = currentTabToSave.type;

    if (type === 'plugin') {
      const pId = (currentTabToSave as TabItem).pluginId || (currentTabToSave as TargetTabInfo).id;
      if (pId) {
        engine.run('UPDATE t_gaw_plugins SET name = ?, description = ?, code = ?, updated_at = ? WHERE id = ?;', [
          cleanName,
          saveAsDescription.trim() || `Plugin ${cleanName}`,
          editorVal,
          now,
          pId,
        ]);
        setTabs((prev) =>
          prev.map((t) =>
            t.pluginId === pId || t.id === (currentTabToSave as TabItem).id
              ? { ...t, title: `${cleanName}.tsx`, content: editorVal, savedContent: editorVal, isDirty: false }
              : t
          )
        );
      } else {
        const pluginId = `plugin_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
        engine.run(
          'INSERT INTO t_gaw_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            pluginId,
            cleanName,
            '1.0.0',
            1,
            'Boxes',
            'Custom',
            `/${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            saveAsDescription.trim() || `Custom plugin ${cleanName}`,
            editorVal,
            now,
            now,
          ]
        );
        openOrActivateItem({ type: 'plugin', id: pluginId, name: cleanName });
      }
      engine.notifyChange(true);
      setDbVersion((v) => v + 1);
      gawContext?.toast?.success?.(`Saved plugin "${cleanName}.tsx"`);
    } else if (type === 'report') {
      const rId = (currentTabToSave as TabItem).reportId || (currentTabToSave as TargetTabInfo).id;
      if (rId) {
        engine.saveReport({
          id: rId,
          name: cleanName,
          description: saveAsDescription.trim() || `Report ${cleanName}`,
          query_id: '',
          custom_sql: '',
          config: typeof editorVal === 'string' ? editorVal : JSON.stringify(editorVal || {}),
          created_at: now,
        });
        setTabs((prev) =>
          prev.map((t) =>
            t.reportId === rId || t.id === (currentTabToSave as TabItem).id
              ? { ...t, title: `${cleanName}.json`, content: editorVal, savedContent: editorVal, isDirty: false }
              : t
          )
        );
      } else {
        const reportId = `r_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
        engine.saveReport({
          id: reportId,
          name: cleanName,
          description: saveAsDescription.trim() || `Report ${cleanName}`,
          query_id: '',
          custom_sql: 'SELECT * FROM customers LIMIT 25;',
          config: typeof editorVal === 'string' ? editorVal : JSON.stringify(editorVal || {}),
          created_at: now,
        });
        openOrActivateItem({ type: 'report', id: reportId, name: cleanName });
      }
      engine.notifyChange(true);
      setDbVersion((v) => v + 1);
      gawContext?.toast?.success?.(`Saved report "${cleanName}.json"`);
    } else {
      // Query / SQL / Table: Update existing query name or insert new if unsaved
      const existingQueries = engine.getSavedQueries();
      const targetQueryId = (currentTabToSave as TabItem).queryId || (currentTabToSave as TargetTabInfo).id;
      const existing = existingQueries.find(
        (q) => q.id === targetQueryId || q.name === (currentTabToSave as any).name || q.name === (currentTabToSave as any).title
      );

      if (existing) {
        engine.saveQuery({
          id: existing.id,
          name: cleanName,
          description: saveAsDescription.trim() || existing.description || `Query ${cleanName}`,
          query: editorVal,
          params: existing.params || '{}',
          layout: existing.layout || '{}',
          created_at: existing.created_at || now,
        });
        setTabs((prev) =>
          prev.map((t) =>
            t.queryId === existing.id || t.id === (currentTabToSave as TabItem).id
              ? { ...t, title: cleanName, content: editorVal, savedContent: editorVal, isDirty: false }
              : t
          )
        );
        gawContext?.toast?.success?.(`Renamed query to "${cleanName}"`);
      } else {
        const queryId = targetQueryId || `q_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
        engine.saveQuery({
          id: queryId,
          name: cleanName,
          description: saveAsDescription.trim() || `Saved query ${cleanName}`,
          query: editorVal,
          params: '{}',
          layout: '{}',
          created_at: now,
        });
        setTabs((prev) =>
          prev.map((t) =>
            t.id === (currentTabToSave as TabItem).id
              ? { ...t, title: cleanName, content: editorVal, savedContent: editorVal, isDirty: false, queryId }
              : t
          )
        );
        openOrActivateItem({ type: 'query', id: queryId, name: cleanName, code: editorVal });
        gawContext?.toast?.success?.(`Saved query as "${cleanName}"`);
      }
      engine.notifyChange(true);
      setDbVersion((v) => v + 1);
    }

    setShowSaveAsModal(false);
  }, [saveAsName, saveAsDescription, saveAsTarget, activeTab, activeTabId, engine, gawContext, openOrActivateItem]);

  handleSaveActiveTabRef.current = handleSaveActiveTab;
  handleDeleteActiveItemRef.current = handleDeleteActiveItem;
  handleToggleViewInIDERef.current = handleToggleViewInIDE;
  handleOpenSaveAsRef.current = handleOpenSaveAs;

  // Handler: Add New Dynamic TSX Plugin
  const handleAddNewPlugin = useCallback(() => {
    const existingPlugins = engine.getPlugins();
    let baseName = 'Custom_Plugin';
    let counter = 1;
    while (existingPlugins.some((p) => p.name === baseName || p.id === `plugin_${baseName.toLowerCase()}`)) {
      counter++;
      baseName = `Custom_Plugin_${counter}`;
    }
    const pluginId = `plugin_${baseName.toLowerCase()}_${Date.now()}`;
    const componentName = baseName.replace(/[^a-zA-Z0-9]/g, '') || 'CustomPlugin';
    const starterCode = `import React, { useState, useEffect } from 'react';
import { GAWContext } from 'gaw';
import { Sparkles, RefreshCw, Database } from 'lucide-react';

interface PluginProps {
  gawContext: GAWContext;
}

export default function ${componentName}({ gawContext }: PluginProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    try {
      // Query local SQLite database
      const result = gawContext.sqlite.query('SELECT * FROM customers LIMIT 10;');
      setData(result.values);
      gawContext.ui.toast.info('Loaded customer preview');
    } catch (err: any) {
      gawContext.ui.toast.error('Query failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>${baseName}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic MS Access-style TSX Plugin running in SQLite.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs">
        <h3 className="font-semibold text-slate-200 mb-2">Query Preview (Customers):</h3>
        <p className="text-slate-400">Total rows loaded: {data.length}</p>
      </div>
    </div>
  );
}
`;
    const now = new Date().toISOString();
    engine.run(
      'INSERT INTO t_gaw_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        pluginId,
        baseName,
        '1.0.0',
        1,
        'Boxes',
        'Custom',
        `/${baseName.toLowerCase()}`,
        `Custom dynamic TSX plugin ${baseName}`,
        starterCode,
        now,
        now,
      ]
    );
    engine.notifyChange(true);
    setExpandedFolders((prev) => {
      const next = { ...prev, plugins: true, pluginsUser: true };
      safeStorage.setItem('gaw_ide_expanded_folders', JSON.stringify(next));
      return next;
    });
    openOrActivateItem({ type: 'plugin', id: pluginId, name: baseName });
    gawContext?.toast?.success?.(`Created new plugin "${baseName}.tsx"`);
  }, [engine, gawContext, openOrActivateItem]);

  // Handler: Add New Table via pro-forma SQL query
  const handleAddNewTable = useCallback(() => {
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
    const now = new Date().toISOString();

    engine.saveQuery({
      id: newId,
      name: queryName,
      description: `Pro-forma query to create table "${baseName}"`,
      query: proFormaSql,
      params: '{}',
      layout: '{}',
      created_at: now,
    });
    setExpandedFolders((prev) => {
      const next = { ...prev, queries: true };
      safeStorage.setItem('gaw_ide_expanded_folders', JSON.stringify(next));
      return next;
    });
    openOrActivateItem({ type: 'query', id: newId, name: queryName, code: proFormaSql });
    gawContext?.toast?.info?.(`Opened table creation query "${queryName}". Review and press Ctrl+Enter to execute or Ctrl+Shift+K to view results.`);
  }, [engine, gawContext, openOrActivateItem]);

  // Handler: Add New View via pro-forma SQL query
  const handleAddNewView = useCallback(() => {
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
    const now = new Date().toISOString();

    engine.saveQuery({
      id: newId,
      name: queryName,
      description: `Pro-forma query to create view "${baseName}"`,
      query: proFormaSql,
      params: '{}',
      layout: '{}',
      created_at: now,
    });
    setExpandedFolders((prev) => {
      const next = { ...prev, queries: true };
      safeStorage.setItem('gaw_ide_expanded_folders', JSON.stringify(next));
      return next;
    });
    openOrActivateItem({ type: 'query', id: newId, name: queryName, code: proFormaSql });
    gawContext?.toast?.info?.(`Opened view creation query "${queryName}". Review and press Ctrl+Enter to execute or Ctrl+Shift+K to view results.`);
  }, [engine, gawContext, openOrActivateItem]);

  // Handler: Add New Query
  const handleAddNewQuery = useCallback(() => {
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
    const now = new Date().toISOString();

    engine.saveQuery({
      id: newId,
      name: baseName,
      description: `Custom query ${baseName}`,
      query: querySql,
      params: '{}',
      layout: '{}',
      created_at: now,
    });
    engine.notifyChange(true);
    setExpandedFolders((prev) => {
      const next = { ...prev, queries: true };
      safeStorage.setItem('gaw_ide_expanded_folders', JSON.stringify(next));
      return next;
    });
    openOrActivateItem({ type: 'query', id: newId, name: baseName, code: querySql });
    gawContext?.toast?.success?.(`Created new query "${baseName}"`);
  }, [engine, gawContext, openOrActivateItem]);

  // Handler: Add New Report (.json)
  const handleAddNewReport = useCallback(() => {
    const existingReports = engine.getSavedReports().map((r) => r.name);
    let baseName = 'New_Report';
    let counter = 1;
    while (existingReports.includes(baseName)) {
      counter++;
      baseName = `New_Report_${counter}`;
    }
    const newId = `r_${baseName.toLowerCase()}_${Date.now()}`;
    const firstQuery = engine.getSavedQueries()[0];
    const initialConfig = {
      title: baseName.replace(/_/g, ' '),
      subtitle: 'Executive Summary Briefing',
      columns: ['id', 'company_name', 'contact_name', 'city', 'country'],
      showKpi: true,
      showChart: false,
    };
    const now = new Date().toISOString();

    engine.saveReport({
      id: newId,
      name: baseName,
      description: `Executive publication brief ${baseName}`,
      query_id: firstQuery?.id || '',
      custom_sql: 'SELECT * FROM customers LIMIT 25;',
      config: JSON.stringify(initialConfig),
      created_at: now,
    });
    engine.notifyChange(true);
    setExpandedFolders((prev) => {
      const next = { ...prev, reports: true };
      safeStorage.setItem('gaw_ide_expanded_folders', JSON.stringify(next));
      return next;
    });
    openOrActivateItem({ type: 'report', id: newId, name: baseName });
    gawContext?.toast?.success?.(`Created new report "${baseName}.json"`);
  }, [engine, gawContext, openOrActivateItem]);

  // Open plugin tab and immediately toggle view to rendered plugin host
  const openAndTogglePlugin = useCallback(
    (pluginId: string, name: string) => {
      openOrActivateItem({ type: 'plugin', id: pluginId, name });
      const tabId = `tab_plugin_${pluginId}`;
      setToggledTabIds((prev) => ({
        ...prev,
        [tabId]: true,
      }));
    },
    [openOrActivateItem]
  );

  // Open spreadsheet in IDE main panel
  const handleIDEOpenSpreadsheet = useCallback(
    (data: { columns: string[]; values: any[][] }, sheetName?: string) => {
      if (gawContext) {
        (gawContext as any).spreadsheetPendingData = {
          columns: data.columns,
          values: data.values,
          sheetName: sheetName || activeTab?.title?.replace(/\.sql$/i, '') || 'Query Result',
          returnTabId: activeTabId,
        };
      }
      openAndTogglePlugin('plugin_spreadsheet_studio', 'Spreadsheet Studio');
    },
    [gawContext, activeTabId, activeTab, openAndTogglePlugin]
  );

  useEffect(() => {
    if (gawContext) {
      (gawContext as any).returnToPreviousIDETab = (tabId: string) => {
        if (tabId && tabs.some((t) => t.id === tabId)) {
          setActiveTabId(tabId);
        }
      };
      if (gawContext.navigation) {
        (gawContext.navigation as any).openPreviousTab = () => {
          const pending = (gawContext as any).spreadsheetPendingData;
          if (pending?.returnTabId && tabs.some((t) => t.id === pending.returnTabId)) {
            setActiveTabId(pending.returnTabId);
          } else if (tabs.length > 1) {
            const prev = tabs.find((t) => t.id !== 'tab_plugin_plugin_spreadsheet_studio');
            if (prev) setActiveTabId(prev.id);
          }
        };
      }
    }
  }, [gawContext, tabs]);

  // Add new SQL tab
  const addSqlTab = () => {
    const id = `tab_sql_${Date.now()}`;
    const content = 'SELECT * FROM customers LIMIT 25;';
    const newTab: TabItem = {
      id,
      title: `Query_${tabs.length + 1}`,
      type: 'sql',
      content,
      savedContent: content,
      isDirty: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(id);
  };

  // Edit -> Invert Selection (Alt+E I): replaces Monaco's current selections with their exact text complement
  const handleInvertSelection = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    const fullLen = model.getValueLength();
    const selections = editor.getSelections() || [];

    // Convert each non-empty selection to a sorted [start, end] offset range and merge overlaps
    const intervals: Array<[number, number]> = selections
      .map((sel: any): [number, number] => {
        const a = model.getOffsetAt({ lineNumber: sel.startLineNumber, column: sel.startColumn });
        const b = model.getOffsetAt({ lineNumber: sel.endLineNumber, column: sel.endColumn });
        return a <= b ? [a, b] : [b, a];
      })
      .filter(([a, b]: [number, number]) => b > a)
      .sort((x: [number, number], y: [number, number]) => x[0] - y[0]);

    if (intervals.length === 0) {
      editor.setSelection(model.getFullModelRange());
      editor.focus();
      return;
    }

    const merged: Array<[number, number]> = [];
    for (const [start, end] of intervals) {
      if (merged.length === 0 || start > merged[merged.length - 1][1]) {
        merged.push([start, end]);
      } else {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], end);
      }
    }

    // If the entire file is selected, inverting clears selection to the top of the document
    if (merged.length === 1 && merged[0][0] === 0 && merged[0][1] === fullLen) {
      editor.setSelection(new monaco.Selection(1, 1, 1, 1));
      editor.focus();
      return;
    }

    const complements: Array<[number, number]> = [];
    let cursor = 0;
    for (const [start, end] of merged) {
      if (start > cursor) {
        complements.push([cursor, start]);
      }
      cursor = end;
    }
    if (cursor < fullLen) {
      complements.push([cursor, fullLen]);
    }

    if (complements.length === 0) {
      editor.setSelection(new monaco.Selection(1, 1, 1, 1));
    } else {
      const nextSelections = complements.map(([start, end]) => {
        const startPos = model.getPositionAt(start);
        const endPos = model.getPositionAt(end);
        return new monaco.Selection(
          startPos.lineNumber,
          startPos.column,
          endPos.lineNumber,
          endPos.column
        );
      });
      editor.setSelections(nextSelections);
    }
    editor.focus();
  }, []);

  // File -> Open Drive -> pCloud / Google Drive / Dropbox / Local
  const handleOpenDrive = useCallback(
    (provider: H2Provider) => {
      if (gawContext) {
        (gawContext as any).clockieH2PendingProvider = provider;
        gawContext.eventBus?.emit?.('clockie_h2_select_provider', provider);
      }
      openAndTogglePlugin('plugin_clockie_h2', 'Clockie H2 Drives');
    },
    [gawContext, openAndTogglePlugin]
  );

  // View -> Refresh (Alt+V R): refresh DB schema/Explorer, clear compiled plugin cache,
  // reset toggled view cache, and verify active Clockie H2 file revision via lightweight statFile
  const handleRefreshView = useCallback(async () => {
    PluginEngine.clearCache();
    lastExecutedTabContentRef.current = '';
    setDbVersion((v) => v + 1);
    gawContext?.eventBus?.emit?.('storage_changed');

    const h2State = h2BridgeEngine.getState();
    const activeH2 = h2State.activeFile;
    if (activeH2 && h2BridgeEngine.isConnected()) {
      try {
        const stat = await h2BridgeEngine.getClient().statFile({
          provider: activeH2.provider,
          driveRoot: activeH2.driveRoot,
          relativePath: activeH2.relativePath,
          fileId: activeH2.fileId,
        });
        if (!stat.exists) {
          gawContext?.toast?.warning?.(
            `Workspace refreshed. Remote file "${activeH2.name}" was not found on ${activeH2.provider}.`
          );
        } else if (stat.revision && activeH2.revision && stat.revision !== activeH2.revision) {
          gawContext?.toast?.info?.(
            `Workspace refreshed. Remote revision of "${activeH2.name}" has updated on ${activeH2.provider}.`
          );
        } else {
          gawContext?.toast?.success?.(
            `Workspace refreshed and "${activeH2.name}" is up to date.`
          );
        }
        return;
      } catch (err: any) {
        gawContext?.toast?.warning?.(
          `Workspace refreshed locally (Clockie H2 stat check failed: ${err?.message || 'unknown error'}).`
        );
        return;
      }
    }

    gawContext?.toast?.success?.('Workspace schema, Explorer, and component caches refreshed.');
  }, [gawContext, h2BridgeEngine]);

  // Keep latest action closures wired into the unified capture-phase shortcut dispatcher
  shortcutActionHandlersRef.current = {
    'file.new.component': () => handleAddNewPlugin(),
    'file.new.query': () => handleAddNewQuery(),
    'file.new.table': () => handleAddNewTable(),
    'file.new.view': () => handleAddNewView(),
    'file.new.report': () => (onNewReportVisual ? onNewReportVisual() : handleAddNewReport()),
    'file.newTab': () => addSqlTab(),
    'file.closeTab': () => {
      if (activeTabId) closeTab(activeTabId);
    },
    'file.closeAllTabs': () => closeAllTabs(),
    'file.undoCloseTab': () => handleUndoCloseTab(),
    'file.open': () => openAndTogglePlugin('plugin_file_manager', 'File & Workspace Manager'),
    'file.openDrive.pcloud': () => handleOpenDrive('pcloud'),
    'file.openDrive.gdrive': () => handleOpenDrive('gdrive'),
    'file.openDrive.dropbox': () => handleOpenDrive('dropbox'),
    'file.openDrive.local': () => handleOpenDrive('local'),
    'file.save': () => handleSaveActiveTabRef.current?.(),
    'file.saveAs': () => handleOpenSaveAsRef.current?.(),
    'file.saveAll': () => {
      saveDirtyTabsRef.current?.();
    },
    'edit.invertSelection': () => handleInvertSelection(),
    'edit.preferences': () =>
      openAndTogglePlugin('plugin_settings', 'Settings & Workspace Preferences'),
    'bridge.interactionsLog': () => setShowBridgeLogModal(true),
    'view.refresh': () => {
      void handleRefreshView();
    },
    'view.shortcuts.system': () => setShortcutModalTab('system'),
    'view.shortcuts.custom': () => setShortcutModalTab('custom'),
    'help.about': () => setShowAboutModal(true),
    'ide.commandPalette': () => setShowCommandPalette(true),
    'ide.toggleSidebar': () => setIsPrimarySidebarOpen((prev) => !prev),
    'ide.toggleMode': () => {
      void handleSwitchToAppMode();
    },
    'ide.toggleView': () => handleToggleViewInIDERef.current?.(),
    'ide.formatDocument': () => {
      void handleFormatDocument();
    },
    'ide.runQuery': () => runCurrentQuery(),
    'ide.toggleComment': () => handleToggleCommentsRef.current?.(),
  };


  // Search in Files Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchMatchCase ? searchQuery : searchQuery.toLowerCase();
    const results: Array<{
      file: string;
      tabItem: TargetTabInfo;
      line: number;
      text: string;
    }> = [];

    // Search in Plugins
    allPlugins.forEach((p) => {
      const lines = p.code.split('\n');
      lines.forEach((lineText, idx) => {
        const cmp = searchMatchCase ? lineText : lineText.toLowerCase();
        if (cmp.includes(q)) {
          results.push({
            file: `${p.name}.tsx`,
            tabItem: { type: 'plugin', id: p.id, name: p.name },
            line: idx + 1,
            text: lineText.trim(),
          });
        }
      });
    });

    // Search in Queries
    allQueries.forEach((query) => {
      const lines = query.query.split('\n');
      lines.forEach((lineText, idx) => {
        const cmp = searchMatchCase ? lineText : lineText.toLowerCase();
        if (cmp.includes(q)) {
          results.push({
            file: query.name.replace(/\.sql$/i, ''),
            tabItem: { type: 'query', id: query.id, name: query.name },
            line: idx + 1,
            text: lineText.trim(),
          });
        }
      });
    });

    return results.slice(0, 50); // limit to 50
  }, [searchQuery, searchMatchCase, allPlugins, allQueries]);

  // Command Palette Items
  const commandPaletteItems = useMemo(() => {
    const list = [
      {
        id: 'cmd_format',
        title: 'Prettier: Format Document',
        shortcut: 'Shift+Alt+F',
        action: () => handleFormatDocument(),
      },
      {
        id: 'cmd_run',
        title: 'Run: Execute Active Document / Query',
        shortcut: 'Ctrl+Enter',
        action: () => runCurrentQuery(),
      },
      {
        id: 'cmd_undo',
        title: 'Edit: Undo',
        shortcut: 'Ctrl+Z',
        action: () => handleUndo(),
      },
      {
        id: 'cmd_redo',
        title: 'Edit: Redo',
        shortcut: 'Ctrl+Y',
        action: () => {
          editorRef.current?.trigger('commandPalette', 'redo', null);
          editorRef.current?.focus();
        },
      },
      {
        id: 'cmd_save',
        title: 'File: Save Current File',
        shortcut: 'Ctrl+S',
        action: () => handleSaveActiveTab(),
      },
      {
        id: 'cmd_save_as',
        title: 'File: Save As...',
        shortcut: 'Ctrl+Shift+S',
        action: () => handleOpenSaveAs(),
      },
      {
        id: 'cmd_toggle_theme',
        title: `Preferences: Color Theme (Switch to ${isDark ? 'Light' : 'Dark'} Mode)`,
        shortcut: '',
        action: () => onToggleTheme?.(),
      },
      {
        id: 'cmd_toggle_sidebar',
        title: 'View: Toggle Primary Side Bar',
        shortcut: 'Ctrl+B',
        action: () => setIsPrimarySidebarOpen((prev) => !prev),
      },
      {
        id: 'cmd_switch_app_mode',
        title: 'View: Switch to App Mode (Auto-saves dirty tabs)',
        shortcut: 'Ctrl+Shift+F',
        action: () => handleSwitchToAppMode(),
      },
      {
        id: 'cmd_toggle_view',
        title: 'View: Toggle View in IDE (Code <-> Live Preview / Data Grid / Report)',
        shortcut: 'Ctrl+Shift+K',
        action: () => handleToggleViewInIDE(),
      },
      {
        id: 'cmd_new_sql',
        title: 'File: New SQL Query File',
        shortcut: 'Alt+N',
        action: () => addSqlTab(),
      },
      {
        id: 'cmd_new_visual_report',
        title: 'Report: Open Visual Report Builder...',
        shortcut: '',
        action: () => onNewReportVisual?.(),
      },
      {
        id: 'cmd_import_component',
        title: 'Component: Import Component Wizard...',
        shortcut: '',
        action: () => onOpenAddPluginModal?.(),
      },
      {
        id: 'cmd_ai_spec',
        title: 'Tools: AI Specification Generator...',
        shortcut: '',
        action: () => onOpenAI?.(),
      },
      {
        id: 'cmd_toggle_minimap',
        title: 'View: Toggle Minimap',
        shortcut: '',
        action: () => setShowMinimap((prev) => !prev),
      },
      {
        id: 'cmd_about',
        title: 'Help: About Gawkyy IDE',
        shortcut: '',
        action: () => setShowAboutModal(true),
      },
      {
        id: 'cmd_file_manager',
        title: 'System UI: Open File & Workspace Manager',
        shortcut: '',
        action: () => openAndTogglePlugin('plugin_file_manager', 'File & Workspace Manager'),
      },
      {
        id: 'cmd_db_management',
        title: 'System UI: Open Database Management',
        shortcut: '',
        action: () => openAndTogglePlugin('plugin_database_management', 'Database Management'),
      },
      {
        id: 'cmd_components_manager',
        title: 'System UI: Open Components Manager',
        shortcut: '',
        action: () => openAndTogglePlugin('plugin_manager', 'Components Manager'),
      },
      {
        id: 'cmd_clockie_h2',
        title: 'System UI: Open Clockie H2 Drives',
        shortcut: '',
        action: () => openAndTogglePlugin('plugin_clockie_h2', 'Clockie H2 Drives'),
      },
      {
        id: 'cmd_local_storage',
        title: 'System UI: Open Local Storage & Persistence',
        shortcut: '',
        action: () => openAndTogglePlugin('plugin_local_storage', 'Local Storage & Persistence'),
      },
      {
        id: 'cmd_spreadsheet_studio',
        title: 'System UI: Open Spreadsheet Studio',
        shortcut: '',
        action: () => openAndTogglePlugin('plugin_spreadsheet_studio', 'Spreadsheet Studio'),
      },
      {
        id: 'cmd_app_settings',
        title: 'System UI: Open Application Settings',
        shortcut: '',
        action: () => openAndTogglePlugin('plugin_settings', 'Settings & Workspace Preferences'),
      },
      {
        id: 'cmd_debugging',
        title: 'System UI: Open Startup Debugging & Diagnostics',
        shortcut: '',
        action: () => openAndTogglePlugin('plugin_debugging', 'Debugging & Diagnostics'),
      },
      {
        id: 'cmd_help',
        title: 'Help: Open Help & System Guide',
        shortcut: '',
        action: () => openAndTogglePlugin('plugin_help', 'Help & System Guide'),
      },
      {
        id: 'cmd_open_types',
        title: 'Preferences: Open GAW TypeScript Definitions (gaw.d.ts)',
        shortcut: '',
        action: () => openOrActivateItem({ type: 'types' }),
      },
      {
        id: 'cmd_open_pkg',
        title: 'Preferences: Open package.json',
        shortcut: '',
        action: () => openOrActivateItem({ type: 'json', name: 'package.json' }),
      },
    ];

    // Add quick open files
    allPlugins.forEach((p) => {
      list.push({
        id: `file_plugin_${p.id}`,
        title: `Go to File: ${p.name}.tsx`,
        shortcut: 'Plugin',
        action: () => openOrActivateItem({ type: 'plugin', id: p.id, name: p.name }),
      });
    });

    allTables.forEach((t) => {
      list.push({
        id: `file_table_${t.name}`,
        title: `Go to File: ${t.name} (Schema DDL)`,
        shortcut: 'Table',
        action: () => openOrActivateItem({ type: 'table', name: t.name }),
      });
    });

    const q = commandPaletteQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter((item) => item.title.toLowerCase().includes(q));
  }, [
    allPlugins,
    allTables,
    commandPaletteQuery,
    isDark,
    onToggleTheme,
    handleSwitchToAppMode,
    handleToggleViewInIDE,
    onNewReportVisual,
    onOpenAddPluginModal,
    onOpenAI,
    openAndTogglePlugin,
    openOrActivateItem,
  ]);

  // Tab editor language
  const editorLanguage = useMemo(() => {
    if (activeTab?.type === 'plugin' || activeTab?.type === 'types') return 'typescript';
    if (activeTab?.type === 'report' || activeTab?.type === 'json') return 'json';
    return 'sql';
  }, [activeTab?.type]);

  // Active query result to render
  const currentResult = queryResults[activeResultIndex] || queryResults[0];

  // Standardized Gawkyy IDE menubar definitions aligned with Clockie H2 and Monaco IDE
  const menuDefinitions: Record<MenuKey, MenuItemDef[]> = {
    App: [
      {
        label: 'About Gawkyy IDE...',
        shortcut: getMenuShortcut('help.about'),
        action: () => setShowAboutModal(true),
      },
      {
        label: `Preferences: Color Theme (${isDark ? 'Switch to Light' : 'Switch to Dark'})`,
        action: () => onToggleTheme?.(),
        divider: true,
      },
      {
        label: 'Editor Settings & Keybindings...',
        action: () => {
          setActiveActivity('settings');
          setIsPrimarySidebarOpen(true);
        },
      },
      {
        label: 'Preferences',
        shortcut: getMenuShortcut('edit.preferences'),
        action: () => openAndTogglePlugin('plugin_settings', 'Settings & Workspace Preferences'),
      },
      {
        label: 'Command Palette...',
        shortcut: getMenuShortcut('ide.commandPalette'),
        action: () => setShowCommandPalette(true),
      },
      {
        label: 'Switch to App Mode',
        shortcut: getMenuShortcut('ide.toggleMode'),
        action: () => handleSwitchToAppMode(),
      },
    ],
    File: [
      {
        label: 'New',
        children: [
          {
            label: 'Component',
            shortcut: getMenuShortcut('file.new.component'),
            action: () => handleAddNewPlugin(),
          },
          {
            label: 'Query',
            shortcut: getMenuShortcut('file.new.query'),
            action: () => handleAddNewQuery(),
          },
          {
            label: 'Table',
            shortcut: getMenuShortcut('file.new.table'),
            action: () => handleAddNewTable(),
          },
          {
            label: 'View',
            shortcut: getMenuShortcut('file.new.view'),
            action: () => handleAddNewView(),
          },
          {
            label: 'Report',
            shortcut: getMenuShortcut('file.new.report'),
            action: () => (onNewReportVisual ? onNewReportVisual() : handleAddNewReport()),
            divider: true,
          },
          {
            label: 'Report (.json)',
            action: () => handleAddNewReport(),
          },
          {
            label: 'Import Component Wizard...',
            action: () => onOpenAddPluginModal?.(),
          },
        ],
        divider: true,
      },
      {
        label: 'New tab',
        shortcut: getMenuShortcut('file.newTab'),
        action: () => addSqlTab(),
      },
      {
        label: 'Close tab',
        shortcut: getMenuShortcut('file.closeTab'),
        disabled: !activeTabId,
        action: () => {
          if (activeTabId) closeTab(activeTabId);
        },
      },
      {
        label: 'Close all tabs',
        shortcut: getMenuShortcut('file.closeAllTabs'),
        disabled: tabs.length === 0,
        action: () => closeAllTabs(),
      },
      {
        label: 'Undo close tab',
        shortcut: getMenuShortcut('file.undoCloseTab'),
        disabled: closedTabsCount === 0,
        action: () => handleUndoCloseTab(),
        divider: true,
      },
      {
        label: 'Open',
        shortcut: getMenuShortcut('file.open'),
        action: () => openAndTogglePlugin('plugin_file_manager', 'File & Workspace Manager'),
      },
      {
        label: 'Open Drive',
        children: [
          {
            label: 'pCloud',
            shortcut: getMenuShortcut('file.openDrive.pcloud'),
            action: () => handleOpenDrive('pcloud'),
          },
          {
            label: 'Google Drive',
            shortcut: getMenuShortcut('file.openDrive.gdrive'),
            action: () => handleOpenDrive('gdrive'),
          },
          {
            label: 'Dropbox',
            shortcut: getMenuShortcut('file.openDrive.dropbox'),
            action: () => handleOpenDrive('dropbox'),
          },
          {
            label: 'Local',
            shortcut: getMenuShortcut('file.openDrive.local'),
            action: () => handleOpenDrive('local'),
          },
        ],
      },
      {
        label: 'Open Object / Command Palette...',
        shortcut: getMenuShortcut('ide.commandPalette'),
        action: () => setShowCommandPalette(true),
        divider: true,
      },
      {
        label: 'Save',
        shortcut: getMenuShortcut('file.save'),
        disabled: !activeTab,
        action: () => handleSaveActiveTabRef.current?.(),
      },
      {
        label: 'Save As…',
        shortcut: getMenuShortcut('file.saveAs'),
        disabled: !activeTab,
        action: () => handleOpenSaveAsRef.current?.(),
      },
      {
        label: 'Save All',
        shortcut: getMenuShortcut('file.saveAll'),
        action: () => {
          saveDirtyTabsRef.current?.();
        },
      },
      {
        label: 'Format with Prettier & Save',
        shortcut: getMenuShortcut('ide.formatDocument'),
        disabled: !activeTab,
        action: async () => {
          await handleFormatDocument();
          handleSaveActiveTabRef.current?.();
        },
        divider: true,
      },
      {
        label: 'Switch to App Mode',
        shortcut: getMenuShortcut('ide.toggleMode'),
        action: () => handleSwitchToAppMode(),
      },
    ],
    Edit: [
      {
        label: 'Undo',
        shortcut: getMenuShortcut('edit.undo'),
        action: () => handleUndo(),
      },
      {
        label: 'Redo',
        shortcut: getMenuShortcut('edit.redo'),
        action: () => {
          editorRef.current?.trigger('menu', 'redo', null);
          editorRef.current?.focus();
        },
        divider: true,
      },
      {
        label: 'Cut',
        shortcut: getMenuShortcut('edit.cut'),
        action: () => {
          editorRef.current?.focus();
          document.execCommand('cut');
        },
      },
      {
        label: 'Copy',
        shortcut: getMenuShortcut('edit.copy'),
        action: () => {
          editorRef.current?.focus();
          document.execCommand('copy');
        },
      },
      {
        label: 'Paste',
        shortcut: getMenuShortcut('edit.paste'),
        action: () => {
          navigator.clipboard?.readText?.().then((text) => {
            if (text && editorRef.current) {
              editorRef.current.trigger('menu', 'type', { text });
              editorRef.current.focus();
            }
          });
        },
        divider: true,
      },
      {
        label: 'Select All',
        shortcut: getMenuShortcut('edit.selectAll'),
        action: () => {
          if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
              editorRef.current.setSelection(model.getFullModelRange());
              editorRef.current.focus();
            }
          }
        },
      },
      {
        label: 'Invert Selection',
        shortcut: getMenuShortcut('edit.invertSelection'),
        action: () => handleInvertSelection(),
        divider: true,
      },
      {
        label: 'Find in File',
        shortcut: 'Ctrl+F',
        action: () => {
          editorRef.current?.getAction('actions.find')?.run();
          editorRef.current?.focus();
        },
      },
      {
        label: 'Replace in File',
        shortcut: 'Ctrl+H',
        action: () => {
          editorRef.current?.getAction('editor.action.startFindReplaceAction')?.run();
          editorRef.current?.focus();
        },
        divider: true,
      },
      {
        label: 'Format Document (Prettier)',
        shortcut: getMenuShortcut('ide.formatDocument'),
        action: () => handleFormatDocument(),
        divider: true,
      },
      {
        label: 'Preferences',
        shortcut: getMenuShortcut('edit.preferences'),
        action: () => openAndTogglePlugin('plugin_settings', 'Settings & Workspace Preferences'),
      },
    ],
    Selection: [
      {
        label: 'Select All',
        shortcut: getMenuShortcut('edit.selectAll'),
        action: () => {
          if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
              editorRef.current.setSelection(model.getFullModelRange());
              editorRef.current.focus();
            }
          }
        },
      },
      {
        label: 'Invert Selection',
        shortcut: getMenuShortcut('edit.invertSelection'),
        action: () => handleInvertSelection(),
      },
      {
        label: 'Expand Selection',
        shortcut: 'Shift+Alt+Right',
        action: () => {
          editorRef.current?.getAction('editor.action.smartSelect.expand')?.run();
        },
      },
      {
        label: 'Shrink Selection',
        shortcut: 'Shift+Alt+Left',
        action: () => {
          editorRef.current?.getAction('editor.action.smartSelect.shrink')?.run();
        },
        divider: true,
      },
      {
        label: 'Copy Line Up',
        shortcut: 'Shift+Alt+Up',
        action: () => {
          editorRef.current?.getAction('editor.action.copyLinesUpAction')?.run();
        },
      },
      {
        label: 'Copy Line Down',
        shortcut: 'Shift+Alt+Down',
        action: () => {
          editorRef.current?.getAction('editor.action.copyLinesDownAction')?.run();
        },
      },
      {
        label: 'Move Line Up',
        shortcut: 'Alt+Up',
        action: () => {
          editorRef.current?.getAction('editor.action.moveLinesUpAction')?.run();
        },
      },
      {
        label: 'Move Line Down',
        shortcut: 'Alt+Down',
        action: () => {
          editorRef.current?.getAction('editor.action.moveLinesDownAction')?.run();
        },
      },
    ],
    Bridge: [
      {
        label: 'Show Interactions Log',
        shortcut: getMenuShortcut('bridge.interactionsLog'),
        action: () => setShowBridgeLogModal(true),
        divider: true,
      },
      {
        label: 'Open Clockie H2 Drives',
        action: () => openAndTogglePlugin('plugin_clockie_h2', 'Clockie H2 Drives'),
      },
      {
        label: 'Reconnect Bridge',
        action: () => {
          h2BridgeEngine
            .reconnect()
            .then((ok) => {
              if (ok) {
                gawContext?.toast?.success?.('Connected to Clockie H2 Bridge v1.6.');
              } else {
                gawContext?.toast?.warning?.(
                  h2BridgeEngine.getState().error || 'Clockie H2 extension did not respond.'
                );
              }
            })
            .catch((err: any) => {
              gawContext?.toast?.error?.(`Bridge reconnect failed: ${err?.message || String(err)}`);
            });
        },
      },
      {
        label: 'Disconnect Bridge',
        action: () => {
          h2BridgeEngine.disconnect().then(() => {
            gawContext?.toast?.info?.('Disconnected from Clockie H2 Bridge.');
          });
        },
      },
    ],
    View: [
      {
        label: 'Refresh',
        shortcut: getMenuShortcut('view.refresh'),
        action: () => {
          void handleRefreshView();
        },
      },
      {
        label: 'Shortcuts',
        children: [
          {
            label: 'System shortcuts',
            shortcut: getMenuShortcut('view.shortcuts.system'),
            action: () => setShortcutModalTab('system'),
          },
          {
            label: 'Custom shortcuts',
            shortcut: getMenuShortcut('view.shortcuts.custom'),
            action: () => setShortcutModalTab('custom'),
          },
        ],
        divider: true,
      },
      {
        label: 'Command Palette...',
        shortcut: getMenuShortcut('ide.commandPalette'),
        action: () => setShowCommandPalette(true),
        divider: true,
      },
      {
        label: 'Explorer',
        action: () => {
          setActiveActivity('explorer');
          setIsPrimarySidebarOpen(true);
        },
      },
      {
        label: 'Search in Files',
        action: () => {
          setActiveActivity('search');
          setIsPrimarySidebarOpen(true);
        },
      },
      {
        label: 'Extensions / Components',
        action: () => {
          setActiveActivity('extensions');
          setIsPrimarySidebarOpen(true);
        },
        divider: true,
      },
      {
        label: 'Toggle Primary Side Bar',
        shortcut: getMenuShortcut('ide.toggleSidebar'),
        action: () => setIsPrimarySidebarOpen((p) => !p),
      },
      {
        label: 'Toggle Live TSX Preview',
        action: () => setShowLivePreview((p) => !p),
      },
      {
        label: 'Toggle View (Code <-> Preview/Data/Report)',
        shortcut: getMenuShortcut('ide.toggleView'),
        action: () => handleToggleViewInIDE(),
      },
      {
        label: 'Toggle Minimap',
        action: () => setShowMinimap((p) => !p),
        divider: true,
      },
      {
        label: `Color Theme: ${isDark ? 'Switch to Light' : 'Switch to Dark'}`,
        action: () => onToggleTheme?.(),
      },
    ],
    Go: [
      {
        label: 'Go to Line / Column...',
        shortcut: 'Ctrl+G',
        action: () => {
          editorRef.current?.getAction('editor.action.gotoLine')?.run();
        },
        divider: true,
      },
      {
        label: 'Next Tab',
        shortcut: 'Alt+Right',
        action: () => {
          const idx = tabs.findIndex((t) => t.id === activeTabId);
          if (idx !== -1 && tabs.length > 1) {
            const nextTab = tabs[(idx + 1) % tabs.length];
            setActiveTabId(nextTab.id);
          }
        },
      },
      {
        label: 'Previous Tab',
        shortcut: 'Alt+Left',
        action: () => {
          const idx = tabs.findIndex((t) => t.id === activeTabId);
          if (idx !== -1 && tabs.length > 1) {
            const prevTab = tabs[(idx - 1 + tabs.length) % tabs.length];
            setActiveTabId(prevTab.id);
          }
        },
      },
    ],
    Run: [
      {
        label: 'Run Current Query / Document',
        shortcut: getMenuShortcut('ide.runQuery'),
        action: () => runCurrentQuery(),
      },
      {
        label: 'Validate TSX Component Syntax',
        action: () => {
          if (activeTab?.type === 'plugin') {
            const res = PluginEngine.compile(activeTab.content, activeTab.pluginId || 'test');
            setCompileStatus({ valid: res.success, error: res.error });
            if (res.success) {
              gawContext?.toast?.success?.('TSX Syntax Valid: No compilation errors found.');
            } else {
              gawContext?.toast?.error?.('TSX Syntax Error: ' + (res.error || 'Unknown error'));
            }
          }
        },
        divider: true,
      },
      {
        label: 'Clear Results',
        action: () => setQueryResults([]),
      },
    ],
    Terminal: [
      {
        label: 'Toggle Output / Terminal Panel',
        shortcut: 'Ctrl+`',
        action: () => {
          if (queryResults.length === 0 && activeTab) {
            runCurrentQuery();
          } else {
            setQueryResults([]);
          }
        },
      },
      {
        label: 'Clear Terminal Output',
        action: () => setQueryResults([]),
      },
    ],
    Tools: [
      {
        label: 'AI Specification Generator...',
        action: () => onOpenAI?.(),
      },
      {
        label: 'Visual Report Builder...',
        action: () => onNewReportVisual?.(),
      },
      {
        label: 'Import Component Wizard...',
        action: () => onOpenAddPluginModal?.(),
        divider: true,
      },
      {
        label: 'Database Management UI',
        action: () => openAndTogglePlugin('plugin_database_management', 'Database Management'),
      },
      {
        label: 'Components Manager UI',
        action: () => openAndTogglePlugin('plugin_manager', 'Components Manager'),
      },
      {
        label: 'Spreadsheet Studio UI',
        action: () => openAndTogglePlugin('plugin_spreadsheet_studio', 'Spreadsheet Studio'),
      },
      {
        label: 'Clockie H2 Drives UI',
        action: () => openAndTogglePlugin('plugin_clockie_h2', 'Clockie H2 Drives'),
      },
      {
        label: 'Local Storage & Persistence UI',
        action: () => openAndTogglePlugin('plugin_local_storage', 'Local Storage & Persistence'),
      },
      {
        label: 'Startup Debugging & Benchmarks UI',
        action: () => openAndTogglePlugin('plugin_debugging', 'Debugging & Diagnostics'),
      },
      {
        label: 'Application Settings UI',
        action: () => openAndTogglePlugin('plugin_settings', 'Settings & Workspace Preferences'),
      },
    ],
    Help: [
      {
        label: 'Help & System Guide',
        action: () => openAndTogglePlugin('plugin_help', 'Help & System Guide'),
      },
      {
        label: 'Keyboard Shortcuts Reference',
        shortcut: getMenuShortcut('view.shortcuts.system'),
        action: () => setShortcutModalTab('system'),
        divider: true,
      },
      {
        label: 'About',
        shortcut: getMenuShortcut('help.about'),
        action: () => setShowAboutModal(true),
      },
    ],
  };

  const renderMenuDropdown = (mKey: MenuKey) => {
    const items = menuDefinitions[mKey] || [];
    return (
      <div
        className={`absolute left-0 top-full mt-1 min-w-[248px] rounded-lg shadow-2xl py-1.5 z-50 select-text border backdrop-blur-md ${
          isDark
            ? 'bg-[#252526] border-[#454545] text-slate-200'
            : 'bg-white border-[#d4d4d4] text-slate-800'
        }`}
      >
        {items.map((item, idx) => {
          const subKey = `${mKey}:${idx}`;
          const hasChildren = Boolean(item.children && item.children.length > 0);
          const isSubOpen = openSubmenuKey === subKey;

          return (
            <React.Fragment key={subKey}>
              <div
                className="relative"
                onMouseEnter={() => setOpenSubmenuKey(hasChildren ? subKey : null)}
              >
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    if (hasChildren) {
                      setOpenSubmenuKey((prev) => (prev === subKey ? null : subKey));
                      return;
                    }
                    setActiveMenu(null);
                    setOpenSubmenuKey(null);
                    item.action?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition ${
                    item.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : isDark
                      ? isSubOpen
                        ? 'bg-[#094771] text-white'
                        : 'hover:bg-[#094771] hover:text-white cursor-pointer'
                      : isSubOpen
                      ? 'bg-[#e8f0fe] text-blue-900'
                      : 'hover:bg-[#e8f0fe] hover:text-blue-900 cursor-pointer'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {hasChildren ? (
                    <ChevronRight className="w-3.5 h-3.5 ml-4 opacity-75 flex-shrink-0" />
                  ) : (
                    item.shortcut && (
                      <span
                        className={`text-[10px] font-mono ml-5 whitespace-nowrap flex-shrink-0 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        {item.shortcut}
                      </span>
                    )
                  )}
                </button>

                {/* Flyout Submenu (e.g. File -> New, File -> Open Drive, View -> Shortcuts) */}
                {hasChildren && isSubOpen && item.children && (
                  <div
                    className={`absolute left-full top-0 ml-0.5 min-w-[235px] rounded-lg shadow-2xl py-1.5 z-50 select-text border backdrop-blur-md ${
                      isDark
                        ? 'bg-[#252526] border-[#454545] text-slate-200'
                        : 'bg-white border-[#d4d4d4] text-slate-800'
                    }`}
                  >
                    {item.children.map((child, cIdx) => (
                      <React.Fragment key={`${subKey}:${cIdx}`}>
                        <button
                          type="button"
                          disabled={child.disabled}
                          onClick={() => {
                            if (child.disabled) return;
                            setActiveMenu(null);
                            setOpenSubmenuKey(null);
                            child.action?.();
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition ${
                            child.disabled
                              ? 'opacity-40 cursor-not-allowed'
                              : isDark
                              ? 'hover:bg-[#094771] hover:text-white cursor-pointer'
                              : 'hover:bg-[#e8f0fe] hover:text-blue-900 cursor-pointer'
                          }`}
                        >
                          <span className="truncate">{child.label}</span>
                          {child.shortcut && (
                            <span
                              className={`text-[10px] font-mono ml-5 whitespace-nowrap flex-shrink-0 ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}
                            >
                              {child.shortcut}
                            </span>
                          )}
                        </button>
                        {child.divider && (
                          <div
                            className={`my-1 border-t ${
                              isDark ? 'border-[#3c3c3c]' : 'border-[#e5e5e5]'
                            }`}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
              {item.divider && (
                <div
                  className={`my-1 border-t ${
                    isDark ? 'border-[#3c3c3c]' : 'border-[#e5e5e5]'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#1e1e1e] text-slate-200' : 'bg-white text-slate-800'} overflow-hidden select-text font-sans`}>
      {/* 1. VS CODE TITLE BAR & MENUBAR */}
      <div
        ref={menubarRef}
          className={`flex items-center justify-between px-3 py-1 text-xs border-b select-text ${
            isDark ? 'bg-[#323233] text-slate-200 border-[#252526]' : 'bg-[#f3f3f3] text-slate-800 border-[#e5e5e5]'
          }`}
        >
          {/* Left Menus */}
          <div className="flex items-center gap-1.5">
            {/* Top-left Blue Symbol </> Application Menu */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu((prev) => (prev === 'App' ? null : 'App'))}
                onMouseEnter={() => {
                  if (activeMenu && activeMenu !== 'App') setActiveMenu('App');
                }}
                className={`p-1.5 rounded transition flex items-center justify-center ${
                  activeMenu === 'App'
                    ? isDark
                      ? 'bg-[#3c3c3c]'
                      : 'bg-slate-300'
                    : isDark
                    ? 'hover:bg-[#3c3c3c]'
                    : 'hover:bg-slate-200'
                }`}
                title="Gawkyy IDE Application Menu"
              >
                <Code2 className="w-4 h-4 text-blue-400" />
              </button>
              {activeMenu === 'App' && renderMenuDropdown('App')}
            </div>

            <div className="flex items-center gap-0.5 font-medium text-[11px]">
              {(['File', 'Edit', 'Selection', 'Bridge', 'View', 'Go', 'Run', 'Terminal', 'Tools', 'Help'] as MenuKey[]).map((mKey) => (
                <div key={mKey} className="relative">
                  <button
                    onClick={() => setActiveMenu((prev) => (prev === mKey ? null : mKey))}
                    onMouseEnter={() => {
                      if (activeMenu && activeMenu !== mKey) setActiveMenu(mKey);
                    }}
                    className={`px-2 py-0.5 rounded transition ${
                      activeMenu === mKey
                        ? isDark
                          ? 'bg-[#3c3c3c] text-white'
                          : 'bg-slate-300 text-slate-900 font-semibold'
                        : isDark
                        ? 'hover:bg-[#3c3c3c] text-slate-200'
                        : 'hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    {mKey}
                  </button>
                  {activeMenu === mKey && renderMenuDropdown(mKey)}
                </div>
              ))}
            </div>
          </div>

          {/* Center Command Palette Quick Search Box */}
          <div
            onClick={() => setShowCommandPalette(true)}
            className={`flex items-center justify-between w-80 max-w-sm px-3 py-1 rounded text-[11px] cursor-pointer shadow-inner border transition ${
              isDark
                ? 'bg-[#1e1e1e] hover:bg-[#2a2d2e] border-[#3c3c3c] text-slate-400'
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-600'
            }`}
            title="Open Command Palette (Ctrl+Shift+P)"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">gaw-workspace &gt; {activeTab?.title || 'search...'}</span>
            </div>
            <kbd
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                isDark
                  ? 'bg-[#2d2d2d] border-[#3e3e3e] text-slate-300'
                  : 'bg-slate-100 border-slate-300 text-slate-600'
              }`}
            >
              Ctrl+Shift+P
            </kbd>
          </div>

          {/* Right Layout Controls */}
          <div className="flex items-center gap-1.5">
            {onToggleMode && (
              <div
                className={`flex items-center rounded border p-0.5 text-xs font-semibold ${
                  isDark ? 'bg-[#1e1e1e] border-[#3c3c3c]' : 'bg-slate-200 border-slate-300'
                }`}
                title="Switch between IDE Mode and App Mode (Ctrl+Shift+F)"
              >
                <button
                  type="button"
                  onClick={() => onToggleMode('ide')}
                  className={`px-2 py-0.5 rounded transition text-[11px] font-bold cursor-pointer ${
                    mode === 'ide'
                      ? isDark
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-600 text-white shadow-xs'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="IDE Mode (Ctrl+Shift+F)"
                >
                  IDE Mode
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchToAppMode()}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded transition text-[11px] font-bold cursor-pointer ${
                    mode === 'app'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDark
                      ? 'text-emerald-300 hover:text-white hover:bg-emerald-700/60'
                      : 'text-emerald-700 hover:text-slate-900 hover:bg-emerald-100'
                  }`}
                  title="Auto-save dirty tabs and switch to App Mode (Ctrl+Shift+F)"
                >
                  <span>App Mode</span>
                  <kbd className="opacity-80 text-[9px] px-1 bg-black/25 rounded border border-white/15 font-mono">
                    Ctrl+Shift+F
                  </kbd>
                </button>
              </div>
            )}

            {onOpenAI && (
              <button
                type="button"
                onClick={onOpenAI}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  isDark
                    ? 'hover:bg-[#3c3c3c] text-sky-300'
                    : 'hover:bg-slate-200 text-blue-700'
                }`}
                title="Open AI Specification Generator"
              >
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span>AI Spec</span>
              </button>
            )}

            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className={`p-1.5 rounded transition cursor-pointer ${
                  isDark ? 'text-sky-300 hover:bg-[#3c3c3c]' : 'text-slate-700 hover:bg-slate-200'
                }`}
                title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleFormatDocument}
              disabled={isFormatting}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                isDark
                  ? 'hover:bg-[#3c3c3c] text-sky-300'
                  : 'hover:bg-slate-200 text-blue-700'
              }`}
              title="Format Document with Prettier (Shift+Alt+F)"
            >
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>Prettier</span>
            </button>

            <button
              onClick={() => setIsPrimarySidebarOpen(!isPrimarySidebarOpen)}
              className={`p-1.5 rounded transition cursor-pointer ${
                isDark ? 'hover:bg-[#3c3c3c] text-slate-300' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Toggle Primary Side Bar (Ctrl+B)"
            >
              <Files className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      {/* 2. HORIZONTAL BODY (Activity Bar + Primary Side Bar + Monaco Canvas) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* MONACO IDE ACTIVITY BAR (Vertical Strip, 48px) */}
        <div
          className={`w-12 border-r flex flex-col items-center justify-between py-2 select-text z-10 ${
            isDark ? 'bg-[#333333] border-[#252526]' : 'bg-[#f8f8f8] border-[#e5e5e5]'
          }`}
        >
          <div className="flex flex-col items-center gap-3 w-full">
            {[
              { id: 'explorer', icon: Files, title: 'Explorer (Ctrl+Shift+E)' },
              { id: 'search', icon: Search, title: 'Search in Files' },
              { id: 'extensions', icon: Puzzle, title: 'Extensions: Prettier, Themes, SQLite (Ctrl+Shift+X)' },
            ].map(({ id, icon: Icon, title }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveActivity(id as ActivityBarTab);
                  setIsPrimarySidebarOpen(true);
                }}
                className={`p-2.5 rounded transition ${
                  activeActivity === id && isPrimarySidebarOpen
                    ? isDark
                      ? 'border-l-2 border-white text-white bg-[#252526]'
                      : 'border-l-2 border-blue-600 text-blue-600 bg-white shadow-xs'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title={title}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => {
                setActiveActivity('settings');
                setIsPrimarySidebarOpen(true);
              }}
              className={`p-2 rounded transition ${
                activeActivity === 'settings'
                  ? isDark
                    ? 'text-white bg-[#252526]'
                    : 'text-blue-600 bg-white shadow-xs'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Settings & Keybindings (Ctrl+,)"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRIMARY SIDE BAR (Explorer, Search, Extensions, Settings) */}
        {isPrimarySidebarOpen && (
          <div
            ref={sidebarContainerRef}
            style={{ width: `${sidebarWidth}px` }}
            className={`relative border-r flex flex-col text-xs select-text overflow-hidden flex-shrink-0 ${
              isDark ? 'bg-[#252526] border-[#1e1e1e] text-slate-300' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Header of Primary Sidebar */}
            <div
              className={`flex items-center justify-between px-4 py-2.5 tracking-wide text-[11px] font-bold border-b ${
                isDark ? 'text-slate-300 border-[#333333]' : 'text-slate-950 border-slate-200 bg-slate-100/90'
              }`}
            >
              <span>
                {activeActivity === 'explorer' && 'Explorer: Workspace'}
                {activeActivity === 'search' && 'Search in Files'}
                {activeActivity === 'extensions' && 'Extensions'}
                {activeActivity === 'settings' && 'Settings & Shortcuts'}
              </span>
              <button
                onClick={() => setIsPrimarySidebarOpen(false)}
                className={`p-0.5 rounded transition ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-black hover:bg-slate-200/80'
                }`}
                title="Close Side Bar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Content for Activity */}
            <div
              ref={sidebarContentRef}
              onScroll={handleSidebarScroll}
              className="flex-1 overflow-y-auto p-2 space-y-3"
            >
              {/* TAB A: EXPLORER */}
              {activeActivity === 'explorer' && (
                <div className="space-y-2 text-xs">
                  {/* Folder: COMPONENTS */}
                  <div>
                    <div
                      onClick={() => toggleFolder('plugins')}
                      className={`flex items-center justify-between px-2 py-1 font-bold cursor-pointer rounded transition group ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-extrabold hover:text-black hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {expandedFolders.plugins ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <Folder className="w-3.5 h-3.5 text-blue-500" />
                        <span>components ({allPlugins.length})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {onOpenAddPluginModal && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAddPluginModal();
                            }}
                            className={`p-0.5 rounded transition cursor-pointer ${
                              isDark ? 'hover:bg-slate-700 text-sky-400 hover:text-white' : 'hover:bg-slate-200 text-blue-600 hover:text-black'
                            }`}
                            title="Import Component Wizard (Local File, Folder, or Clockie H2 Drives)"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNewPlugin();
                          }}
                          className={`p-0.5 rounded transition cursor-pointer ${
                            isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-black'
                          }`}
                          title="Add New Component (.tsx)"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {expandedFolders.plugins && (
                      <div className="pl-4 space-y-1.5 mt-0.5">
                        {/* Subfolder: System Components */}
                        <div>
                          <div
                            onClick={() => toggleFolder('pluginsSystem')}
                            className={`flex items-center justify-between px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                              isDark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-500 hover:text-sky-600'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {expandedFolders.pluginsSystem ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              <Folder className={`w-3 h-3 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                              <span>System ({systemPlugins.length})</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddNewPlugin();
                              }}
                              className={`p-0.5 rounded transition ${
                                isDark ? 'hover:bg-slate-700 text-sky-400 hover:text-white' : 'hover:bg-slate-200 text-sky-600 hover:text-black'
                              }`}
                              title="Add New System Component (.tsx)"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          {expandedFolders.pluginsSystem && (
                            <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-sky-500/20">
                              {systemPlugins.map((p) => (
                                <div
                                  key={p.id}
                                  onClick={() => openAndTogglePlugin(p.id, p.name)}
                                  title={`Open "${p.name}" in Interactive UI View (Ctrl+Shift+K for Code)`}
                                  className={`group flex items-center justify-between gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${getItemClass(
                                    'plugin',
                                    p.id,
                                    p.name,
                                    'text-sky-300',
                                    'text-sky-600'
                                  )}`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <Play className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                                    <span className="truncate">{p.name}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openOrActivateItem({ type: 'plugin', id: p.id, name: p.name });
                                      setToggledTabIds((prev) => ({ ...prev, [`tab_plugin_${p.id}`]: false }));
                                    }}
                                    className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition flex-shrink-0 cursor-pointer ${
                                      isDark ? 'hover:bg-slate-700 text-slate-300 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-black'
                                    }`}
                                    title="Open TSX Source Code"
                                  >
                                    <Code2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Subfolder: User Components */}
                        <div>
                          <div
                            onClick={() => toggleFolder('pluginsUser')}
                            className={`flex items-center justify-between px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                              isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-500 hover:text-emerald-600'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {expandedFolders.pluginsUser ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              <Folder className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                              <span>User ({userPlugins.length})</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddNewPlugin();
                              }}
                              className={`p-0.5 rounded transition ${
                                isDark ? 'hover:bg-slate-700 text-emerald-400 hover:text-white' : 'hover:bg-emerald-100 text-emerald-600 hover:text-black'
                              }`}
                              title="Add New User Component (.tsx)"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          {expandedFolders.pluginsUser && (
                            <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-emerald-500/20">
                              {userPlugins.length === 0 && (
                                <div className="px-2 py-0.5 text-[10px] text-slate-500 italic">No user components</div>
                              )}
                              {userPlugins.map((p) => (
                                <div
                                  key={p.id}
                                  onClick={() => openOrActivateItem({ type: 'plugin', id: p.id, name: p.name })}
                                  title={`Open "${p.name}.tsx" Code View (Ctrl+Shift+K for Live UI)`}
                                  className={`group flex items-center justify-between gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${getItemClass(
                                    'plugin',
                                    p.id,
                                    p.name,
                                    'text-emerald-300',
                                    'text-emerald-600'
                                  )}`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                                    <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                                    <span className="truncate">{p.name}.tsx</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openAndTogglePlugin(p.id, p.name);
                                    }}
                                    className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition flex-shrink-0 cursor-pointer ${
                                      isDark ? 'hover:bg-emerald-800 text-emerald-300 hover:text-white' : 'hover:bg-emerald-100 text-emerald-700 hover:text-black'
                                    }`}
                                    title="Run / Open Live UI View (Ctrl+Shift+K)"
                                  >
                                    <Play className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Folder: TABLES */}
                  <div>
                    <div
                      onClick={() => toggleFolder('tables')}
                      className={`flex items-center justify-between px-2 py-1 font-bold cursor-pointer rounded transition group ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-extrabold hover:text-black hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {expandedFolders.tables ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <Folder className="w-3.5 h-3.5 text-amber-500" />
                        <span>tables ({allTables.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddNewTable();
                        }}
                        className={`p-0.5 rounded transition ${
                          isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-black'
                        }`}
                        title="Add New Table (Creates pro-forma CREATE TABLE query)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {expandedFolders.tables && (
                      <div className="pl-4 space-y-1.5 mt-0.5">
                        {/* Subfolder: User Tables */}
                        <div>
                          <div
                            onClick={() => toggleFolder('tablesUser')}
                            className={`flex items-center justify-between px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                              isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-500 hover:text-emerald-600'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {expandedFolders.tablesUser ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              <Folder className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                              <span>User ({userTables.length})</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddNewTable();
                              }}
                              className={`p-0.5 rounded transition ${
                                isDark ? 'hover:bg-slate-700 text-emerald-400 hover:text-white' : 'hover:bg-emerald-100 text-emerald-600 hover:text-black'
                              }`}
                              title="Add New Table (Creates pro-forma CREATE TABLE query)"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          {expandedFolders.tablesUser && (
                            <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-emerald-500/20">
                              {userTables.length === 0 && (
                                <div className="px-2 py-0.5 text-[10px] text-slate-500 italic">No user tables</div>
                              )}
                               {userTables.map((t) => {
                                const isExpanded = !!expandedFolders[`table_${t.name}`];
                                const cols = getTableColumns(t);
                                return (
                                  <div key={t.name} className="space-y-0.5">
                                    <div
                                      className={`flex items-center justify-between gap-1 px-1.5 py-1 rounded cursor-pointer transition select-text group ${getItemClass(
                                        'table',
                                        undefined,
                                        t.name,
                                        'text-emerald-300',
                                        'text-emerald-600'
                                      )}`}
                                      title={`Table: ${t.name} (Click name to view DDL, click arrow to view columns)`}
                                    >
                                      <div
                                        className="flex items-center gap-1 min-w-0 flex-1 truncate"
                                        onClick={() => openOrActivateItem({ type: 'table', name: t.name })}
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFolder(`table_${t.name}`);
                                          }}
                                          className={`p-0.5 -ml-0.5 rounded transition hover:bg-black/20 flex-shrink-0 ${
                                            isDark ? 'text-emerald-400 hover:text-white' : 'text-emerald-600 hover:text-black'
                                          }`}
                                          title={isExpanded ? `Collapse ${t.name} columns` : `Expand ${t.name} columns`}
                                        >
                                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        </button>
                                        <TableIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                                        <span className="truncate">{t.name}</span>
                                      </div>
                                      <span
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFolder(`table_${t.name}`);
                                        }}
                                        className={`text-[10px] font-mono px-1 rounded opacity-75 hover:opacity-100 flex-shrink-0 ${
                                          isDark ? 'text-emerald-400/80 hover:bg-slate-700/50' : 'text-emerald-700/80 hover:bg-emerald-100'
                                        }`}
                                        title={`${cols.length} columns (Click to toggle)`}
                                      >
                                        {cols.length} cols
                                      </span>
                                    </div>

                                    {/* Expanded Field Names and Types */}
                                    {isExpanded && (
                                      <div className="pl-3.5 space-y-0.5 mt-0.5 border-l ml-3 border-emerald-500/20">
                                        {cols.length === 0 ? (
                                          <div className="px-2 py-0.5 text-[10px] text-slate-500 italic">No columns found</div>
                                        ) : (
                                          cols.map((col) => (
                                            <div
                                              key={col.name}
                                              className={`flex items-center justify-between gap-1.5 px-2 py-0.5 rounded text-[11px] select-text transition ${
                                                isDark
                                                  ? 'hover:bg-slate-800/60 text-slate-300'
                                                  : 'hover:bg-emerald-50/70 text-slate-700'
                                              }`}
                                              title={`Field: ${col.name}\nType: ${col.type || 'TEXT'}${col.pk ? ' (Primary Key)' : ''}${col.notnull ? ' (NOT NULL)' : ''}`}
                                            >
                                              <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                {col.pk ? (
                                                  <span
                                                    className="text-[9px] font-bold font-mono px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0"
                                                    title="Primary Key"
                                                  >
                                                    PK
                                                  </span>
                                                ) : (
                                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`} />
                                                )}
                                                <span className={`truncate font-mono text-[11px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                                  {col.name}
                                                </span>
                                              </div>
                                              <span className={`text-[10px] font-mono flex-shrink-0 uppercase ${
                                                isDark ? 'text-slate-400' : 'text-slate-500'
                                              }`}>
                                                {col.type || 'TEXT'}
                                              </span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Subfolder: System Tables */}
                        {systemTables.length > 0 && (
                          <div>
                            <div
                              onClick={() => toggleFolder('tablesSystem')}
                              className={`flex items-center justify-between px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                                isDark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-500 hover:text-sky-600'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {expandedFolders.tablesSystem ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <Folder className={`w-3 h-3 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                                <span>System ({systemTables.length})</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddNewTable();
                                }}
                                className={`p-0.5 rounded transition ${
                                  isDark ? 'hover:bg-slate-700 text-sky-400 hover:text-white' : 'hover:bg-slate-200 text-sky-600 hover:text-black'
                                }`}
                                title="Add New System Table (Creates pro-forma CREATE TABLE query)"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            {expandedFolders.tablesSystem && (
                              <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-sky-500/20">
                                {systemTables.map((t) => {
                                  const isExpanded = !!expandedFolders[`table_${t.name}`];
                                  const cols = getTableColumns(t);
                                  return (
                                    <div key={t.name} className="space-y-0.5">
                                      <div
                                        className={`flex items-center justify-between gap-1 px-1.5 py-1 rounded cursor-pointer transition select-text group ${getItemClass(
                                          'table',
                                          undefined,
                                          t.name,
                                          'text-sky-300',
                                          'text-sky-600'
                                        )}`}
                                        title={`System Table: ${t.name} (Click name to view DDL, click arrow to view columns)`}
                                      >
                                        <div
                                          className="flex items-center gap-1 min-w-0 flex-1 truncate"
                                          onClick={() => openOrActivateItem({ type: 'table', name: t.name })}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFolder(`table_${t.name}`);
                                            }}
                                            className={`p-0.5 -ml-0.5 rounded transition hover:bg-black/20 flex-shrink-0 ${
                                              isDark ? 'text-sky-400 hover:text-white' : 'text-sky-600 hover:text-black'
                                            }`}
                                            title={isExpanded ? `Collapse ${t.name} columns` : `Expand ${t.name} columns`}
                                          >
                                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                          </button>
                                          <TableIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                                          <span className="truncate">{t.name}</span>
                                        </div>
                                        <span
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFolder(`table_${t.name}`);
                                          }}
                                          className={`text-[10px] font-mono px-1 rounded opacity-75 hover:opacity-100 flex-shrink-0 ${
                                            isDark ? 'text-sky-400/80 hover:bg-slate-700/50' : 'text-sky-700/80 hover:bg-sky-100'
                                          }`}
                                          title={`${cols.length} columns (Click to toggle)`}
                                        >
                                          {cols.length} cols
                                        </span>
                                      </div>

                                      {/* Expanded Field Names and Types */}
                                      {isExpanded && (
                                        <div className="pl-3.5 space-y-0.5 mt-0.5 border-l ml-3 border-sky-500/20">
                                          {cols.length === 0 ? (
                                            <div className="px-2 py-0.5 text-[10px] text-slate-500 italic">No columns found</div>
                                          ) : (
                                            cols.map((col) => (
                                              <div
                                                key={col.name}
                                                className={`flex items-center justify-between gap-1.5 px-2 py-0.5 rounded text-[11px] select-text transition ${
                                                  isDark
                                                    ? 'hover:bg-slate-800/60 text-slate-300'
                                                    : 'hover:bg-sky-50/70 text-slate-700'
                                                }`}
                                                title={`Field: ${col.name}\nType: ${col.type || 'TEXT'}${col.pk ? ' (Primary Key)' : ''}${col.notnull ? ' (NOT NULL)' : ''}`}
                                              >
                                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                  {col.pk ? (
                                                    <span
                                                      className="text-[9px] font-bold font-mono px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0"
                                                      title="Primary Key"
                                                    >
                                                      PK
                                                    </span>
                                                  ) : (
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`} />
                                                  )}
                                                  <span className={`truncate font-mono text-[11px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                                    {col.name}
                                                  </span>
                                                </div>
                                                <span className={`text-[10px] font-mono flex-shrink-0 uppercase ${
                                                  isDark ? 'text-slate-400' : 'text-slate-500'
                                                }`}>
                                                  {col.type || 'TEXT'}
                                                </span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Folder: VIEWS */}
                  <div>
                    <div
                      onClick={() => toggleFolder('views')}
                      className={`flex items-center justify-between px-2 py-1 font-bold cursor-pointer rounded transition group ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-extrabold hover:text-black hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {expandedFolders.views ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <Folder className="w-3.5 h-3.5 text-emerald-500" />
                        <span>views ({allViews.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddNewView();
                        }}
                        className={`p-0.5 rounded transition ${
                          isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-black'
                        }`}
                        title="Add New View (Creates pro-forma CREATE VIEW query)"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {expandedFolders.views && (
                      <div className="pl-4 space-y-1.5 mt-0.5">
                        {/* Subfolder: User Views */}
                        <div>
                          <div
                            onClick={() => toggleFolder('viewsUser')}
                            className={`flex items-center justify-between px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                              isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-500 hover:text-emerald-600'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {expandedFolders.viewsUser ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              <Folder className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                              <span>User ({userViews.length})</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddNewView();
                              }}
                              className={`p-0.5 rounded transition ${
                                isDark ? 'hover:bg-slate-700 text-emerald-400 hover:text-white' : 'hover:bg-emerald-100 text-emerald-600 hover:text-black'
                              }`}
                              title="Add New View (Creates pro-forma CREATE VIEW query)"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          {expandedFolders.viewsUser && (
                            <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-emerald-500/20">
                              {userViews.length === 0 && (
                                <div className="px-2 py-0.5 text-[10px] text-slate-500 italic">No user views</div>
                              )}
                              {userViews.map((v) => {
                                const isExpanded = !!expandedFolders[`view_${v.name}`];
                                const cols = getTableColumns(v);
                                return (
                                  <div key={v.name} className="space-y-0.5">
                                    <div
                                      className={`flex items-center justify-between gap-1 px-1.5 py-1 rounded cursor-pointer transition select-text group ${getItemClass(
                                        'table',
                                        undefined,
                                        v.name,
                                        'text-emerald-300',
                                        'text-emerald-600'
                                      )}`}
                                      title={`View: ${v.name} (Click name to view DDL, click arrow to view columns)`}
                                    >
                                      <div
                                        className="flex items-center gap-1 min-w-0 flex-1 truncate"
                                        onClick={() => openOrActivateItem({ type: 'table', name: v.name })}
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFolder(`view_${v.name}`);
                                          }}
                                          className={`p-0.5 -ml-0.5 rounded transition hover:bg-black/20 flex-shrink-0 ${
                                            isDark ? 'text-emerald-400 hover:text-white' : 'text-emerald-600 hover:text-black'
                                          }`}
                                          title={isExpanded ? `Collapse ${v.name} columns` : `Expand ${v.name} columns`}
                                        >
                                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        </button>
                                        <Eye className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                                        <span className="truncate">{v.name}</span>
                                      </div>
                                      <span
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFolder(`view_${v.name}`);
                                        }}
                                        className={`text-[10px] font-mono px-1 rounded opacity-75 hover:opacity-100 flex-shrink-0 ${
                                          isDark ? 'text-emerald-400/80 hover:bg-slate-700/50' : 'text-emerald-700/80 hover:bg-emerald-100'
                                        }`}
                                        title={`${cols.length} columns (Click to toggle)`}
                                      >
                                        {cols.length} cols
                                      </span>
                                    </div>

                                    {/* Expanded Field Names and Types */}
                                    {isExpanded && (
                                      <div className="pl-3.5 space-y-0.5 mt-0.5 border-l ml-3 border-emerald-500/20">
                                        {cols.length === 0 ? (
                                          <div className="px-2 py-0.5 text-[10px] text-slate-500 italic">No columns found</div>
                                        ) : (
                                          cols.map((col) => (
                                            <div
                                              key={col.name}
                                              className={`flex items-center justify-between gap-1.5 px-2 py-0.5 rounded text-[11px] select-text transition ${
                                                isDark
                                                  ? 'hover:bg-slate-800/60 text-slate-300'
                                                  : 'hover:bg-emerald-50/70 text-slate-700'
                                              }`}
                                              title={`Field: ${col.name}\nType: ${col.type || 'TEXT'}`}
                                            >
                                              <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`} />
                                                <span className={`truncate font-mono text-[11px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                                  {col.name}
                                                </span>
                                              </div>
                                              <span className={`text-[10px] font-mono flex-shrink-0 uppercase ${
                                                isDark ? 'text-slate-400' : 'text-slate-500'
                                              }`}>
                                                {col.type || 'TEXT'}
                                              </span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Subfolder: System Views */}
                        {systemViews.length > 0 && (
                          <div>
                            <div
                              onClick={() => toggleFolder('viewsSystem')}
                              className={`flex items-center justify-between px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                                isDark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-500 hover:text-sky-600'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {expandedFolders.viewsSystem ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <Folder className={`w-3 h-3 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                                <span>System ({systemViews.length})</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddNewView();
                                }}
                                className={`p-0.5 rounded transition ${
                                  isDark ? 'hover:bg-slate-700 text-sky-400 hover:text-white' : 'hover:bg-slate-200 text-sky-600 hover:text-black'
                                }`}
                                title="Add New System View (Creates pro-forma CREATE VIEW query)"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            {expandedFolders.viewsSystem && (
                              <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-sky-500/20">
                                {systemViews.map((v) => {
                                  const isExpanded = !!expandedFolders[`view_${v.name}`];
                                  const cols = getTableColumns(v);
                                  return (
                                    <div key={v.name} className="space-y-0.5">
                                      <div
                                        className={`flex items-center justify-between gap-1 px-1.5 py-1 rounded cursor-pointer transition select-text group ${getItemClass(
                                          'table',
                                          undefined,
                                          v.name,
                                          'text-sky-300',
                                          'text-sky-600'
                                        )}`}
                                        title={`System View: ${v.name} (Click name to view DDL, click arrow to view columns)`}
                                      >
                                        <div
                                          className="flex items-center gap-1 min-w-0 flex-1 truncate"
                                          onClick={() => openOrActivateItem({ type: 'table', name: v.name })}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFolder(`view_${v.name}`);
                                            }}
                                            className={`p-0.5 -ml-0.5 rounded transition hover:bg-black/20 flex-shrink-0 ${
                                              isDark ? 'text-sky-400 hover:text-white' : 'text-sky-600 hover:text-black'
                                            }`}
                                            title={isExpanded ? `Collapse ${v.name} columns` : `Expand ${v.name} columns`}
                                          >
                                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                          </button>
                                          <Eye className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                                          <span className="truncate">{v.name}</span>
                                        </div>
                                        <span
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFolder(`view_${v.name}`);
                                          }}
                                          className={`text-[10px] font-mono px-1 rounded opacity-75 hover:opacity-100 flex-shrink-0 ${
                                            isDark ? 'text-sky-400/80 hover:bg-slate-700/50' : 'text-sky-700/80 hover:bg-sky-100'
                                          }`}
                                          title={`${cols.length} columns (Click to toggle)`}
                                        >
                                          {cols.length} cols
                                        </span>
                                      </div>

                                      {/* Expanded Field Names and Types */}
                                      {isExpanded && (
                                        <div className="pl-3.5 space-y-0.5 mt-0.5 border-l ml-3 border-sky-500/20">
                                          {cols.length === 0 ? (
                                            <div className="px-2 py-0.5 text-[10px] text-slate-500 italic">No columns found</div>
                                          ) : (
                                            cols.map((col) => (
                                              <div
                                                key={col.name}
                                                className={`flex items-center justify-between gap-1.5 px-2 py-0.5 rounded text-[11px] select-text transition ${
                                                  isDark
                                                    ? 'hover:bg-slate-800/60 text-slate-300'
                                                    : 'hover:bg-sky-50/70 text-slate-700'
                                                }`}
                                                title={`Field: ${col.name}\nType: ${col.type || 'TEXT'}`}
                                              >
                                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`} />
                                                  <span className={`truncate font-mono text-[11px] font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                                    {col.name}
                                                  </span>
                                                </div>
                                                <span className={`text-[10px] font-mono flex-shrink-0 uppercase ${
                                                  isDark ? 'text-slate-400' : 'text-slate-500'
                                                }`}>
                                                  {col.type || 'TEXT'}
                                                </span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Folder: QUERIES */}
                  <div>
                    <div
                      onClick={() => toggleFolder('queries')}
                      className={`flex items-center justify-between px-2 py-1 font-bold cursor-pointer rounded transition group ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-extrabold hover:text-black hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {expandedFolders.queries ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <Folder className="w-3.5 h-3.5 text-cyan-500" />
                        <span>queries ({allQueries.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddNewQuery();
                        }}
                        className={`p-0.5 rounded transition ${
                          isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-black'
                        }`}
                        title="Add New Query"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {expandedFolders.queries && (
                      <div className="pl-6 space-y-0.5 mt-0.5">
                        {allQueries.map((q) => (
                          <div
                            key={q.id}
                            onClick={() => openOrActivateItem({ type: 'query', id: q.id, name: q.name })}
                            className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer transition select-text ${getItemClass(
                              'query',
                              q.id,
                              q.name,
                              'text-cyan-300',
                              'text-cyan-700'
                            )}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <Database className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
                              <span className="truncate">{q.name.replace(/\.sql$/i, '')}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSaveAs({ type: 'query', id: q.id, name: q.name, code: q.query });
                              }}
                              className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition flex-shrink-0 ${
                                isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-600 hover:text-black'
                              }`}
                              title="Save As..."
                            >
                              <SaveAsIcon className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Folder: REPORTS */}
                  <div>
                    <div
                      onClick={() => toggleFolder('reports')}
                      className={`flex items-center justify-between px-2 py-1 font-bold cursor-pointer rounded transition group ${
                        isDark ? 'text-emerald-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-emerald-600 font-extrabold hover:text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {expandedFolders.reports ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <Folder className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                        <span>reports ({allReports.length})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {onNewReportVisual && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNewReportVisual();
                            }}
                            className={`p-0.5 rounded transition cursor-pointer ${
                              isDark ? 'hover:bg-slate-700 text-emerald-400 hover:text-white' : 'hover:bg-emerald-100 text-emerald-600 hover:text-black'
                            }`}
                            title="New Visual Report (Report Builder)"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddNewReport();
                          }}
                          className={`p-0.5 rounded transition cursor-pointer ${
                            isDark ? 'hover:bg-slate-700 text-emerald-400 hover:text-white' : 'hover:bg-emerald-100 text-emerald-600 hover:text-black'
                          }`}
                          title="Add New Report (.json)"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {expandedFolders.reports && (
                      <div className={`pl-6 space-y-0.5 mt-0.5 border-l ml-3 ${isDark ? 'border-emerald-500/30' : 'border-emerald-300'}`}>
                        {allReports.map((r) => (
                          <div
                            key={r.id}
                            onClick={() => openOrActivateItem({ type: 'report', id: r.id, name: r.name })}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${getItemClass(
                              'report',
                              r.id,
                              r.name,
                              'text-emerald-300',
                              'text-emerald-600'
                            )}`}
                          >
                            <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                            <span className="truncate">{r.name}.json</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Root Files */}
                  <div className={`pt-2 border-t space-y-0.5 ${isDark ? 'border-[#333333]' : 'border-slate-200'}`}>
                    <div
                      onClick={() => openOrActivateItem({ type: 'types' })}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${getItemClass(
                        'types',
                        undefined,
                        'gaw.d.ts',
                        'text-slate-300',
                        'text-slate-900'
                      )}`}
                    >
                      <FileCode className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span>types/gaw.d.ts</span>
                    </div>
                    <div
                      onClick={() => openOrActivateItem({ type: 'json', name: 'package.json' })}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${getItemClass(
                        'json',
                        undefined,
                        'package.json',
                        'text-slate-300',
                        'text-slate-900'
                      )}`}
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      <span>package.json</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB B: SEARCH */}
              {activeActivity === 'search' && (
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search across files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className={`w-full px-2.5 py-1.5 rounded text-xs focus:outline-none border ${
                        isDark ? 'bg-[#3c3c3c] border-[#555] text-slate-100 placeholder:text-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 shadow-2xs'
                      }`}
                    />
                  </div>
                  <div className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-950 font-bold'}`}>
                    {searchQuery ? `${searchResults.length} matches found` : 'Type a query to search codebase'}
                  </div>
                  <div className="space-y-1">
                    {searchResults.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => openOrActivateItem(res.tabItem)}
                        className={`p-2 rounded border cursor-pointer text-xs space-y-0.5 transition ${
                          isDark ? 'bg-[#1e1e1e] hover:bg-[#2a2d2e] border-[#333]' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-950 shadow-2xs'
                        }`}
                      >
                        <div className="font-bold text-blue-500 flex items-center justify-between">
                          <span>{res.file}</span>
                          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-700 font-bold'}`}>Ln {res.line}</span>
                        </div>
                        <p className={`font-mono text-[11px] truncate ${isDark ? 'text-slate-300' : 'text-slate-950 font-medium'}`}>{res.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB C: EXTENSIONS */}
              {activeActivity === 'extensions' && (
                <div className="space-y-3">
                  {/* Prettier Extension */}
                  <div className={`p-3 rounded-xl space-y-2 border ${
                    isDark ? 'bg-[#1e1e1e] border-indigo-700/60' : 'bg-white border-indigo-200 shadow-2xs'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`flex items-center gap-1.5 font-bold ${isDark ? 'text-white' : 'text-slate-950'}`}>
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Prettier Formatter</span>
                        </div>
                        <p className={`text-[10px] font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-700 font-bold'}`}>v3.4.2 Installed & Active</p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                        isDark ? 'bg-indigo-950 border-indigo-700/50 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                      }`}>
                        Default
                      </span>
                    </div>
                    <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                      Standard opinionated code formatter for TypeScript, TSX, SQL, and JSON.
                    </p>
                    <div className={`pt-2 border-t flex flex-col gap-2 ${isDark ? 'border-[#333]' : 'border-slate-200'}`}>
                      <label className={`flex items-center gap-2 text-[11px] cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-950 font-semibold'}`}>
                        <input
                          type="checkbox"
                          checked={formatOnSave}
                          onChange={(e) => {
                            setFormatOnSave(e.target.checked);
                            safeStorage.setItem('gaw_format_on_save', String(e.target.checked));
                          }}
                          className="rounded text-indigo-500 focus:ring-0"
                        />
                        <span>Format On Save</span>
                      </label>
                      <button
                        onClick={handleFormatDocument}
                        disabled={isFormatting}
                        className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 cursor-pointer"
                      >
                        Format Document (Shift+Alt+F)
                      </button>
                    </div>
                  </div>

                  {/* ESLint Extension */}
                  <div className={`p-3 rounded-xl space-y-1.5 border ${
                    isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-slate-200 shadow-2xs'
                  }`}>
                    <div className={`font-bold flex items-center justify-between ${isDark ? 'text-white' : 'text-slate-950'}`}>
                      <span>ESLint & TS Diagnostics</span>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-700 font-bold'}`}>Active</span>
                    </div>
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>
                      Real-time syntax validator and React TSX compiler lint checks.
                    </p>
                  </div>

                  {/* SQLite Tools Extension */}
                  <div className={`p-3 rounded-xl space-y-1.5 border ${
                    isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-slate-200 shadow-2xs'
                  }`}>
                    <div className={`font-bold flex items-center justify-between ${isDark ? 'text-white' : 'text-slate-950'}`}>
                      <span>SQLite WASM Inspector</span>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-indigo-400' : 'text-indigo-700 font-bold'}`}>Active</span>
                    </div>
                    <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>
                      Direct engine schema query introspection & performance profiling.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB D: SETTINGS & KEYBINDINGS */}
              {activeActivity === 'settings' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <span className={`font-bold text-[11px] ${isDark ? 'text-white' : 'text-slate-950'}`}>Keyboard Shortcuts (IDE Mode):</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShortcutModalTab('system')}
                        className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition cursor-pointer"
                      >
                        <Keyboard className="w-3.5 h-3.5" />
                        <span>System shortcuts</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShortcutModalTab('custom')}
                        className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-[11px] font-semibold transition cursor-pointer ${
                          isDark
                            ? 'bg-[#1e1e1e] border-blue-500/40 text-blue-300 hover:bg-blue-900/30'
                            : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Custom shortcuts</span>
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        [getMenuShortcut('file.newTab'), 'New Tab'],
                        [getMenuShortcut('file.closeTab'), 'Close Tab'],
                        [getMenuShortcut('file.undoCloseTab'), 'Undo Close Tab'],
                        [getMenuShortcut('file.save'), 'Save Active Tab'],
                        [getMenuShortcut('file.saveAll'), 'Save All Tabs'],
                        [getMenuShortcut('bridge.interactionsLog'), 'Bridge Interactions Log'],
                        [getMenuShortcut('view.refresh'), 'Refresh Workspace'],
                        [getMenuShortcut('ide.toggleMode'), 'Switch to App Mode'],
                      ].map(([keys, desc], idx) => (
                        <div
                          key={idx}
                          className={`p-1.5 rounded border flex items-center justify-between gap-2 text-[10px] ${
                            isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-slate-200 text-slate-950 shadow-2xs'
                          }`}
                        >
                          <span className={isDark ? 'text-slate-400' : 'text-slate-950 font-medium'}>{desc}</span>
                          <kbd className={`px-1.5 py-0.5 rounded font-mono whitespace-nowrap ${
                            isDark ? 'bg-[#2d2d2d] border border-[#444] text-slate-200' : 'bg-slate-100 border border-slate-300 text-slate-950 font-bold'
                          }`}>
                            {keys}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`space-y-2 pt-2 border-t ${isDark ? 'border-[#333]' : 'border-slate-200'}`}>
                    <span className={`font-bold text-[11px] ${isDark ? 'text-white' : 'text-slate-950'}`}>Editor & Theme Preferences:</span>
                    {onToggleTheme && (
                      <div className="flex items-center justify-between">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-950 font-semibold'}>Color Theme:</span>
                        <button
                          onClick={onToggleTheme}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition cursor-pointer ${
                            isDark
                              ? 'bg-[#1e1e1e] border-[#444] text-amber-300 hover:bg-[#2a2d2e]'
                              : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-100 font-semibold'
                          }`}
                        >
                          {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
                          <span>{isDark ? 'Dark Theme' : 'Light Theme'}</span>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-950 font-semibold'}>Font Size:</span>
                      <select
                        value={editorFontSize}
                        onChange={(e) => setEditorFontSize(Number(e.target.value))}
                        className={`rounded px-2 py-0.5 text-xs border ${
                          isDark ? 'bg-[#1e1e1e] border-[#444] text-white' : 'bg-white border-slate-300 text-slate-950 font-semibold'
                        }`}
                      >
                        <option value={12}>12 px</option>
                        <option value={13}>13 px</option>
                        <option value={14}>14 px</option>
                        <option value={16}>16 px</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={isDark ? 'text-slate-400' : 'text-slate-950 font-semibold'}>Minimap:</span>
                      <input
                        type="checkbox"
                        checked={showMinimap}
                        onChange={(e) => setShowMinimap(e.target.checked)}
                        className="rounded text-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Resize Handle on Right Edge */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingSidebar(true);
              }}
              className={`hidden md:block absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/80 transition-colors z-30 ${
                isResizingSidebar ? 'bg-blue-500 w-2 shadow-lg shadow-blue-500/50' : 'bg-transparent'
              }`}
              title="Drag left or right to adjust sidebar width"
            />
          </div>
        )}
        {isResizingSidebar && (
          <div className="fixed inset-0 z-50 cursor-col-resize pointer-events-auto" />
        )}

        {/* 3. CENTER MONACO EDITOR CANVAS & TABS */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
          {/* VS Code Tab Bar */}
          <div
            className={`flex items-center border-b overflow-x-auto text-xs select-text ${
              isDark ? 'bg-[#252526] border-[#1e1e1e]' : 'bg-[#f3f3f3] border-[#e5e5e5]'
            }`}
          >
              {/* Quick Action Toolbar to the left of the first tab: Save, Run, Delete */}
              <div className={`flex items-center gap-0.5 px-2 py-1 flex-shrink-0 border-r ${
                isDark ? 'border-[#333333]' : 'border-[#d0d0d0]'
              }`}>
                <button
                  type="button"
                  onClick={() => handleSaveActiveTabRef.current?.()}
                  title="Save (Ctrl+S)"
                  className={`p-1.5 rounded transition flex items-center justify-center ${
                    isDark
                      ? 'hover:bg-slate-700 text-slate-300 hover:text-white'
                      : 'hover:bg-slate-200 text-slate-700 hover:text-black'
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenSaveAsRef.current?.()}
                  title="Save As... (Ctrl+Shift+S)"
                  className={`p-1.5 rounded transition flex items-center justify-center ${
                    isDark
                      ? 'hover:bg-slate-700 text-slate-300 hover:text-white'
                      : 'hover:bg-slate-200 text-slate-700 hover:text-black'
                  }`}
                >
                  <SaveAsIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleToggleViewInIDERef.current?.();
                  }}
                  title={
                    (() => {
                      const tableName = (activeTab?.tableName || activeTab?.title || '').replace(/\.sql$/i, '');
                      const schemaObj = engine.getSchema().find((t) => t.name.toLowerCase() === tableName.toLowerCase());
                      if (schemaObj?.type === 'view') return 'Run view (Ctrl+Shift+K)';
                      if (activeTab?.type === 'table') return 'Run table (Ctrl+Shift+K)';
                      return 'Run query (Ctrl+Shift+K)';
                    })()
                  }
                  className="p-1.5 rounded transition flex items-center justify-center text-emerald-500 hover:text-emerald-400 hover:bg-emerald-950/40 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteActiveItemRef.current?.()}
                  title={
                    activeTab?.type === 'table'
                      ? 'Delete table (Loads drop template in editor)'
                      : 'Delete query or object'
                  }
                  className="p-1.5 rounded transition flex items-center justify-center text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleViewInIDERef.current?.()}
                  title="Toggle View (ctrl+shift+K)"
                  className={`p-1.5 rounded transition flex items-center justify-center ${
                    isViewToggled
                      ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-xs'
                      : isDark
                      ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-950/40'
                      : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>

              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const displayTitle = (tab.type === 'table' || tab.type === 'query' || tab.type === 'sql')
                  ? tab.title.replace(/\.sql$/i, '')
                  : tab.title;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`group flex items-center gap-2 px-3 py-2 border-r cursor-pointer transition ${
                      isDark ? 'border-[#1e1e1e]' : 'border-[#e5e5e5]'
                    } ${
                      isActive
                        ? isDark
                          ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500 font-medium'
                          : 'bg-white text-slate-900 border-t-2 border-t-blue-600 font-semibold shadow-xs'
                        : isDark
                        ? 'bg-[#2d2d2d] text-slate-400 hover:bg-[#252526] hover:text-slate-200'
                        : 'bg-[#ececec] text-slate-600 hover:bg-[#e0e0e0] hover:text-slate-900'
                    }`}
                  >
                    {tab.type === 'plugin' ? (
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    ) : tab.type === 'table' ? (
                      <TableIcon className="w-3.5 h-3.5 text-amber-400" />
                    ) : tab.type === 'report' ? (
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Database className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span className="truncate max-w-[140px]">
                      {displayTitle}
                    </span>
                    {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition cursor-pointer"
                      title={`Close tab (${getMenuShortcut('file.closeTab')})`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addSqlTab}
                className={`p-2 transition ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-[#333333]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
                title="New Query Tab"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

          {/* Main Panel Content: Monaco Editor Frame OR Toggled View Panel */}
          {isViewToggled && activeTab ? (
            <div className={`flex-1 flex flex-col overflow-hidden min-h-0 ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
              {activeTab.type === 'plugin' && (
                <div className={`flex-1 flex flex-col overflow-hidden h-full ${
                  isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
                }`}>
                  <div className={`flex items-center justify-between px-4 py-2 border-b text-xs flex-shrink-0 ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                  }`}>
                    <div className="flex items-center gap-2 font-bold">
                      <FileCode className="w-4 h-4 text-emerald-400" />
                      <span>Component Live View: {activeTab.title.replace(/\.tsx$/i, '')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleViewInIDE}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border transition cursor-pointer ${
                        isDark ? 'bg-slate-800 border-slate-700 text-blue-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 border-slate-300 text-blue-700 hover:bg-slate-200'
                      }`}
                      title="Toggle View (ctrl+shift+K)"
                    >
                      Switch to Code (Ctrl+Shift+K)
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-2">
                    <PluginHost
                      code={activeTab.content}
                      pluginName={activeTab.title}
                      pluginId={activeTab.pluginId || activeTab.id}
                      theme={theme}
                      gawContext={gawContext}
                    />
                  </div>
                </div>
              )}

              {activeTab.type === 'table' && (() => {
                const tableName = (activeTab.tableName || activeTab.title).replace(/\.sql$/i, '');
                const schemaObj = engine.getSchema().find((t) => t.name.toLowerCase() === tableName.toLowerCase());
                const isViewInDb = schemaObj?.type === 'view';

                return (
                  <div className={`flex-1 flex flex-col overflow-hidden h-full ${
                    isDark ? 'bg-[#181818] text-slate-100' : 'bg-white text-slate-900'
                  }`}>
                    <div className={`flex items-center justify-between px-4 py-2 border-b text-xs flex-shrink-0 ${
                      isDark ? 'bg-[#252526] border-[#333333] text-white' : 'bg-[#f3f3f3] border-[#e5e5e5] text-slate-800 shadow-2xs'
                    }`}>
                      <div className="flex items-center gap-2 font-bold">
                        <TableIcon className="w-4 h-4 text-amber-400" />
                        <span>{isViewInDb ? 'SQL View Results' : 'Table Data Grid'}: {tableName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleViewInIDE}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700 text-blue-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 border-slate-300 text-blue-700 hover:bg-slate-200'
                        }`}
                        title="Toggle View (ctrl+shift+K)"
                      >
                        Switch to {isViewInDb ? 'View SQL' : 'Table DDL'} (Ctrl+Shift+K)
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 p-3 overflow-y-auto">
                      <QueryGrid
                        result={toggledResultsState[0] || { columns: [], values: [] }}
                        onOpenInSpreadsheet={handleIDEOpenSpreadsheet}
                        title={tableName}
                        theme={theme}
                      />
                    </div>
                  </div>
                );
              })()}

              {(activeTab.type === 'query' || activeTab.type === 'sql') && (() => {
                const queryName = activeTab.title.replace(/\.sql$/i, '');
                const resList = toggledResultsState;

                return (
                  <div className={`flex-1 flex flex-col overflow-hidden h-full ${
                    isDark ? 'bg-[#181818] text-slate-100' : 'bg-white text-slate-900'
                  }`}>
                    <div className={`flex items-center justify-between px-4 py-2 border-b text-xs flex-shrink-0 ${
                      isDark ? 'bg-[#252526] border-[#333333] text-white' : 'bg-[#f3f3f3] border-[#e5e5e5] text-slate-800 shadow-2xs'
                    }`}>
                      <div className="flex items-center gap-2 font-bold">
                        <Database className="w-4 h-4 text-indigo-400" />
                        <span>Query Results: {queryName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleViewInIDE}
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700 text-blue-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 border-slate-300 text-blue-700 hover:bg-slate-200'
                        }`}
                        title="Toggle View (ctrl+shift+K)"
                      >
                        Switch to Query SQL (Ctrl+Shift+K)
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      {resList.length > 1 ? (
                        <MultiQueryResultsView
                          savedQuery={null}
                          results={resList}
                          title={queryName}
                          theme={theme}
                          onOpenInIDE={undefined}
                          onOpenSpreadsheet={(data, sheetName) => handleIDEOpenSpreadsheet(data || { columns: [], values: [] }, sheetName)}
                          onBackToView={handleToggleViewInIDE}
                        />
                      ) : (
                        <div className="h-full flex flex-col p-3 overflow-y-auto min-h-0">
                          <QueryGrid
                            result={resList[0] || { columns: [], values: [] }}
                            onOpenInSpreadsheet={handleIDEOpenSpreadsheet}
                            title={queryName}
                            theme={theme}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {activeTab.type === 'report' && (() => {
                let currentReportObj: SavedReport | null = null;
                if (activeTab.reportId) {
                  currentReportObj = engine.getSavedReports().find((r) => r.id === activeTab.reportId) || null;
                }
                if (!currentReportObj) {
                  try {
                    const parsed = JSON.parse(activeTab.content);
                    currentReportObj = {
                      id: parsed.id || 'report_temp',
                      name: parsed.name || activeTab.title.replace(/\.json$/i, ''),
                      description: parsed.description || '',
                      query_id: parsed.query_id || '',
                      custom_sql: parsed.custom_sql || '',
                      config: typeof parsed.config === 'string' ? parsed.config : JSON.stringify(parsed.config || {}),
                      created_at: new Date().toISOString(),
                    };
                  } catch {
                    currentReportObj = {
                      id: activeTab.reportId || 'report_temp',
                      name: activeTab.title.replace(/\.json$/i, ''),
                      description: '',
                      query_id: '',
                      custom_sql: '',
                      config: '{}',
                      created_at: new Date().toISOString(),
                    };
                  }
                }

                return (
                  <div className={`flex-1 flex flex-col overflow-hidden h-full ${
                    isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
                  }`}>
                    <div className={`flex items-center justify-between px-4 py-2 border-b text-xs flex-shrink-0 ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800 shadow-2xs'
                    }`}>
                      <div className="flex items-center gap-2 font-bold">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span>Report Display: {currentReportObj.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {onEditReportVisual && (
                          <button
                            type="button"
                            onClick={() => onEditReportVisual(currentReportObj!)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                            title="Customize report visually in Report Builder"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Visual Builder</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleToggleViewInIDE}
                          className={`px-2.5 py-1 rounded text-xs font-semibold border transition cursor-pointer ${
                            isDark ? 'bg-slate-800 border-slate-700 text-blue-300 hover:bg-slate-700 hover:text-white' : 'bg-slate-100 border-slate-300 text-blue-700 hover:bg-slate-200'
                          }`}
                          title="Toggle View (ctrl+shift+K)"
                        >
                          Switch to Report JSON Code (Ctrl+Shift+K)
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      <ReportViewer
                        report={currentReportObj}
                        theme={theme}
                        onEdit={onEditReportVisual ? () => onEditReportVisual(currentReportObj!) : undefined}
                        onBack={handleToggleViewInIDE}
                      />
                    </div>
                  </div>
                );
              })()}

              {(activeTab.type === 'types' || activeTab.type === 'json') && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-slate-400 space-y-3">
                  <p>Toggle View is active. Switch back to Code view using Ctrl+Shift+K.</p>
                  <button
                    type="button"
                    onClick={handleToggleViewInIDE}
                    className="px-3 py-1.5 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-500 transition"
                  >
                    Switch to Code (Ctrl+Shift+K)
                  </button>
                </div>
              )}
            </div>
          ) : !activeTab ? (
            /* Empty Workspace Prompt when all tabs are closed */
            <div
              className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${
                isDark ? 'bg-[#1e1e1e] text-slate-300' : 'bg-slate-50 text-slate-700'
              }`}
            >
              <div className="p-3.5 rounded-2xl bg-blue-600/15 border border-blue-500/30 text-blue-400 mb-4">
                <Code2 className="w-8 h-8" />
              </div>
              <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                No open tabs
              </h3>
              <p className={`text-xs max-w-md mb-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Select a component, table, query, or report from the Explorer sidebar, or use one of the standardized IDE actions below.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={addSqlTab}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New tab ({getMenuShortcut('file.newTab')})</span>
                </button>
                {closedTabsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleUndoCloseTab}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border font-semibold transition cursor-pointer ${
                      isDark
                        ? 'bg-[#252526] border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/30'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    <Undo className="w-3.5 h-3.5" />
                    <span>Undo close tab ({getMenuShortcut('file.undoCloseTab')})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openAndTogglePlugin('plugin_file_manager', 'File & Workspace Manager')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border font-semibold transition cursor-pointer ${
                    isDark
                      ? 'bg-[#252526] border-[#454545] text-slate-200 hover:bg-[#333]'
                      : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span>Open ({getMenuShortcut('file.open')})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBridgeLogModal(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border font-semibold transition cursor-pointer ${
                    isDark
                      ? 'bg-[#252526] border-[#454545] text-slate-200 hover:bg-[#333]'
                      : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bridge log ({getMenuShortcut('bridge.interactionsLog')})</span>
                </button>
              </div>
            </div>
          ) : (
            /* Monaco Editor Frame */
            <div className="flex-1 flex overflow-hidden min-h-0">
            <div className={`flex-1 flex flex-col overflow-hidden ${showLivePreview ? 'w-1/2 border-r border-slate-800' : 'w-full'}`}>
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={editorLanguage}
                  theme={isDark ? 'vs-dark' : 'vs'}
                  path={activeTab ? `file:///${activeTab.id}.${editorLanguage === 'typescript' ? 'tsx' : editorLanguage === 'json' ? 'json' : 'sql'}` : undefined}
                  value={activeTab?.content || ''}
                  onChange={(value) => {
                    const newContent = value ?? '';
                    setTabs((prev) =>
                      prev.map((t) => {
                        if (t.id !== activeTabId) return t;
                        const saved = t.savedContent !== undefined ? t.savedContent : t.content;
                        const isDirty = newContent !== saved;
                        return { ...t, content: newContent, savedContent: saved, isDirty };
                      })
                    );
                  }}
                  onMount={handleEditorDidMount}
                  options={{
                    fontSize: editorFontSize,
                    minimap: { enabled: showMinimap },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: 'on',
                    tabSize: editorTabSize,
                    suggestOnTriggerCharacters: true,
                  }}
                />
              </div>

              {/* Output Panel for SQL & Execution results */}
              {(activeTab?.type === 'sql' || activeTab?.type === 'table' || activeTab?.type === 'query' || activeTab?.type === 'report') &&
                queryResults.length > 0 && (
                  <div
                    className={`h-60 border-t flex flex-col ${
                      isDark ? 'border-[#333333] bg-[#181818]' : 'border-[#e5e5e5] bg-white'
                    }`}
                  >
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1 border-b text-xs ${
                        isDark ? 'bg-[#252526] border-[#333333] text-slate-200' : 'bg-[#f3f3f3] border-[#e5e5e5] text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Terminal className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-semibold">Terminal / SQL Output</span>
                        {queryResults.length > 1 && (
                          <div className="flex items-center gap-1 ml-1">
                            {queryResults.map((_, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveResultIndex(idx)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                                  idx === activeResultIndex
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : isDark
                                    ? 'bg-[#1e1e1e] text-slate-300 hover:bg-slate-700'
                                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                                }`}
                              >
                                Stmt {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setQueryResults([])}
                        className={`hover:text-red-400 p-0.5 rounded transition ${
                          isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                        }`}
                        title="Clear output"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-h-0">
                      {currentResult.error ? (
                        <div className="p-4 text-xs font-mono text-red-400 bg-red-950/20 h-full overflow-auto">
                          <strong>Execution Error:</strong>
                          <p className="mt-1">{currentResult.error}</p>
                        </div>
                      ) : (
                        <QueryGrid
                          result={currentResult}
                          onOpenInSpreadsheet={handleIDEOpenSpreadsheet}
                          title={activeTab.title}
                          theme={theme}
                        />
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* Split Live Preview for Plugins */}
            {activeTab?.type === 'plugin' && showLivePreview && (
              <div
                className={`flex-1 flex flex-col border-l overflow-hidden ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div
                  className={`flex items-center justify-between px-4 py-2 border-b text-xs ${
                    isDark ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Live Sandboxed Component Preview</span>
                  </span>
                  <button
                    onClick={() => setShowLivePreview(false)}
                    className={`hover:text-red-400 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <PluginHost
                    code={activeTab.content}
                    pluginName={activeTab.title}
                    pluginId={activeTab.pluginId || 'preview'}
                    theme={theme}
                    gawContext={gawContext}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* 4. BLUE IDE INFORMATION BOTTOM BAR */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#007acc] text-white text-[11px] font-sans select-text flex-shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-semibold flex items-center gap-1 flex-shrink-0">
            <Code2 className="w-3.5 h-3.5" />
            <span>IDE</span>
          </span>

          {/* Active Database File & Sync Status (replaces legacy footer bar) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-900/50 border border-blue-400/30 text-white font-mono text-[10px] flex-shrink-0">
            <HardDrive className="w-3 h-3 text-sky-300" />
            <span className="font-semibold">{storageMeta.fileName || 'new_database.sqlite'}</span>
            <span className="opacity-75">({((storageMeta.fileSize || 0) / 1024).toFixed(1)} KB)</span>
            {storageMeta.syncStatus === 'dirty' ? (
              <button
                type="button"
                onClick={() => {
                  if (gawContext?.bridge?.getState?.().activeFile) {
                    gawContext.bridge.saveDatabase().catch((err: any) => {
                      gawContext.toast?.error?.(err?.message || 'Clockie H2 save failed.');
                    });
                  } else {
                    gawContext?.storage?.save?.();
                  }
                }}
                className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.2 rounded bg-red-600/90 hover:bg-red-500 text-white font-bold transition cursor-pointer"
                title="Unsaved database changes — click to save database file"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>DB Unsaved</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 ml-1 text-emerald-200 font-semibold" title="Database synchronized">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                <span>DB Synced</span>
              </span>
            )}
          </div>

          {/* Full name of currently-active item being edited */}
          {activeTab && (() => {
            const displayTitle = (activeTab.type === 'table' || activeTab.type === 'query' || activeTab.type === 'sql')
              ? activeTab.title.replace(/\.sql$/i, '')
              : activeTab.title;
            return (
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-900/60 border border-blue-400/40 text-white font-mono text-[11px] min-w-0"
                title={`Active item: ${displayTitle}`}
              >
                {activeTab.type === 'plugin' ? (
                  <FileCode className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
                ) : activeTab.type === 'table' ? (
                  <TableIcon className="w-3.5 h-3.5 text-sky-300 flex-shrink-0" />
                ) : activeTab.type === 'report' ? (
                  <FileText className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
                ) : (
                  <Database className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
                )}
                {/* Full name without truncation */}
                <span
                  className="font-bold whitespace-nowrap overflow-x-auto max-w-[240px] sm:max-w-[380px] md:max-w-[500px] scrollbar-none"
                  title={displayTitle}
                >
                  {displayTitle}
                </span>
                {/* Saved / Unsaved Status */}
                {activeTab.isDirty ? (
                  <span className="inline-flex items-center gap-1 ml-1 text-red-200 font-bold text-[10px] flex-shrink-0" title="Unsaved changes in active tab">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-pulse" />
                    Unsaved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 ml-1 text-emerald-200 text-[10px] flex-shrink-0" title="Tab saved">
                    <Check className="w-3 h-3 text-emerald-300" />
                    Saved
                  </span>
                )}
              </div>
            );
          })()}

          {/* Pending two-step chord prompt (e.g. Alt+N waiting for C/Q/T/V/R) */}
          {pendingChordPrefix && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-700 border border-emerald-300/60 text-white font-mono text-[10px] font-semibold flex-shrink-0 shadow-xs">
              <Keyboard className="w-3 h-3 text-emerald-200" />
              <span>Chord: {pendingChordPrefix} — press next key (Esc to cancel)</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              editorRef.current?.getAction('editor.action.marker.next')?.run();
              editorRef.current?.focus();
            }}
            className="hidden md:flex items-center gap-1.5 opacity-90 hover:opacity-100 transition cursor-pointer text-[11px] flex-shrink-0"
            title="Click to jump to next diagnostic error/warning in active file"
          >
            <span className={markerStats.errors > 0 ? "text-red-200 font-bold flex items-center gap-1" : "flex items-center gap-1 opacity-90"}>
              <AlertCircle className="w-3.5 h-3.5 text-red-200" />
              {markerStats.errors} {markerStats.errors === 1 ? 'error' : 'errors'}
            </span>
            <span>,</span>
            <span className={markerStats.warnings > 0 ? "text-sky-100 font-bold flex items-center gap-1" : "flex items-center gap-1 opacity-90"}>
              <AlertTriangle className="w-3.5 h-3.5 text-sky-200" />
              {markerStats.warnings} {markerStats.warnings === 1 ? 'warning' : 'warnings'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <button
            onClick={handleFormatDocument}
            className="flex items-center gap-1 hover:underline cursor-pointer"
            title="Click to format document with Prettier"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">Prettier: ✓</span>
          </button>

          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="hidden sm:inline">Spaces: {editorTabSize}</span>
          <span className="hidden sm:inline">UTF-8</span>
          <span className="capitalize">{editorLanguage}</span>

          <button
            type="button"
            onClick={() => handleSwitchToAppMode()}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] cursor-pointer shadow-xs transition"
            title="Auto-save dirty tabs and switch to App Mode (Ctrl+Shift+F)"
          >
            <Code2 className="w-3 h-3" />
            <span>App Mode (Ctrl+Shift+F)</span>
          </button>
        </div>
      </div>

      {/* 5. MONACO IDE COMMAND PALETTE OVERLAY (Ctrl+Shift+P) */}
      {showCommandPalette && (
        <div
          onClick={handleCloseCommandPalette}
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/60 backdrop-blur-xs select-text"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xl rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs border ${
              isDark
                ? 'bg-[#252526] border-[#454545] text-slate-200'
                : 'bg-white border-[#d4d4d4] text-slate-800'
            }`}
          >
            <div
              className={`p-2 border-b ${
                isDark ? 'border-[#3c3c3c] bg-[#1e1e1e]' : 'border-[#e5e5e5] bg-[#fafafa]'
              }`}
            >
              <input
                type="text"
                autoFocus
                placeholder="> Type a command or file name... (Esc to return to editor)"
                value={commandPaletteQuery}
                onChange={(e) => setCommandPaletteQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCloseCommandPalette();
                    return;
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setPaletteSelectedIndex((prev) =>
                      commandPaletteItems.length > 0 ? (prev + 1) % commandPaletteItems.length : 0
                    );
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setPaletteSelectedIndex((prev) =>
                      commandPaletteItems.length > 0
                        ? (prev - 1 + commandPaletteItems.length) % commandPaletteItems.length
                        : 0
                    );
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const selected = commandPaletteItems[paletteSelectedIndex];
                    if (selected) {
                      selected.action();
                      handleCloseCommandPalette();
                    }
                    return;
                  }
                }}
                className={`w-full px-3 py-1.5 rounded text-xs focus:outline-none border ${
                  isDark
                    ? 'bg-[#3c3c3c] border-[#555] text-white placeholder-slate-400'
                    : 'bg-white border-[#ccc] text-slate-900 placeholder-slate-500'
                }`}
              />
            </div>
            <div
              className={`max-h-80 overflow-y-auto p-1 divide-y ${
                isDark ? 'divide-[#333]' : 'divide-[#f0f0f0]'
              }`}
            >
              {commandPaletteItems.map((cmd, idx) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    handleCloseCommandPalette();
                  }}
                  onMouseEnter={() => setPaletteSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition group ${
                    idx === paletteSelectedIndex
                      ? isDark
                        ? 'bg-[#094771] text-white font-medium'
                        : 'bg-[#e8f0fe] text-blue-900 font-medium'
                      : isDark
                      ? 'hover:bg-[#2a2d2e] text-slate-200'
                      : 'hover:bg-[#f5f5f5] text-slate-800'
                  }`}
                >
                  <span className="truncate">{cmd.title}</span>
                  {cmd.shortcut && (
                    <kbd
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                        idx === paletteSelectedIndex
                          ? isDark
                            ? 'bg-[#005a9e] border-[#007acc] text-white'
                            : 'bg-blue-100 border-blue-300 text-blue-900'
                          : isDark
                          ? 'bg-[#333] border-[#444] text-slate-300'
                          : 'bg-slate-100 border-slate-300 text-slate-600'
                      }`}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. ABOUT GAWKYY IDE MODAL */}
      {showAboutModal && (
        <div
          onClick={() => {
            setShowAboutModal(false);
            setTimeout(() => editorRef.current?.focus(), 10);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-text"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-xl p-6 shadow-2xl border ${
              isDark
                ? 'bg-[#252526] border-[#454545] text-slate-200'
                : 'bg-white border-[#d4d4d4] text-slate-800'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Code2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold">Gawkyy IDE Studio</h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Monaco IDE In-Browser Environment
                </p>
              </div>
            </div>

            <div className={`space-y-2 text-xs mb-6 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <p>
                <strong>Version</strong>: 1.22 (Gawkyy Studio Edition)
              </p>
              <p>
                <strong>Editor Engine</strong>: Monaco IDE (Browser-based code editor engine)
              </p>
              <p>
                <strong>Database Engine</strong>: SQLite WebAssembly via sql.js
              </p>
              <p>
                <strong>Component Transpiler</strong>: Sucrase TSX / React 19 in-browser compiler
              </p>
              <p>
                <strong>Code Formatter</strong>: Prettier In-Browser Standalone Formatter
              </p>
              <p>
                <strong>Theme Integration</strong>: Linked with Gawkyy application theme ({theme})
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAboutModal(false);
                  setTimeout(() => editorRef.current?.focus(), 10);
                }}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow transition active:scale-95 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. SAVE AS MODAL */}
      {showSaveAsModal && (
        <div
          onClick={() => setShowSaveAsModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-text"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-xl p-6 shadow-2xl border ${
              isDark
                ? 'bg-[#252526] border-[#454545] text-slate-200'
                : 'bg-white border-[#d4d4d4] text-slate-800'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <SaveAsIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Save As / Rename</h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Update name or save changes in database
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Query Name:
                </label>
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmSaveAs();
                    }
                  }}
                  autoFocus
                  placeholder="Enter new query name..."
                  className={`w-full px-3 py-2 rounded text-xs focus:outline-none border ${
                    isDark
                      ? 'bg-[#1e1e1e] border-[#454545] text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Description (optional):
                </label>
                <input
                  type="text"
                  value={saveAsDescription}
                  onChange={(e) => setSaveAsDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmSaveAs();
                    }
                  }}
                  placeholder="Enter query description..."
                  className={`w-full px-3 py-2 rounded text-xs focus:outline-none border ${
                    isDark
                      ? 'bg-[#1e1e1e] border-[#454545] text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600'
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveAsModal(false)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-200 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveAs}
                disabled={!saveAsName.trim()}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow transition active:scale-95 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. SYSTEM & CUSTOM KEYBOARD SHORTCUTS MODAL (View -> Shortcuts) */}
      {shortcutModalTab && (
        <ShortcutsModal
          initialTab={shortcutModalTab}
          isDark={isDark}
          overrides={customShortcuts}
          onUpdateOverrides={handleUpdateCustomShortcuts}
          onResetAll={handleResetCustomShortcuts}
          onRecordingChange={setIsRecordingShortcut}
          onClose={() => {
            setIsRecordingShortcut(false);
            setShortcutModalTab(null);
            setTimeout(() => editorRef.current?.focus(), 10);
          }}
        />
      )}

      {/* 9. CLOCKIE H2 BRIDGE INTERACTIONS LOG MODAL (Bridge -> Show Interactions Log) */}
      {showBridgeLogModal && (
        <BridgeInteractionsModal
          isDark={isDark}
          onClose={() => {
            setShowBridgeLogModal(false);
            setTimeout(() => editorRef.current?.focus(), 10);
          }}
        />
      )}
    </div>
  );
};
