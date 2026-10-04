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
  Bug,
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
} from 'lucide-react';
import { SQLiteEngine } from '../../engine/sqliteEngine';
import { PluginEngine } from '../../engine/pluginEngine';
import { QueryResult, SavedQuery, TableSchema } from '../../types/sqlite';
import { PluginRecord } from '../../types/plugin';
import { SavedReport } from '../../types/report';
import { QueryGrid } from '../QueryGrid';
import { PluginHost } from '../PluginHost';
import { CodeFormatter } from '../../engine/formatter';
import { GAW_TYPES_DECLARATION } from './gawTypesDeclaration';

export interface TabItem {
  id: string;
  title: string;
  type: 'sql' | 'plugin' | 'table' | 'query' | 'report' | 'types' | 'json';
  content: string;
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
  gawContext?: any;
  isVSCodeMode?: boolean;
  onToggleVSCodeMode?: () => void;
}

type ActivityBarTab = 'explorer' | 'search' | 'extensions' | 'debug' | 'settings';

export const GAWIDE: React.FC<GAWIDEProps> = ({
  initialTab,
  targetTab,
  onClearTargetTab,
  onOpenSpreadsheet,
  onOpenAI,
  theme = 'vs-dark',
  gawContext,
  isVSCodeMode = false,
  onToggleVSCodeMode,
}) => {
  const engine = SQLiteEngine.getInstance();
  const editorRef = useRef<any>(null);

  // VS Code Layout state
  const [activeActivity, setActiveActivity] = useState<ActivityBarTab>('explorer');
  const [isPrimarySidebarOpen, setIsPrimarySidebarOpen] = useState(true);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState('');
  const [formatOnSave, setFormatOnSave] = useState(() => {
    return localStorage.getItem('gaw_format_on_save') !== 'false';
  });
  const [editorFontSize, setEditorFontSize] = useState(13);
  const [editorTabSize, setEditorTabSize] = useState(2);
  const [showMinimap, setShowMinimap] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Explorer Tree Expansion
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    plugins: true,
    tables: true,
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
    if (initialTab?.type === 'sql') {
      return [
        {
          id: 'tab_sql_1',
          title: initialTab.name ? `${initialTab.name}.sql` : 'Query.sql',
          type: 'sql',
          content:
            initialTab.code ||
            'SELECT ship_country, COUNT(id) AS total_orders, ROUND(SUM(total_amount), 2) AS total_revenue\nFROM orders\nGROUP BY ship_country\nORDER BY total_revenue DESC;',
        },
      ];
    }
    if (initialTab?.type === 'plugin' && initialTab.id) {
      const plugins = engine.getPlugins();
      const p = plugins.find((item) => item.id === initialTab.id);
      if (p) {
        return [
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
    const defaultPlugins = engine.getPlugins();
    const helloPlugin = defaultPlugins.find((p) => p.id === 'plugin_hello_world') || defaultPlugins[0];
    return [
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
  });

  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || 'tab_sql_1');
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

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
  const allTables = useMemo(
    () => schema.filter((t) => !t.isSystem && !engine.isSystemTable(t.name)),
    [schema, engine]
  );
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
        const ddl = engine.getTableDDL(item.name);
        content = `-- ===================================================\n-- Table Schema & Alteration: "${item.name}"\n-- Run (Ctrl+Enter or Run) to execute schema modifications.\n-- ===================================================\n\n-- Current Definition:\n${ddl};\n\n-- ---------------------------------------------------\n-- Examples for modifying table "${item.name}":\n-- 1. Add column:\n-- ALTER TABLE "${item.name}" ADD COLUMN "new_column" TEXT DEFAULT '';\n--\n-- 2. Rename column:\n-- ALTER TABLE "${item.name}" RENAME COLUMN "old_name" TO "new_name";\n--\n-- 3. Create index:\n-- CREATE INDEX IF NOT EXISTS "idx_${item.name}_id" ON "${item.name}" ("id");\n-- ---------------------------------------------------\n`;
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
          prev.map((t) => (t.id === activeTab.id ? { ...t, content: formatted, isDirty: true } : t))
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

    // 1. Add TypeScript definitions for GAW Plugin APIs
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      GAW_TYPES_DECLARATION,
      'file:///node_modules/@types/gaw/index.d.ts'
    );
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTextExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: 'React.createElement',
      reactNamespace: 'React',
      allowJs: true,
    });

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
      handleSaveActiveTab();
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
    if (!activeTab) return;

    let contentToSave = activeTab.content;

    // Optional Format on Save with Prettier
    if (formatOnSave && activeTab.type !== 'types') {
      try {
        const lang = activeTab.type === 'plugin' ? 'typescript' : activeTab.type === 'report' || activeTab.type === 'json' ? 'json' : 'sql';
        const formatted = await CodeFormatter.format(contentToSave, lang);
        if (formatted) {
          contentToSave = formatted;
        }
      } catch {
        // ignore format failure on save
      }
    }

    if (activeTab.type === 'plugin' && activeTab.pluginId) {
      const now = new Date().toISOString();
      engine.run('UPDATE t_plugins SET code = ?, updated_at = ? WHERE id = ?', [
        contentToSave,
        now,
        activeTab.pluginId,
      ]);
      PluginEngine.clearCache(activeTab.pluginId);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, content: contentToSave, isDirty: false } : t))
      );
      engine.notifyChange();
    } else if (activeTab.type === 'table') {
      try {
        const results = engine.exec(contentToSave);
        setQueryResults(results);
        setActiveResultIndex(0);
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, content: contentToSave, isDirty: false } : t))
        );
        engine.notifyChange();
      } catch (err: any) {
        setQueryResults([
          {
            columns: ['error'],
            values: [[err.message || String(err)]],
            error: err.message || String(err),
          },
        ]);
      }
    } else if (activeTab.type === 'report' && activeTab.reportId) {
      try {
        const parsed = JSON.parse(contentToSave);
        engine.saveReport({
          id: activeTab.reportId,
          name: parsed.name || activeTab.title.replace(/\.json$/i, ''),
          description: parsed.description || '',
          query_id: parsed.query_id || '',
          custom_sql: parsed.custom_sql || '',
          config: typeof parsed.config === 'string' ? parsed.config : JSON.stringify(parsed.config || {}),
          created_at: parsed.created_at || new Date().toISOString(),
        });
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, content: contentToSave, isDirty: false } : t))
        );
      } catch (err: any) {
        alert('Invalid JSON in Report configuration: ' + err.message);
      }
    } else if (activeTab.type === 'sql' || activeTab.type === 'query') {
      const queryName = activeTab.title.replace(/\.sql$/i, '');
      const existingQueries = engine.getSavedQueries();
      const existing = existingQueries.find((q) => q.name === queryName || q.id === activeTab.queryId);

      const now = new Date().toISOString();
      if (existing) {
        engine.run('UPDATE t_sql_queries SET query = ? WHERE id = ?', [contentToSave, existing.id]);
      } else {
        const newId = activeTab.queryId || `q_${Date.now()}`;
        engine.run(
          'INSERT INTO t_sql_queries (id, name, description, query, params, layout, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newId, queryName, 'Custom Query saved from IDE', contentToSave, '{}', '{}', now]
        );
      }
      engine.notifyChange();
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, content: contentToSave, isDirty: false } : t))
      );
    }
  };

  // Add new SQL tab
  const addSqlTab = () => {
    const id = `tab_sql_${Date.now()}`;
    const newTab: TabItem = {
      id,
      title: `Query_${tabs.length + 1}.sql`,
      type: 'sql',
      content: 'SELECT * FROM customers LIMIT 25;',
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
        id: 'cmd_save',
        title: 'File: Save Current File',
        shortcut: 'Ctrl+S',
        action: () => handleSaveActiveTab(),
      },
      {
        id: 'cmd_toggle_sidebar',
        title: 'View: Toggle Primary Side Bar',
        shortcut: 'Ctrl+B',
        action: () => setIsPrimarySidebarOpen((prev) => !prev),
      },
      ...(onToggleVSCodeMode
        ? [
            {
              id: 'cmd_toggle_vscode',
              title: isVSCodeMode ? 'View: Switch to Gawkyy Application Shell' : 'View: Switch to Full VS Code Studio Mode',
              shortcut: 'Ctrl+Shift+F',
              action: () => onToggleVSCodeMode(),
            },
          ]
        : []),
      {
        id: 'cmd_new_sql',
        title: 'File: New SQL Query File',
        shortcut: '',
        action: () => addSqlTab(),
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
  }, [allPlugins, allTables, isVSCodeMode, onToggleVSCodeMode, commandPaletteQuery]);

  // Tab editor language
  const editorLanguage = useMemo(() => {
    if (activeTab?.type === 'plugin' || activeTab?.type === 'types') return 'typescript';
    if (activeTab?.type === 'report' || activeTab?.type === 'json') return 'json';
    return 'sql';
  }, [activeTab?.type]);

  // Active query result to render
  const currentResult = queryResults[activeResultIndex] || queryResults[0];
  const isDark = theme === 'vs-dark';

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-[#1e1e1e] text-slate-200' : 'bg-white text-slate-800'} overflow-hidden select-text font-sans`}>
      {/* 1. VS CODE TITLE BAR & MENUBAR (When in Full VS Code Mode) */}
      {isVSCodeMode ? (
        <div className="flex items-center justify-between px-3 py-1 bg-[#323233] text-slate-200 text-xs border-b border-[#252526] select-text">
          {/* Left Menus */}
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-400" />
            <div className="flex items-center gap-1 font-medium text-[11px]">
              <button className="px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition">File</button>
              <button className="px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition">Edit</button>
              <button className="px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition">Selection</button>
              <button className="px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition">View</button>
              <button className="px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition">Go</button>
              <button
                onClick={runCurrentQuery}
                className="px-2 py-0.5 rounded hover:bg-[#3c3c3c] text-emerald-400 transition"
              >
                Run
              </button>
              <button className="px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition">Terminal</button>
              <button className="px-2 py-0.5 rounded hover:bg-[#3c3c3c] transition">Help</button>
            </div>
          </div>

          {/* Center Command Palette Quick Search Box */}
          <div
            onClick={() => setShowCommandPalette(true)}
            className="flex items-center justify-between w-80 max-w-sm px-3 py-1 bg-[#1e1e1e] hover:bg-[#2a2d2e] border border-[#3c3c3c] rounded text-[11px] text-slate-400 cursor-pointer shadow-inner"
            title="Open Command Palette (Ctrl+Shift+P)"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">gaw-workspace &gt; {activeTab?.title || 'search...'}</span>
            </div>
            <kbd className="px-1.5 py-0.2 bg-[#2d2d2d] border border-[#3e3e3e] rounded text-[10px] font-mono">
              Ctrl+Shift+P
            </kbd>
          </div>

          {/* Right Layout Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleFormatDocument}
              disabled={isFormatting}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#3c3c3c] text-[11px] text-indigo-300 transition"
              title="Format Document with Prettier (Shift+Alt+F)"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Prettier</span>
            </button>

            <button
              onClick={() => setIsPrimarySidebarOpen(!isPrimarySidebarOpen)}
              className="p-1 rounded hover:bg-[#3c3c3c] text-slate-300 transition"
              title="Toggle Primary Side Bar (Ctrl+B)"
            >
              <Files className="w-3.5 h-3.5" />
            </button>

            {onToggleVSCodeMode && (
              <button
                onClick={onToggleVSCodeMode}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] shadow transition active:scale-95 ml-2"
                title="Exit to standard Gawkyy application view (Ctrl+Shift+F)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit VS Code Mode</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* STANDARD GAW COMMAND BAR */
        <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'} text-xs`}>
          <div className="flex items-center gap-1 overflow-x-auto flex-1 max-w-2xl">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group flex items-center gap-1.5 px-3 py-1 rounded-t text-xs cursor-pointer border-t border-x transition ${
                    isActive
                      ? isDark
                        ? 'bg-slate-900 text-white border-slate-700 shadow-sm font-semibold'
                        : 'bg-white text-slate-900 border-slate-300 shadow-sm font-semibold'
                      : isDark
                      ? 'bg-slate-950 text-slate-400 border-transparent hover:text-slate-200'
                      : 'bg-slate-100 text-slate-600 border-transparent hover:text-slate-800'
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
                  <span className="truncate max-w-[130px]">{tab.title}</span>
                  {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              onClick={addSqlTab}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              title="New SQL Query Tab"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runCurrentQuery}
              disabled={isExecuting}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-xs shadow-sm transition active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Run (Ctrl+Enter)</span>
            </button>

            {/* OPEN BUTTON */}
            <div className="relative" ref={openMenuRef}>
              <button
                onClick={() => setShowOpenMenu(!showOpenMenu)}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs shadow-sm transition"
              >
                <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Open</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showOpenMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-84 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col text-xs text-slate-200 overflow-hidden backdrop-blur-md">
                  <div className="p-2 border-b border-slate-800 bg-slate-900/60 space-y-2">
                    <input
                      type="text"
                      placeholder="Search objects to edit in IDE..."
                      value={openSearch}
                      onChange={(e) => setOpenSearch(e.target.value)}
                      autoFocus
                      className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                    {allPlugins.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => openOrActivateItem({ type: 'plugin', id: p.id, name: p.name })}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-slate-900"
                      >
                        <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="truncate">{p.name}.tsx</span>
                      </button>
                    ))}
                    {allTables.map((t) => (
                      <button
                        key={t.name}
                        onClick={() => openOrActivateItem({ type: 'table', name: t.name })}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-slate-900"
                      >
                        <TableIcon className="w-3.5 h-3.5 text-amber-400" />
                        <span className="truncate">{t.name}.sql</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSaveActiveTab}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs shadow-sm transition active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save (Ctrl+S)</span>
            </button>

            {onToggleVSCodeMode && (
              <button
                onClick={onToggleVSCodeMode}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow transition active:scale-95 ml-1"
                title="Switch to Full VS Code Studio Interface (Ctrl+Shift+F)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>VS Code Mode</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. HORIZONTAL BODY (Activity Bar + Primary Side Bar + Monaco Canvas) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* VS CODE ACTIVITY BAR (Vertical Strip, 48px) */}
        {isVSCodeMode && (
          <div className="w-12 bg-[#333333] border-r border-[#252526] flex flex-col items-center justify-between py-2 select-text z-10">
            <div className="flex flex-col items-center gap-3 w-full">
              <button
                onClick={() => {
                  setActiveActivity('explorer');
                  setIsPrimarySidebarOpen(true);
                }}
                className={`p-2.5 rounded transition ${
                  activeActivity === 'explorer' && isPrimarySidebarOpen
                    ? 'border-l-2 border-white text-white bg-[#252526]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Explorer (Ctrl+Shift+E)"
              >
                <Files className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  setActiveActivity('search');
                  setIsPrimarySidebarOpen(true);
                }}
                className={`p-2.5 rounded transition ${
                  activeActivity === 'search' && isPrimarySidebarOpen
                    ? 'border-l-2 border-white text-white bg-[#252526]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Search in Files (Ctrl+Shift+F)"
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  setActiveActivity('extensions');
                  setIsPrimarySidebarOpen(true);
                }}
                className={`p-2.5 rounded transition ${
                  activeActivity === 'extensions' && isPrimarySidebarOpen
                    ? 'border-l-2 border-white text-white bg-[#252526]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Extensions: Prettier, Themes, SQLite (Ctrl+Shift+X)"
              >
                <Puzzle className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  setActiveActivity('debug');
                  setIsPrimarySidebarOpen(true);
                }}
                className={`p-2.5 rounded transition ${
                  activeActivity === 'debug' && isPrimarySidebarOpen
                    ? 'border-l-2 border-white text-white bg-[#252526]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Run & Debug / Diagnostics (Ctrl+Shift+D)"
              >
                <Bug className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  setActiveActivity('settings');
                  setIsPrimarySidebarOpen(true);
                }}
                className={`p-2 rounded text-slate-400 hover:text-white transition ${
                  activeActivity === 'settings' ? 'text-white bg-[#252526]' : ''
                }`}
                title="Settings & Keybindings (Ctrl+,)"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* PRIMARY SIDE BAR (Explorer, Search, Extensions, Debug, Settings) */}
        {isVSCodeMode && isPrimarySidebarOpen && (
          <div className="w-64 bg-[#252526] border-r border-[#1e1e1e] flex flex-col text-xs text-slate-300 select-text overflow-hidden flex-shrink-0">
            {/* Header of Primary Sidebar */}
            <div className="flex items-center justify-between px-4 py-2.5 uppercase tracking-wider text-[11px] font-bold text-slate-300 border-b border-[#333333]">
              <span>
                {activeActivity === 'explorer' && 'Explorer: Workspace'}
                {activeActivity === 'search' && 'Search in Files'}
                {activeActivity === 'extensions' && 'Extensions'}
                {activeActivity === 'debug' && 'Run & Diagnostics'}
                {activeActivity === 'settings' && 'Settings & Shortcuts'}
              </span>
              <button
                onClick={() => setIsPrimarySidebarOpen(false)}
                className="text-slate-400 hover:text-white"
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
                      className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-300 hover:text-white cursor-pointer hover:bg-[#2a2d2e] rounded"
                    >
                      {expandedFolders.plugins ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <Folder className="w-3.5 h-3.5 text-blue-400" />
                      <span>plugins ({allPlugins.length})</span>
                    </div>
                    {expandedFolders.plugins && (
                      <div className="pl-6 space-y-0.5 mt-0.5">
                        {allPlugins.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => openOrActivateItem({ type: 'plugin', id: p.id, name: p.name })}
                            className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-[#2a2d2e] text-slate-300 hover:text-white transition truncate"
                          >
                            <FileCode className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span className="truncate">{p.name}.tsx</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Folder: TABLES */}
                  <div>
                    <div
                      onClick={() => toggleFolder('tables')}
                      className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-300 hover:text-white cursor-pointer hover:bg-[#2a2d2e] rounded"
                    >
                      {expandedFolders.tables ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      <span>tables ({allTables.length})</span>
                    </div>
                    {expandedFolders.tables && (
                      <div className="pl-6 space-y-0.5 mt-0.5">
                        {allTables.map((t) => (
                          <div
                            key={t.name}
                            onClick={() => openOrActivateItem({ type: 'table', name: t.name })}
                            className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-[#2a2d2e] text-slate-300 hover:text-white transition truncate"
                          >
                            <TableIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            <span className="truncate">{t.name}.sql</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Folder: QUERIES */}
                  <div>
                    <div
                      onClick={() => toggleFolder('queries')}
                      className="flex items-center gap-1.5 px-2 py-1 font-semibold text-slate-300 hover:text-white cursor-pointer hover:bg-[#2a2d2e] rounded"
                    >
                      {expandedFolders.queries ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <Folder className="w-3.5 h-3.5 text-cyan-400" />
                      <span>queries ({allQueries.length})</span>
                    </div>
                    {expandedFolders.queries && (
                      <div className="pl-6 space-y-0.5 mt-0.5">
                        {allQueries.map((q) => (
                          <div
                            key={q.id}
                            onClick={() => openOrActivateItem({ type: 'query', id: q.id, name: q.name })}
                            className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-[#2a2d2e] text-slate-300 hover:text-white transition truncate"
                          >
                            <Database className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                            <span className="truncate">{q.name}.sql</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Root Files */}
                  <div className="pt-2 border-t border-[#333333] space-y-0.5">
                    <div
                      onClick={() => openOrActivateItem({ type: 'types' })}
                      className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-[#2a2d2e] text-slate-300 hover:text-white transition truncate"
                    >
                      <FileCode className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      <span>types/gaw.d.ts</span>
                    </div>
                    <div
                      onClick={() => openOrActivateItem({ type: 'json', name: 'package.json' })}
                      className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-[#2a2d2e] text-slate-300 hover:text-white transition truncate"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
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
                      className="w-full px-2.5 py-1.5 bg-[#3c3c3c] border border-[#555] rounded text-slate-100 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {searchQuery ? `${searchResults.length} matches found` : 'Type a query to search codebase'}
                  </div>
                  <div className="space-y-1">
                    {searchResults.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => openOrActivateItem(res.tabItem)}
                        className="p-2 bg-[#1e1e1e] hover:bg-[#2a2d2e] rounded border border-[#333] cursor-pointer text-xs space-y-0.5"
                      >
                        <div className="font-semibold text-blue-400 flex items-center justify-between">
                          <span>{res.file}</span>
                          <span className="text-[10px] text-slate-500 font-mono">Ln {res.line}</span>
                        </div>
                        <p className="text-slate-300 font-mono text-[11px] truncate">{res.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB C: EXTENSIONS */}
              {activeActivity === 'extensions' && (
                <div className="space-y-3">
                  {/* Prettier Extension */}
                  <div className="p-3 bg-[#1e1e1e] border border-indigo-700/60 rounded-xl space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Prettier Formatter</span>
                        </div>
                        <p className="text-[10px] text-emerald-400 font-mono">v3.4.2 Installed & Active</p>
                      </div>
                      <span className="px-1.5 py-0.5 bg-indigo-950 border border-indigo-700/50 rounded text-[9px] text-indigo-300">
                        Default
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Standard opinionated code formatter for TypeScript, TSX, SQL, and JSON.
                    </p>
                    <div className="pt-2 border-t border-[#333] flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formatOnSave}
                          onChange={(e) => {
                            setFormatOnSave(e.target.checked);
                            localStorage.setItem('gaw_format_on_save', String(e.target.checked));
                          }}
                          className="rounded text-indigo-500 focus:ring-0"
                        />
                        <span>Format On Save</span>
                      </label>
                      <button
                        onClick={handleFormatDocument}
                        disabled={isFormatting}
                        className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95"
                      >
                        Format Document (Shift+Alt+F)
                      </button>
                    </div>
                  </div>

                  {/* ESLint Extension */}
                  <div className="p-3 bg-[#1e1e1e] border border-[#333] rounded-xl space-y-1.5">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>ESLint & TS Diagnostics</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Active</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Real-time syntax validator and React TSX compiler lint checks.
                    </p>
                  </div>

                  {/* SQLite Tools Extension */}
                  <div className="p-3 bg-[#1e1e1e] border border-[#333] rounded-xl space-y-1.5">
                    <div className="font-bold text-white flex items-center justify-between">
                      <span>SQLite WASM Inspector</span>
                      <span className="text-[10px] text-indigo-400 font-mono">Active</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Direct engine schema query introspection & performance profiling.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB D: DEBUG / DIAGNOSTICS */}
              {activeActivity === 'debug' && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#1e1e1e] border border-[#333] rounded-xl space-y-2">
                    <span className="font-bold text-white">Compiler Output:</span>
                    {compileStatus.valid ? (
                      <p className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>TSX Syntax Valid</span>
                      </p>
                    ) : (
                      <div className="p-2 bg-red-950/40 border border-red-800 rounded text-red-300 font-mono text-[10px]">
                        {compileStatus.error}
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-[#1e1e1e] border border-[#333] rounded-xl space-y-2">
                    <span className="font-bold text-white">Execution Metrics:</span>
                    <p className="text-slate-400">Last execution rows: {currentResult?.values?.length || 0}</p>
                    <p className="text-slate-400">Time: {currentResult?.execTimeMs || 0} ms</p>
                  </div>
                </div>
              )}

              {/* TAB E: SETTINGS & KEYBINDINGS */}
              {activeActivity === 'settings' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <span className="font-bold text-white text-[11px]">Keyboard Shortcuts:</span>
                    <div className="space-y-1.5">
                      {[
                        ['Ctrl + Shift + F', 'Toggle VS Code / Gawkyy Shell'],
                        ['Shift + Alt + F', 'Format Document (Prettier)'],
                        ['Ctrl + Enter', 'Run Query / Test Plugin'],
                        ['Ctrl + S', 'Save File'],
                        ['Ctrl + Shift + P', 'Command Palette'],
                        ['Ctrl + B', 'Toggle Primary Side Bar'],
                      ].map(([keys, desc], idx) => (
                        <div key={idx} className="p-1.5 bg-[#1e1e1e] rounded border border-[#333] flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">{desc}</span>
                          <kbd className="px-1.5 py-0.5 bg-[#2d2d2d] border border-[#444] rounded font-mono text-slate-200">
                            {keys}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#333]">
                    <span className="font-bold text-white text-[11px]">Editor Preferences:</span>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Font Size:</span>
                      <select
                        value={editorFontSize}
                        onChange={(e) => setEditorFontSize(Number(e.target.value))}
                        className="bg-[#1e1e1e] border border-[#444] rounded px-2 py-0.5 text-xs text-white"
                      >
                        <option value={12}>12 px</option>
                        <option value={13}>13 px</option>
                        <option value={14}>14 px</option>
                        <option value={16}>16 px</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Minimap:</span>
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
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] overflow-hidden">
          {/* VS Code Tab Bar */}
          {isVSCodeMode && (
            <div className="flex items-center bg-[#252526] border-b border-[#1e1e1e] overflow-x-auto text-xs select-text">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`group flex items-center gap-2 px-3 py-2 border-r border-[#1e1e1e] cursor-pointer transition ${
                      isActive
                        ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500 font-medium'
                        : 'bg-[#2d2d2d] text-slate-400 hover:bg-[#252526] hover:text-slate-200'
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
                className="p-2 text-slate-400 hover:text-white hover:bg-[#333333] transition"
                title="New Query Tab"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Monaco Editor Frame */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            <div className={`flex-1 flex flex-col overflow-hidden ${showLivePreview ? 'w-1/2 border-r border-slate-800' : 'w-full'}`}>
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={editorLanguage}
                  theme={isDark ? 'vs-dark' : 'light'}
                  value={activeTab?.content || ''}
                  onChange={(value) => {
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === activeTabId ? { ...t, content: value || '', isDirty: true } : t
                      )
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
                  <div className="h-60 border-t border-[#333333] flex flex-col bg-[#181818]">
                    <div className="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-[#333333] text-xs">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-semibold text-slate-200">Terminal / SQL Output</span>
                        {queryResults.length > 1 && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({queryResults.length} statement outputs)
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setQueryResults([])}
                        className="text-slate-400 hover:text-white"
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
              <div className="flex-1 flex flex-col bg-slate-900 border-l border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950 text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Live Sandboxed Plugin Preview</span>
                  </span>
                  <button
                    onClick={() => setShowLivePreview(false)}
                    className="text-slate-400 hover:text-white"
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

      {/* 4. VS CODE STATUS BAR (Bottom Strip) */}
      {isVSCodeMode && (
        <div className="flex items-center justify-between px-3 py-1 bg-[#007acc] text-white text-[11px] font-sans select-text">
          <div className="flex items-center gap-3">
            <span className="font-semibold flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5" />
              <span>main*</span>
            </span>
            <span className="opacity-80">0 errors, 0 warnings</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleFormatDocument}
              className="flex items-center gap-1 hover:underline cursor-pointer"
              title="Click to format document with Prettier"
            >
              <Sparkles className="w-3 h-3" />
              <span>Prettier: ✓</span>
            </button>

            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
            <span>Spaces: {editorTabSize}</span>
            <span>UTF-8</span>
            <span className="capitalize">{editorLanguage}</span>

            {onToggleVSCodeMode && (
              <button
                onClick={onToggleVSCodeMode}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-800/80 hover:bg-blue-900 text-white font-bold text-[10px] cursor-pointer"
                title="Toggle between VS Code and Gawkyy mode (Ctrl+Shift+F)"
              >
                <span>⚡ VS Code: ON (Ctrl+Shift+F)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. VS CODE COMMAND PALETTE OVERLAY (Ctrl+Shift+P) */}
      {showCommandPalette && (
        <div
          onClick={() => setShowCommandPalette(false)}
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/60 backdrop-blur-xs select-text"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-[#252526] border border-[#454545] rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-slate-200"
          >
            <div className="p-2 border-b border-[#3c3c3c] bg-[#1e1e1e]">
              <input
                type="text"
                autoFocus
                placeholder="> Type a command or file name..."
                value={commandPaletteQuery}
                onChange={(e) => setCommandPaletteQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#3c3c3c] border border-[#555] rounded text-white text-xs focus:outline-none"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-1 divide-y divide-[#333]">
              {commandPaletteItems.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    setShowCommandPalette(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#094771] hover:text-white transition group"
                >
                  <span className="truncate">{cmd.title}</span>
                  {cmd.shortcut && (
                    <kbd className="px-1.5 py-0.5 bg-[#333] group-hover:bg-[#005a9e] border border-[#444] rounded text-[10px] font-mono text-slate-300">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
