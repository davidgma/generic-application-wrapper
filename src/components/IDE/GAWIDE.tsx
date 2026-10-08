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
} from 'lucide-react';
import { SQLiteEngine } from '../../engine/sqliteEngine';
import { PluginEngine } from '../../engine/pluginEngine';
import { QueryResult, SavedQuery, TableSchema } from '../../types/sqlite';
import { PluginRecord, SYSTEM_PLUGIN_IDS, isSystemPlugin } from '../../types/plugin';
import { SavedReport } from '../../types/report';
import { safeStorage } from '../../utils/storage';
import { QueryGrid } from '../QueryGrid';
import { PluginHost } from '../PluginHost';
import { CodeFormatter } from '../../engine/formatter';
import { GAW_TYPES_DECLARATION } from './gawTypesDeclaration';
import { REACT_TYPES_DECLARATION, LUCIDE_TYPES_DECLARATION } from './vendorTypesDeclaration';

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
}

interface GAWIDEProps {
  initialTab?: TargetTabInfo;
  targetTab?: TargetTabInfo | null;
  onClearTargetTab?: () => void;
  onOpenSpreadsheet?: (data: { columns: string[]; values: any[][] }, sheetName?: string) => void;
  onOpenAI?: () => void;
  theme?: 'vs-dark' | 'vs-light';
  onToggleTheme?: () => void;
  gawContext?: any;
  isVSCodeMode?: boolean;
  onToggleVSCodeMode?: () => void;
  onExitIDE?: (target?: TargetTabInfo | null) => void;
  onActiveTabChange?: (target: TargetTabInfo | null) => void;
}

export type MenuKey = 'App' | 'File' | 'Edit' | 'Selection' | 'View' | 'Go' | 'Run' | 'Terminal' | 'Help';

type ActivityBarTab = 'explorer' | 'search' | 'extensions' | 'settings';

