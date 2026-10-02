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
  FileSpreadsheet,
  Layers,
  HelpCircle,
  FolderOpen,
  ChevronDown,
  Table as TableIcon,
  FileText,
  Search,
} from 'lucide-react';
import { SQLiteEngine } from '../../engine/sqliteEngine';
import { PluginEngine } from '../../engine/pluginEngine';
import { QueryResult, SavedQuery, TableSchema } from '../../types/sqlite';
import { PluginRecord } from '../../types/plugin';
import { SavedReport } from '../../types/report';
import { QueryGrid } from '../QueryGrid';
import { PluginHost } from '../PluginHost';
import { GAW_TYPES_DECLARATION } from './gawTypesDeclaration';

export interface TabItem {
  id: string;
  title: string;
  type: 'sql' | 'plugin' | 'table' | 'query' | 'report';
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
  onOpenSpreadsheet?: (data: { columns: string[]; values: any[][] }, sheetName?: string) => void;
  onOpenAI?: () => void;
  theme?: 'vs-dark' | 'vs-light';
  gawContext?: any;
}

export const GAWIDE: React.FC<GAWIDEProps> = ({
  initialTab,
  targetTab,
  onOpenSpreadsheet,
  onOpenAI,
  theme = 'vs-dark',
  gawContext,
}) => {
  const engine = SQLiteEngine.getInstance();

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
    // Default open tabs: 1 SQL tab and 1 TSX plugin tab
    const defaultPlugins = engine.getPlugins();
    const firstP = defaultPlugins[0];
    return [
      {
        id: 'tab_sql_1',
        title: 'Executive_Query.sql',
        type: 'sql',
        content:
          '-- Multi-part analytical query (separated by semicolons)\nSELECT COUNT(*) AS total_customers, (SELECT COUNT(*) FROM orders) AS total_orders, (SELECT ROUND(SUM(total_amount), 2) FROM orders) AS gross_revenue FROM customers;\n\nSELECT status, COUNT(*) AS order_count, ROUND(SUM(total_amount), 2) AS status_revenue FROM orders GROUP BY status;\n\nSELECT c.name AS category_name, COUNT(p.id) AS product_count, SUM(p.units_in_stock) AS total_inventory FROM categories c LEFT JOIN products p ON c.id = p.category_id GROUP BY c.id;',
      },
      ...(firstP
        ? [
            {
              id: `tab_plugin_${firstP.id}`,
              title: `${firstP.name}.tsx`,
              type: 'plugin' as const,
              content: firstP.code,
              pluginId: firstP.id,
            },
          ]
        : []),
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

  // Open Modal / Dropdown State
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

  // Schema state for autocompletion
  const schema = useMemo(() => engine.getSchema(), [engine]);

  // Open or Activate an item in a tab
  const openOrActivateItem = useCallback(
    (item: TargetTabInfo) => {
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
      } else if (item.type === 'sql') {
        tabId = item.id || (item.name ? `tab_sql_${item.name}` : 'tab_sql_default');
        title = item.name ? `${item.name}.sql` : 'Query.sql';
        content = item.code || 'SELECT * FROM customers LIMIT 25;';
      }

      if (!tabId) return;

      // Check if tab already exists without depending on tabs in callback
      setTabs((prev) => {
        const existing = prev.find((t) => t.id === tabId);
        if (existing) {
          return prev;
        }
        const newTab: TabItem = {
          id: tabId,
          title,
          type: item.type,
          content,
          pluginId: item.type === 'plugin' ? item.id : undefined,
          tableName: item.type === 'table' ? item.name : undefined,
          queryId: item.type === 'query' ? item.id : undefined,
          reportId: item.type === 'report' ? item.id : undefined,
        };
        return [...prev, newTab];
      });
      setActiveTabId(tabId);
      setShowOpenMenu(false);
    },
    [engine]
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

  // Setup Monaco completion providers on mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
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

        // Add table names
        schema.forEach((t) => {
          suggestions.push({
            label: t.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: t.name,
            detail: `Table (${t.rowCount} rows)`,
            range,
          });

          // Add column names
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

        // Common SQL keywords
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

    // Keyboard Shortcuts: Ctrl+Enter (Run), Ctrl+S (Save)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCurrentQuery();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveActiveTab();
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

  // Save Plugin, Table DDL, Query, or Report
  const handleSaveActiveTab = () => {
    if (!activeTab) return;

    if (activeTab.type === 'plugin' && activeTab.pluginId) {
      const now = new Date().toISOString();
      engine.run('UPDATE t_plugins SET code = ?, updated_at = ? WHERE id = ?', [
        activeTab.content,
        now,
        activeTab.pluginId,
      ]);
      PluginEngine.clearCache(activeTab.pluginId);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t))
      );
      engine.notifyChange();
    } else if (activeTab.type === 'table') {
      try {
        const results = engine.exec(activeTab.content);
        setQueryResults(results);
        setActiveResultIndex(0);
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t))
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
        const parsed = JSON.parse(activeTab.content);
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
          prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t))
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
        engine.run('UPDATE t_sql_queries SET query = ? WHERE id = ?', [activeTab.content, existing.id]);
      } else {
        const newId = activeTab.queryId || `q_${Date.now()}`;
        engine.run(
          'INSERT INTO t_sql_queries (id, name, description, query, params, layout, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newId, queryName, 'Custom Query saved from IDE', activeTab.content, '{}', '{}', now]
        );
      }
      engine.notifyChange();
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t))
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

  // Active query result to render
  const currentResult = queryResults[activeResultIndex] || queryResults[0];

  const isDark = theme === 'vs-dark';

  // Available objects for Open Menu
  const allPlugins = useMemo(() => engine.getPlugins(), [engine, tabs]);
  const allTables = useMemo(
    () => engine.getSchema().filter((t) => !t.isSystem && !engine.isSystemTable(t.name)),
    [engine, tabs]
  );
  const allQueries = useMemo(() => engine.getSavedQueries(), [engine, tabs]);
  const allReports = useMemo(() => engine.getSavedReports(), [engine, tabs]);

  const filteredOpenItems = useMemo(() => {
    const q = openSearch.toLowerCase().trim();
    const items: Array<{
      category: 'Plugins' | 'Tables' | 'Queries' | 'Reports';
      type: 'plugin' | 'table' | 'query' | 'report';
      id: string;
      name: string;
      subtitle: string;
    }> = [];

    if (openFilter === 'all' || openFilter === 'plugins') {
      allPlugins.forEach((p) => {
        if (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) {
          items.push({
            category: 'Plugins',
            type: 'plugin',
            id: p.id,
            name: p.name,
            subtitle: `TSX Plugin v${p.version} • ${p.menu_category}`,
          });
        }
      });
    }

    if (openFilter === 'all' || openFilter === 'tables') {
      allTables.forEach((t) => {
        if (!q || t.name.toLowerCase().includes(q)) {
          items.push({
            category: 'Tables',
            type: 'table',
            id: t.name,
            name: t.name,
            subtitle: `Table Schema DDL • ${t.rowCount} rows • ${t.columns.length} columns`,
          });
        }
      });
    }

    if (openFilter === 'all' || openFilter === 'queries') {
      allQueries.forEach((query) => {
        if (!q || query.name.toLowerCase().includes(q) || query.description.toLowerCase().includes(q)) {
          items.push({
            category: 'Queries',
            type: 'query',
            id: query.id,
            name: query.name,
            subtitle: `Saved SQL Query • ${query.id}`,
          });
        }
      });
    }

    if (openFilter === 'all' || openFilter === 'reports') {
      allReports.forEach((r) => {
        if (!q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)) {
          items.push({
            category: 'Reports',
            type: 'report',
            id: r.id,
            name: r.name,
            subtitle: `Report Definition JSON • ${r.id}`,
          });
        }
      });
    }

    return items;
  }, [openSearch, openFilter, allPlugins, allTables, allQueries, allReports]);

  // Tab editor language
  const editorLanguage = useMemo(() => {
    if (activeTab?.type === 'plugin') return 'typescript';
    if (activeTab?.type === 'report') return 'json';
    return 'sql';
  }, [activeTab?.type]);

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} overflow-hidden select-none`}>
      {/* Top IDE Command Bar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'} text-xs`}>
        {/* Tab Headers */}
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

        {/* IDE Action Buttons */}
        <div className="flex items-center gap-2">
          {/* 1. RUN BUTTON */}
          <button
            onClick={runCurrentQuery}
            disabled={isExecuting}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-xs shadow-sm transition disabled:opacity-50 active:scale-[0.98]"
            title={
              activeTab?.type === 'plugin'
                ? 'Compile TSX and preview plugin'
                : activeTab?.type === 'report'
                ? 'Validate report JSON and run query'
                : 'Execute SQL (Ctrl+Enter)'
            }
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>
              {activeTab?.type === 'plugin'
                ? 'Compile & Run'
                : activeTab?.type === 'report'
                ? 'Test Query'
                : 'Run (Ctrl+Enter)'}
            </span>
          </button>

          {/* 2. OPEN DROPDOWN (Directly next to Run button) */}
          <div className="relative" ref={openMenuRef}>
            <button
              onClick={() => setShowOpenMenu(!showOpenMenu)}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs shadow-sm transition active:scale-[0.98]"
              title="Open any part of the app (Plugin, Table, Query, Report) in the IDE"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showOpenMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Floating Open Menu Modal */}
            {showOpenMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-84 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col text-xs text-slate-200 overflow-hidden backdrop-blur-md">
                <div className="p-2 border-b border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search objects to edit in IDE..."
                      value={openSearch}
                      onChange={(e) => setOpenSearch(e.target.value)}
                      autoFocus
                      className="w-full pl-8 pr-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  {/* Category Filter Pills */}
                  <div className="flex gap-1 overflow-x-auto text-[10px]">
                    {(['all', 'plugins', 'tables', 'queries', 'reports'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setOpenFilter(cat)}
                        className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                          openFilter === cat
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
                  {filteredOpenItems.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs">
                      No matching objects found.
                    </div>
                  ) : (
                    filteredOpenItems.map((item) => (
                      <button
                        key={`${item.type}_${item.id}`}
                        onClick={() =>
                          openOrActivateItem({
                            type: item.type,
                            id: item.id,
                            name: item.name,
                          })
                        }
                        className="w-full flex items-start gap-2.5 px-2.5 py-1.5 rounded text-left hover:bg-slate-900 hover:text-white transition group"
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {item.type === 'plugin' && <FileCode className="w-3.5 h-3.5 text-emerald-400" />}
                          {item.type === 'table' && <TableIcon className="w-3.5 h-3.5 text-amber-400" />}
                          {item.type === 'query' && <Database className="w-3.5 h-3.5 text-indigo-400" />}
                          {item.type === 'report' && <FileText className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-200 group-hover:text-white truncate">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{item.subtitle}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. SAVE BUTTON */}
          <button
            onClick={handleSaveActiveTab}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs shadow-sm transition active:scale-[0.98]"
            title={
              activeTab?.type === 'plugin'
                ? 'Save TSX code to SQLite t_plugins and hot-reload'
                : activeTab?.type === 'table'
                ? 'Execute schema alterations on table'
                : activeTab?.type === 'report'
                ? 'Save Report configuration to SQLite'
                : 'Save Query (Ctrl+S)'
            }
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {activeTab?.type === 'plugin'
                ? 'Save & Reload'
                : activeTab?.type === 'table'
                ? 'Apply Schema'
                : 'Save'}
            </span>
          </button>

          {/* Plugin specific preview button */}
          {activeTab?.type === 'plugin' && (
            <button
              onClick={() => setShowLivePreview(!showLivePreview)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs transition ${
                showLivePreview ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 hover:bg-slate-800 text-slate-300'
              }`}
              title="Toggle live split preview of this dynamic plugin"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showLivePreview ? 'Hide Preview' : 'Live Preview'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor & Split Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Editor Main Canvas */}
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
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                tabSize: 2,
                suggestOnTriggerCharacters: true,
              }}
            />
          </div>

          {/* Results Panel for SQL & Query & Report Tabs */}
          {(activeTab?.type === 'sql' || activeTab?.type === 'table' || activeTab?.type === 'query' || activeTab?.type === 'report') &&
            queryResults.length > 0 && (
              <div className="h-64 border-t border-slate-800 flex flex-col bg-slate-950">
                {/* Multi-part Query Results Tabs */}
                {queryResults.length > 1 && (
                  <div className="flex items-center gap-1 px-3 py-1 border-b border-slate-800 bg-slate-900/80 overflow-x-auto text-xs">
                    <span className="text-[11px] text-slate-400 mr-2 font-semibold">
                      Multi-Statement Outputs:
                    </span>
                    {queryResults.map((res, rIdx) => (
                      <button
                        key={rIdx}
                        onClick={() => setActiveResultIndex(rIdx)}
                        className={`px-2.5 py-0.5 rounded text-xs transition font-mono ${
                          activeResultIndex === rIdx
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Statement #{rIdx + 1} ({res.values.length} rows)
                      </button>
                    ))}
                  </div>
                )}

                {/* Result Grid Display */}
                <div className="flex-1 min-h-0">
                  {currentResult.error ? (
                    <div className="p-4 text-xs font-mono text-red-400 bg-red-950/20 h-full overflow-auto">
                      <strong>Execution Error:</strong>
                      <p className="mt-1">{currentResult.error}</p>
                      {currentResult.sqlQuery && (
                        <p className="mt-2 text-slate-500 font-mono">Statement: {currentResult.sqlQuery}</p>
                      )}
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

        {/* Live Preview Panel for TSX Plugin */}
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
  );
};