export const GAWIDE: React.FC<GAWIDEProps> = ({
  initialTab,
  targetTab,
  onClearTargetTab,
  onOpenSpreadsheet,
  onOpenAI,
  theme = 'vs-dark',
  onToggleTheme,
  gawContext,
  isVSCodeMode = true,
  onToggleVSCodeMode,
  onExitIDE,
  onActiveTabChange,
}) => {
  const engine = SQLiteEngine.getInstance();
  const editorRef = useRef<any>(null);
  const isDark = theme === 'vs-dark';

  // Monaco IDE Layout state
  const [activeActivity, setActiveActivity] = useState<ActivityBarTab>('explorer');
  const [isPrimarySidebarOpen, setIsPrimarySidebarOpen] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const menubarRef = useRef<HTMLDivElement>(null);
  const handleSaveActiveTabRef = useRef<() => void>(() => {});
  const [formatOnSave, setFormatOnSave] = useState(() => {
    return safeStorage.getItem('gaw_format_on_save') !== 'false';
  });
  const [editorFontSize, setEditorFontSize] = useState(13);
  const [editorTabSize, setEditorTabSize] = useState(2);
  const [showMinimap, setShowMinimap] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Explorer Tree Expansion
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    plugins: true,
    pluginsUser: true,
    pluginsSystem: true,
    tables: true,
    tablesUser: true,
    tablesSystem: false,
    queries: true,
    reports: true,
  });

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  // Full-Text Search in Files State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchCase, setSearchMatchCase] = useState(false);

  // Tab management
  const [tabs, setTabs] = useState<TabItem[]>(() => {
    let initialList: TabItem[] = [];
    if (initialTab?.type === 'sql') {
      initialList = [
        {
          id: 'tab_sql_1',
          title: initialTab.name ? `${initialTab.name}.sql` : 'Query.sql',
          type: 'sql',
          content:
            initialTab.code ||
            'SELECT ship_country, COUNT(id) AS total_orders, ROUND(SUM(total_amount), 2) AS total_revenue\nFROM orders\nGROUP BY ship_country\nORDER BY total_revenue DESC;',
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
        {
          id: 'tab_sql_1',
          title: 'Executive_Query.sql',
          type: 'sql',
          content:
            '-- Multi-part analytical query (separated by semicolons)\nSELECT COUNT(*) AS total_customers, (SELECT COUNT(*) FROM orders) AS total_orders, (SELECT ROUND(SUM(total_amount), 2) FROM orders) AS gross_revenue FROM customers;\n\nSELECT status, COUNT(*) AS order_count, ROUND(SUM(total_amount), 2) AS status_revenue FROM orders GROUP BY status;\n\nSELECT c.name AS category_name, COUNT(p.id) AS product_count, SUM(p.units_in_stock) AS total_inventory FROM categories c LEFT JOIN products p ON c.id = p.category_id GROUP BY c.id;',
        },
      ];
    }
    return initialList.map((t) => ({
      ...t,
      savedContent: t.content,
      isDirty: false,
    }));
  });

  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || 'tab_sql_1');
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

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

  useEffect(() => {
    onActiveTabChange?.(currentTargetInfo);
  }, [currentTargetInfo, onActiveTabChange]);

  const handleExitIDE = useCallback(() => {
    if (onExitIDE) {
      onExitIDE(currentTargetInfo);
    } else if (onToggleVSCodeMode) {
      onToggleVSCodeMode();
    }
  }, [onExitIDE, currentTargetInfo, onToggleVSCodeMode]);

  const handleExitIDERef = useRef(handleExitIDE);
  handleExitIDERef.current = handleExitIDE;

  // Execution outputs for SQL
  const [queryResults, setQueryResults] = useState<QueryResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Live compilation status for TSX plugins
  const [compileStatus, setCompileStatus] = useState<{
    valid: boolean;
    error?: string;
  }>({ valid: true });

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

  // Schema state for autocompletion and explorer
  const schema = useMemo(() => engine.getSchema(), [engine]);
  const allPlugins = useMemo(() => engine.getPlugins(), [engine, tabs]);
  const userPlugins = useMemo(() => allPlugins.filter((p) => !isSystemPlugin(p)), [allPlugins]);
  const systemPlugins = useMemo(() => allPlugins.filter((p) => isSystemPlugin(p)), [allPlugins]);

  const userTables = useMemo(
    () => schema.filter((t) => !t.isSystem && !engine.isSystemTable(t.name)),
    [schema, engine]
  );
  const systemTables = useMemo(
    () => schema.filter((t) => t.isSystem || engine.isSystemTable(t.name)),
    [schema, engine]
  );
  const allTables = useMemo(() => [...userTables, ...systemTables], [userTables, systemTables]);
  const allQueries = useMemo(() => engine.getSavedQueries(), [engine, tabs]);
  const allReports = useMemo(() => engine.getSavedReports(), [engine, tabs]);

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
        tabId = `tab_table_${item.name}`;
        title = `${item.name}.sql`;
        content = engine.getRecreateTableSQL(item.name);
      } else if (item.type === 'query') {
        const queries = engine.getSavedQueries();
        const q = queries.find((x) => x.id === item.id || x.name === item.name);
        if (q) {
          tabId = `tab_query_${q.id}`;
          title = `${q.name}.sql`;
          content = q.query;
        }
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
          tabId = 'tab_sql_1';
          title = 'Executive_Query.sql';
          content =
            '-- Analytical Query\nSELECT COUNT(*) AS total_customers, (SELECT COUNT(*) FROM orders) AS total_orders FROM customers;\n\nSELECT * FROM customers LIMIT 25;';
        } else {
          tabId = item.id || (item.name ? `tab_sql_${item.name}` : `tab_sql_${Date.now()}`);
          title = item.name ? `${item.name}.sql` : 'Query.sql';
          content = item.code || 'SELECT * FROM customers LIMIT 25;';
        }
      }

      if (!tabId) return;

      setTabs((prev) => {
        const existing = prev.find(
          (t) =>
            t.id === tabId ||
            (item.type === 'plugin' && item.id && t.pluginId === item.id) ||
            (item.type === 'table' && item.name && t.tableName === item.name) ||
            (item.type === 'query' && item.id && t.queryId === item.id) ||
            (item.type === 'report' && item.id && t.reportId === item.id)
        );
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
        const newTab: TabItem = {
          id: tabId,
          title,
          type: item.type as any,
          content,
          savedContent: content,
          isDirty: false,
          pluginId: item.type === 'plugin' ? item.id : undefined,
          tableName: item.type === 'table' ? item.name : undefined,
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
      }
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenu]);

  // Global capture-phase keydown handler to intercept browser menus (like Alt+F) and handle VS Code keys
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Alt-key combinations for menubar (Alt+F, Alt+E, Alt+S, Alt+V, Alt+G, Alt+R, Alt+T, Alt+H)
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        const map: Record<string, MenuKey> = {
          f: 'File',
          e: 'Edit',
          s: 'Selection',
          v: 'View',
          g: 'Go',
          r: 'Run',
          t: 'Terminal',
          h: 'Help',
        };
        if (map[key]) {
          e.preventDefault();
          e.stopPropagation();
          setActiveMenu((prev) => (prev === map[key] ? null : map[key]));
          return;
        }
      }

      // Escape key handling
      if (e.key === 'Escape') {
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
      }

      // Ctrl+Shift+P / F1 for Command Palette
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        e.stopPropagation();
        setShowCommandPalette(true);
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        setShowCommandPalette(true);
        return;
      }

      // Ctrl+S / Cmd+S: Save current tab
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveActiveTabRef.current?.();
        return;
      }

      // Ctrl+B: Toggle primary sidebar
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B') && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setIsPrimarySidebarOpen((prev) => !prev);
        return;
      }

      // Ctrl+Shift+F: Exit IDE to corresponding application view
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        e.stopPropagation();
        handleExitIDE();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [showCommandPalette, activeMenu, showAboutModal, handleCloseCommandPalette, handleExitIDE]);

  // Sync external targetTab request (from Sidebar edit options)
  useEffect(() => {
    if (targetTab) {
      if (targetTab.timestamp && lastTargetTimestampRef.current === targetTab.timestamp) {
        return;
      }
      if (targetTab.timestamp) {
        lastTargetTimestampRef.current = targetTab.timestamp;
      }
      openOrActivateItem(targetTab);
    }
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

  // Setup Monaco completion providers and cursor tracking on mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track Cursor Position for VS Code Status Bar
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });

    // Keybinding: Ctrl+Shift+F to exit IDE to non-IDE view
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
      handleExitIDERef.current();
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

    // 2. Schema-aware SQL Autocomplete
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: any[] = [];

        schema.forEach((t) => {
          suggestions.push({
            label: t.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: t.name,
            detail: `Table (${t.rowCount} rows)`,
            range,
          });

          t.columns.forEach((col) => {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col.name,
              detail: `${t.name}.${col.name} (${col.type})`,
              range,
            });
          });
        });

        const keywords = [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'INNER JOIN', 'GROUP BY', 'ORDER BY',
          'LIMIT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'ALTER TABLE', 'ADD COLUMN', 'CREATE TABLE',
          'CREATE INDEX', 'DROP TABLE', 'COUNT', 'SUM', 'AVG', 'ROUND', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
        ];
        keywords.forEach((kw) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          });
        });

        return { suggestions };
      },
    });

    // Keybindings:
    // Ctrl+Enter: Run
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCurrentQuery();
    });
    // Ctrl+S: Save (with optional Prettier format on save)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveActiveTabRef.current?.();
    });
    // Ctrl+Z: Undo in Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
      editor.trigger('keyboard', 'undo', null);
    });
    // Ctrl+Y / Ctrl+Shift+Z: Redo in Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
      editor.trigger('keyboard', 'redo', null);
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
      editor.trigger('keyboard', 'redo', null);
    });
    // Shift+Alt+F: Format Document with Prettier
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      handleFormatDocument();
    });
    // Ctrl+Shift+P: Command Palette
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
      setShowCommandPalette(true);
    });
    // Ctrl+B: Toggle Sidebar
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
      setIsPrimarySidebarOpen((prev) => !prev);
    });
    // Alt+N: New Query Tab
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyN, () => {
      addSqlTab();
    });
    // Alt+F: Open File Menu
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      setActiveMenu((prev) => (prev === 'File' ? null : 'File'));
    });
    // Alt+E: Open Edit Menu
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyE, () => {
      setActiveMenu((prev) => (prev === 'Edit' ? null : 'Edit'));
    });
    // Alt+S: Open Selection Menu
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyS, () => {
      setActiveMenu((prev) => (prev === 'Selection' ? null : 'Selection'));
    });
    // Alt+V: Open View Menu
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyV, () => {
      setActiveMenu((prev) => (prev === 'View' ? null : 'View'));
    });
  };

  // Run Query or Compile Plugin or Validate Report
  const runCurrentQuery = () => {
    if (!activeTab) return;
    setIsExecuting(true);

    setTimeout(() => {
      try {
        if (activeTab.type === 'sql' || activeTab.type === 'table' || activeTab.type === 'query') {
          const results = engine.exec(activeTab.content);
          setQueryResults(results);
          setActiveResultIndex(0);
        } else if (activeTab.type === 'report') {
          try {
            const parsed = JSON.parse(activeTab.content);
            let sqlToRun = parsed.custom_sql;
            if (!sqlToRun && parsed.query_id) {
              const q = engine.getSavedQueries().find((sq) => sq.id === parsed.query_id);
              if (q) sqlToRun = q.query;
            }
            if (sqlToRun) {
              const results = engine.exec(sqlToRun);
              setQueryResults(results);
              setActiveResultIndex(0);
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
  const handleSaveActiveTab = async () => {
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
        // Note: Do NOT mark global database storage dirty; tab's dot notification clears
        gawContext?.toast?.success?.(`Saved ${currentTab.title} (temporary in-memory for this session)`);
      } else {
        const now = new Date().toISOString();
        engine.run('UPDATE t_plugins SET code = ?, updated_at = ? WHERE id = ?', [
          contentToSave,
          now,
          currentTab.pluginId,
        ]);
        PluginEngine.clearCache(currentTab.pluginId);
        setTabs((prev) =>
          prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false } : t))
        );
        engine.notifyChange(true);
        gawContext?.toast?.success?.(`Saved ${currentTab.title}`);
      }
    } else if (currentTab.type === 'table') {
      try {
        const results = engine.exec(contentToSave);
        setQueryResults(results);
        setActiveResultIndex(0);
        setTabs((prev) =>
          prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false } : t))
        );
        engine.notifyChange(true);
        gawContext?.toast?.success?.(`Saved and executed table structure for ${currentTab.title}`);
      } catch (err: any) {
        setQueryResults([
          {
            columns: ['error'],
            values: [[err.message || String(err)]],
            error: err.message || String(err),
          },
        ]);
      }
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
        gawContext?.toast?.success?.(`Saved ${currentTab.title}`);
      } catch (err: any) {
        alert('Invalid JSON in Report configuration: ' + err.message);
      }
    } else if (currentTab.type === 'sql' || currentTab.type === 'query') {
      const queryName = currentTab.title.replace(/\.sql$/i, '');
      const existingQueries = engine.getSavedQueries();
      const existing = existingQueries.find((q) => q.name === queryName || q.id === currentTab.queryId);

      const now = new Date().toISOString();
      if (existing) {
        engine.run('UPDATE t_sql_queries SET query = ? WHERE id = ?', [contentToSave, existing.id]);
      } else {
        const newId = currentTab.queryId || `q_${Date.now()}`;
        engine.run(
          'INSERT INTO t_sql_queries (id, name, description, query, params, layout, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newId, queryName, 'Custom Query saved from IDE', contentToSave, '{}', '{}', now]
        );
      }
      engine.notifyChange(true);
      setTabs((prev) =>
        prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false } : t))
      );
      gawContext?.toast?.success?.(`Saved ${currentTab.title}`);
    } else {
      setTabs((prev) =>
        prev.map((t) => (t.id === currentTab.id ? { ...t, content: contentToSave, savedContent: contentToSave, isDirty: false } : t))
      );
      gawContext?.toast?.success?.(`Saved ${currentTab.title}`);
    }
  };

  handleSaveActiveTabRef.current = handleSaveActiveTab;

  // Add new SQL tab
  const addSqlTab = () => {
    const id = `tab_sql_${Date.now()}`;
    const content = 'SELECT * FROM customers LIMIT 25;';
    const newTab: TabItem = {
      id,
      title: `Query_${tabs.length + 1}.sql`,
      type: 'sql',
      content,
      savedContent: content,
      isDirty: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(id);
  };

  // Close tab
  const closeTab = (idToClose: string) => {
    if (tabs.length === 1) return;
    const nextTabs = tabs.filter((t) => t.id !== idToClose);
    setTabs(nextTabs);
    if (activeTabId === idToClose) {
      setActiveTabId(nextTabs[0]?.id || '');
    }
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
            file: `${query.name}.sql`,
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
        action: () => {
          editorRef.current?.trigger('commandPalette', 'undo', null);
          editorRef.current?.focus();
        },
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
        id: 'cmd_exit_ide',
        title: 'View: Exit Monaco IDE to Application View',
        shortcut: 'Ctrl+Shift+F',
        action: () => handleExitIDE(),
      },
      {
        id: 'cmd_new_sql',
        title: 'File: New SQL Query File',
        shortcut: 'Alt+N',
        action: () => addSqlTab(),
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
        id: 'cmd_help',
        title: 'Help: Open Help & System Guide',
        shortcut: '',
        action: () => {
          gawContext?.navigation?.navigate?.('help', 'help');
        },
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
        title: `Go to File: ${t.name}.sql (Schema DDL)`,
        shortcut: 'Table',
        action: () => openOrActivateItem({ type: 'table', name: t.name }),
      });
    });

    const q = commandPaletteQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter((item) => item.title.toLowerCase().includes(q));
  }, [allPlugins, allTables, isVSCodeMode, onToggleVSCodeMode, commandPaletteQuery, isDark, onToggleTheme]);

  // Tab editor language
  const editorLanguage = useMemo(() => {
    if (activeTab?.type === 'plugin' || activeTab?.type === 'types') return 'typescript';
    if (activeTab?.type === 'report' || activeTab?.type === 'json') return 'json';
    return 'sql';
  }, [activeTab?.type]);

  // Active query result to render
  const currentResult = queryResults[activeResultIndex] || queryResults[0];

  // Menubar definitions with full VS Code action binding
  const menuDefinitions: Record<
    MenuKey,
    Array<{
      label: string;
      shortcut?: string;
      action: () => void;
      divider?: boolean;
    }>
  > = {
    App: [
      {
        label: 'About Gawkyy IDE...',
        action: () => setShowAboutModal(true),
      },
      {
        label: `Preferences: Color Theme (${isDark ? 'Switch to Light' : 'Switch to Dark'})`,
        action: () => onToggleTheme?.(),
        divider: true,
      },
      {
        label: 'Settings & Keybindings...',
        shortcut: 'Ctrl+,',
        action: () => {
          setActiveActivity('settings');
          setIsPrimarySidebarOpen(true);
        },
      },
      {
        label: 'Command Palette...',
        shortcut: 'Ctrl+Shift+P',
        action: () => setShowCommandPalette(true),
      },
      {
        label: 'Exit Monaco IDE',
        shortcut: 'Ctrl+Shift+F',
        action: () => handleExitIDE(),
        divider: true,
      },
    ],
    File: [
      {
        label: 'New SQL Query Tab',
        shortcut: 'Alt+N',
        action: () => addSqlTab(),
      },
      {
        label: 'Open Object / File...',
        shortcut: 'Ctrl+O',
        action: () => setShowCommandPalette(true),
      },
      {
        label: 'Save Current Tab',
        shortcut: 'Ctrl+S',
        action: () => handleSaveActiveTabRef.current?.(),
      },
      {
        label: 'Save All Tabs',
        action: () => {
          tabs.forEach((tab) => {
            if (tab.isDirty && tab.type === 'plugin' && tab.pluginId) {
              try {
                engine.run('UPDATE t_plugins SET code = ?, updated_at = ? WHERE id = ?;', [
                  tab.content,
                  new Date().toISOString(),
                  tab.pluginId,
                ]);
              } catch (e) {}
            }
          });
          setTabs((prev) => prev.map((t) => ({ ...t, savedContent: t.content, isDirty: false })));
          engine.notifyChange(true);
        },
      },
      {
        label: 'Format with Prettier & Save',
        shortcut: 'Shift+Alt+F',
        action: async () => {
          await handleFormatDocument();
          handleSaveActiveTabRef.current?.();
        },
        divider: true,
      },
      {
        label: 'Close Active Tab',
        shortcut: 'Ctrl+W',
        action: () => {
          if (activeTabId) closeTab(activeTabId);
        },
      },
      {
        label: 'Close All Tabs',
        action: () => {
          tabs.forEach((t) => closeTab(t.id));
        },
        divider: true,
      },
      {
        label: 'Exit Monaco IDE Mode',
        action: () => onToggleVSCodeMode?.(),
      },
    ],
    Edit: [
      {
        label: 'Undo',
        shortcut: 'Ctrl+Z',
        action: () => {
          editorRef.current?.trigger('menu', 'undo', null);
          editorRef.current?.focus();
        },
      },
      {
        label: 'Redo',
        shortcut: 'Ctrl+Y',
        action: () => {
          editorRef.current?.trigger('menu', 'redo', null);
          editorRef.current?.focus();
        },
        divider: true,
      },
      {
        label: 'Cut',
        shortcut: 'Ctrl+X',
        action: () => {
          editorRef.current?.focus();
          document.execCommand('cut');
        },
      },
      {
        label: 'Copy',
        shortcut: 'Ctrl+C',
        action: () => {
          editorRef.current?.focus();
          document.execCommand('copy');
        },
      },
      {
        label: 'Paste',
        shortcut: 'Ctrl+V',
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
        shortcut: 'Shift+Alt+F',
        action: () => handleFormatDocument(),
      },
    ],
    Selection: [
      {
        label: 'Select All',
        shortcut: 'Ctrl+A',
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
    View: [
      {
        label: 'Command Palette...',
        shortcut: 'Ctrl+Shift+P',
        action: () => setShowCommandPalette(true),
        divider: true,
      },
      {
        label: 'Explorer',
        shortcut: 'Ctrl+Shift+E',
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
        label: 'Extensions / Plugins',
        action: () => {
          setActiveActivity('extensions');
          setIsPrimarySidebarOpen(true);
        },
        divider: true,
      },
      {
        label: 'Toggle Primary Side Bar',
        shortcut: 'Ctrl+B',
        action: () => setIsPrimarySidebarOpen((p) => !p),
      },
      {
        label: 'Toggle Live TSX Preview',
        shortcut: 'Ctrl+J',
        action: () => setShowLivePreview((p) => !p),
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
        shortcut: 'Ctrl+Enter',
        action: () => runCurrentQuery(),
      },
      {
        label: 'Validate TSX Plugin Syntax',
        action: () => {
          if (activeTab?.type === 'plugin') {
            const res = PluginEngine.compile(activeTab.content, activeTab.pluginId || 'test');
            setCompileStatus({ valid: res.success, error: res.error });
            if (res.success) {
              alert('TSX Syntax Valid: No compilation errors found.');
            } else {
              alert('TSX Syntax Error:\n' + (res.error || 'Unknown error'));
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
    Help: [
      {
        label: 'Help & System Guide',
        action: () => {
          gawContext?.navigation?.navigate?.('help', 'help');
        },
      },
      {
        label: 'Keyboard Shortcuts Reference',
        action: () => {
          setActiveActivity('settings');
          setIsPrimarySidebarOpen(true);
        },
        divider: true,
      },
      {
        label: 'About Gawkyy IDE',
        action: () => setShowAboutModal(true),
      },
    ],
  };

  const renderMenuDropdown = (mKey: MenuKey) => {
    const items = menuDefinitions[mKey] || [];
    return (
      <div
        className={`absolute left-0 top-full mt-1 min-w-[230px] rounded-lg shadow-2xl py-1.5 z-50 select-text border backdrop-blur-md ${
          isDark
            ? 'bg-[#252526] border-[#454545] text-slate-200'
            : 'bg-white border-[#d4d4d4] text-slate-800'
        }`}
      >
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            <button
              onClick={() => {
                setActiveMenu(null);
                item.action();
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition ${
                isDark
                  ? 'hover:bg-[#094771] hover:text-white'
                  : 'hover:bg-[#e8f0fe] hover:text-blue-900'
              }`}
            >
              <span>{item.label}</span>
              {item.shortcut && (
                <span
                  className={`text-[10px] font-mono ml-4 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {item.shortcut}
                </span>
              )}
            </button>
            {item.divider && (
              <div
                className={`my-1 border-t ${
                  isDark ? 'border-[#3c3c3c]' : 'border-[#e5e5e5]'
                }`}
              />
            )}
          </React.Fragment>
        ))}
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
              {(['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'] as MenuKey[]).map((mKey) => (
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
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className={`p-1.5 rounded transition ${
                  isDark ? 'text-amber-400 hover:bg-[#3c3c3c]' : 'text-slate-700 hover:bg-slate-200'
                }`}
                title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleFormatDocument}
              disabled={isFormatting}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition ${
                isDark
                  ? 'hover:bg-[#3c3c3c] text-indigo-300'
                  : 'hover:bg-slate-200 text-indigo-700'
              }`}
              title="Format Document with Prettier (Shift+Alt+F)"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Prettier</span>
            </button>

            <button
              onClick={() => setIsPrimarySidebarOpen(!isPrimarySidebarOpen)}
              className={`p-1.5 rounded transition ${
                isDark ? 'hover:bg-[#3c3c3c] text-slate-300' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Toggle Primary Side Bar (Ctrl+B)"
            >
              <Files className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleExitIDE}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow transition active:scale-95 ml-1"
              title="Exit Monaco IDE and return to application view (Ctrl+Shift+F)"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit IDE</span>
              <kbd className="opacity-80 text-[10px] px-1 bg-black/30 rounded border border-white/20 font-mono ml-0.5">
                Ctrl+Shift+F
              </kbd>
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
            className={`w-64 border-r flex flex-col text-xs select-text overflow-hidden flex-shrink-0 ${
              isDark ? 'bg-[#252526] border-[#1e1e1e] text-slate-300' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Header of Primary Sidebar */}
            <div
              className={`flex items-center justify-between px-4 py-2.5 uppercase tracking-wider text-[11px] font-bold border-b ${
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
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {/* TAB A: EXPLORER */}
              {activeActivity === 'explorer' && (
                <div className="space-y-2 text-xs">
                  {/* Folder: PLUGINS */}
                  <div>
                    <div
                      onClick={() => toggleFolder('plugins')}
                      className={`flex items-center gap-1.5 px-2 py-1 font-bold cursor-pointer rounded transition ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-extrabold hover:text-black hover:bg-slate-100'
                      }`}
                    >
                      {expandedFolders.plugins ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <Folder className="w-3.5 h-3.5 text-blue-500" />
                      <span>plugins ({allPlugins.length})</span>
                    </div>

                    {expandedFolders.plugins && (
                      <div className="pl-4 space-y-1.5 mt-0.5">
                        {/* Subfolder: System Plugins */}
                        <div>
                          <div
                            onClick={() => toggleFolder('pluginsSystem')}
                            className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                              isDark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-500 hover:text-sky-600'
                            }`}
                          >
                            {expandedFolders.pluginsSystem ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <Folder className={`w-3 h-3 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                            <span>System ({systemPlugins.length})</span>
                          </div>
                          {expandedFolders.pluginsSystem && (
                            <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-sky-500/20">
                              {systemPlugins.map((p) => (
                                <div
                                  key={p.id}
                                  onClick={() => openOrActivateItem({ type: 'plugin', id: p.id, name: p.name })}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${
                                    isDark ? 'text-sky-300 hover:text-white hover:bg-slate-800' : 'text-sky-600 hover:text-sky-700 hover:bg-sky-50 font-medium'
                                  }`}
                                >
                                  <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                                  <span className="truncate">{p.name}.tsx</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Subfolder: User Plugins */}
                        <div>
                          <div
                            onClick={() => toggleFolder('pluginsUser')}
                            className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                              isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-500 hover:text-emerald-600'
                            }`}
                          >
                            {expandedFolders.pluginsUser ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <Folder className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                            <span>User ({userPlugins.length})</span>
                          </div>
                          {expandedFolders.pluginsUser && (
                            <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-emerald-500/20">
                              {userPlugins.length === 0 && (
                                <div className="px-2 py-0.5 text-[10px] text-slate-500 italic">No user plugins</div>
                              )}
                              {userPlugins.map((p) => (
                                <div
                                  key={p.id}
                                  onClick={() => openOrActivateItem({ type: 'plugin', id: p.id, name: p.name })}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${
                                    isDark ? 'text-emerald-300 hover:text-white hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-medium'
                                  }`}
                                >
                                  <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                                  <span className="truncate">{p.name}.tsx</span>
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
                      className={`flex items-center gap-1.5 px-2 py-1 font-bold cursor-pointer rounded transition ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-extrabold hover:text-black hover:bg-slate-100'
                      }`}
                    >
                      {expandedFolders.tables ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <Folder className="w-3.5 h-3.5 text-amber-500" />
                      <span>tables ({allTables.length})</span>
                    </div>

                    {expandedFolders.tables && (
                      <div className="pl-4 space-y-1.5 mt-0.5">
                        {/* Subfolder: User Tables */}
                        <div>
                          <div
                            onClick={() => toggleFolder('tablesUser')}
                            className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                              isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-500 hover:text-emerald-600'
                            }`}
                          >
                            {expandedFolders.tablesUser ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            <Folder className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                            <span>User ({userTables.length})</span>
                          </div>
                          {expandedFolders.tablesUser && (
                            <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-emerald-500/20">
                              {userTables.length === 0 && (
                                <div className="px-2 py-0.5 text-[10px] text-slate-500 italic">No user tables</div>
                              )}
                              {userTables.map((t) => (
                                <div
                                  key={t.name}
                                  onClick={() => openOrActivateItem({ type: 'table', name: t.name })}
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${
                                    isDark ? 'text-emerald-300 hover:text-white hover:bg-slate-800' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-medium'
                                  }`}
                                  title={`Table: ${t.name} (Click to view DDL recreation code)`}
                                >
                                  <TableIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                                  <span className="truncate">{t.name}.sql</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Subfolder: System Tables */}
                        {systemTables.length > 0 && (
                          <div>
                            <div
                              onClick={() => toggleFolder('tablesSystem')}
                              className={`flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold cursor-pointer rounded transition ${
                                isDark ? 'text-sky-300 hover:text-sky-200' : 'text-sky-500 hover:text-sky-600'
                              }`}
                            >
                              {expandedFolders.tablesSystem ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              <Folder className={`w-3 h-3 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                              <span>System ({systemTables.length})</span>
                            </div>
                            {expandedFolders.tablesSystem && (
                              <div className="pl-4 space-y-0.5 mt-0.5 border-l ml-2 border-sky-500/20">
                                {systemTables.map((t) => (
                                  <div
                                    key={t.name}
                                    onClick={() => openOrActivateItem({ type: 'table', name: t.name })}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${
                                      isDark ? 'text-sky-300 hover:text-white hover:bg-slate-800' : 'text-sky-600 hover:text-sky-700 hover:bg-sky-50 font-medium'
                                    }`}
                                    title={`System Table: ${t.name} (Click to view DDL recreation code)`}
                                  >
                                    <TableIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-500'}`} />
                                    <span className="truncate">{t.name}.sql</span>
                                  </div>
                                ))}
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
                      className={`flex items-center gap-1.5 px-2 py-1 font-bold cursor-pointer rounded transition ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-extrabold hover:text-black hover:bg-slate-100'
                      }`}
                    >
                      {expandedFolders.queries ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <Folder className="w-3.5 h-3.5 text-cyan-500" />
                      <span>queries ({allQueries.length})</span>
                    </div>
                    {expandedFolders.queries && (
                      <div className="pl-6 space-y-0.5 mt-0.5">
                        {allQueries.map((q) => (
                          <div
                            key={q.id}
                            onClick={() => openOrActivateItem({ type: 'query', id: q.id, name: q.name })}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${
                              isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-semibold hover:text-black hover:bg-slate-100'
                            }`}
                          >
                            <Database className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
                            <span className="truncate">{q.name}.sql</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Folder: REPORTS */}
                  <div>
                    <div
                      onClick={() => toggleFolder('reports')}
                      className={`flex items-center gap-1.5 px-2 py-1 font-bold cursor-pointer rounded transition ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-extrabold hover:text-black hover:bg-slate-100'
                      }`}
                    >
                      {expandedFolders.reports ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <Folder className="w-3.5 h-3.5 text-purple-500" />
                      <span>reports ({allReports.length})</span>
                    </div>
                    {expandedFolders.reports && (
                      <div className="pl-6 space-y-0.5 mt-0.5">
                        {allReports.map((r) => (
                          <div
                            key={r.id}
                            onClick={() => openOrActivateItem({ type: 'report', id: r.id, name: r.name })}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${
                              isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-semibold hover:text-black hover:bg-slate-100'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
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
                      className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-semibold hover:text-black hover:bg-slate-100'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span>types/gaw.d.ts</span>
                    </div>
                    <div
                      onClick={() => openOrActivateItem({ type: 'json', name: 'package.json' })}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition truncate ${
                        isDark ? 'text-slate-300 hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-950 font-semibold hover:text-black hover:bg-slate-100'
                      }`}
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
                    <span className={`font-bold text-[11px] ${isDark ? 'text-white' : 'text-slate-950'}`}>Keyboard Shortcuts:</span>
                    <div className="space-y-1.5">
                      {[
                        ['Ctrl + Shift + F', 'Toggle Monaco IDE / Gawkyy Shell'],
                        ['Shift + Alt + F', 'Format Document (Prettier)'],
                        ['Ctrl + Enter', 'Run Query / Test Plugin'],
                        ['Ctrl + S', 'Save File'],
                        ['Ctrl + Shift + P', 'Command Palette'],
                        ['Ctrl + B', 'Toggle Primary Side Bar'],
                      ].map(([keys, desc], idx) => (
                        <div
                          key={idx}
                          className={`p-1.5 rounded border flex items-center justify-between text-[10px] ${
                            isDark ? 'bg-[#1e1e1e] border-[#333]' : 'bg-white border-slate-200 text-slate-950 shadow-2xs'
                          }`}
                        >
                          <span className={isDark ? 'text-slate-400' : 'text-slate-950 font-medium'}>{desc}</span>
                          <kbd className={`px-1.5 py-0.5 rounded font-mono ${
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
          </div>
        )}

        {/* 3. CENTER MONACO EDITOR CANVAS & TABS */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
          {/* VS Code Tab Bar */}
          <div
            className={`flex items-center border-b overflow-x-auto text-xs select-text ${
              isDark ? 'bg-[#252526] border-[#1e1e1e]' : 'bg-[#f3f3f3] border-[#e5e5e5]'
            }`}
          >
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
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
                      <FileText className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <Database className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span className="truncate max-w-[140px]">{tab.title}</span>
                    {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    {tabs.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTab(tab.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
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

          {/* Monaco Editor Frame */}
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
                      className={`flex items-center justify-between px-3 py-1 border-b text-xs ${
                        isDark ? 'bg-[#252526] border-[#333333] text-slate-200' : 'bg-[#f3f3f3] border-[#e5e5e5] text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-semibold">Terminal / SQL Output</span>
                        {queryResults.length > 1 && (
                          <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            ({queryResults.length} statement outputs)
                          </span>
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
                          onOpenInSpreadsheet={onOpenSpreadsheet}
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
                    <span>Live Sandboxed Plugin Preview</span>
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
        </div>
      </div>

      {/* 4. BLUE IDE INFORMATION BOTTOM BAR */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#007acc] text-white text-[11px] font-sans select-text flex-shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-semibold flex items-center gap-1 flex-shrink-0">
            <Code2 className="w-3.5 h-3.5" />
            <span>main</span>
          </span>

          {/* Full name of currently-active item being edited */}
          {activeTab && (
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-900/60 border border-blue-400/40 text-white font-mono text-[11px] min-w-0"
              title={`Active item: ${activeTab.title}`}
            >
              {activeTab.type === 'plugin' ? (
                <FileCode className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
              ) : activeTab.type === 'table' ? (
                <TableIcon className="w-3.5 h-3.5 text-amber-300 flex-shrink-0" />
              ) : activeTab.type === 'report' ? (
                <FileText className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />
              ) : (
                <Database className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
              )}
              {/* Full name without truncation */}
              <span className="font-bold whitespace-nowrap overflow-x-auto max-w-[260px] sm:max-w-[420px] md:max-w-[550px] scrollbar-none" title={activeTab.title}>
                {activeTab.title}
              </span>
              {/* Saved / Unsaved Status */}
              {activeTab.isDirty ? (
                <span className="inline-flex items-center gap-1 ml-1 text-amber-300 font-bold text-[10px] flex-shrink-0" title="Unsaved changes in active tab">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
                  Unsaved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 ml-1 text-emerald-200 text-[10px] flex-shrink-0" title="File is saved">
                  <Check className="w-3 h-3 text-emerald-300" />
                  Saved
                </span>
              )}
            </div>
          )}

          <span className="opacity-80 hidden md:inline flex-shrink-0">0 errors, 0 warnings</span>
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
            onClick={handleExitIDE}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-white font-medium text-[10px] cursor-pointer"
            title="Exit Monaco IDE and return to application view (Ctrl+Shift+F)"
          >
            <Code2 className="w-3 h-3" />
            <span>Exit IDE (Ctrl+Shift+F)</span>
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
                <strong>Version</strong>: 1.2.0 (Gawkyy Studio Edition)
              </p>
              <p>
                <strong>Editor Engine</strong>: Monaco IDE (Browser-based code editor engine)
              </p>
              <p>
                <strong>Database Engine</strong>: SQLite WebAssembly via sql.js
              </p>
              <p>
                <strong>Plugin Transpiler</strong>: Sucrase TSX / React 19 in-browser compiler
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
    </div>
  );
};
