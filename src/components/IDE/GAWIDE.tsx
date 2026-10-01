import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'lucide-react';
import { SQLiteEngine } from '../../engine/sqliteEngine';
import { PluginEngine } from '../../engine/pluginEngine';
import { QueryResult, SavedQuery } from '../../types/sqlite';
import { PluginRecord } from '../../types/plugin';
import { QueryGrid } from '../QueryGrid';
import { PluginHost } from '../PluginHost';
import { GAW_TYPES_DECLARATION } from './gawTypesDeclaration';

interface TabItem {
  id: string;
  title: string;
  type: 'sql' | 'plugin';
  content: string;
  isDirty?: boolean;
  pluginId?: string;
  queryId?: string;
}

interface GAWIDEProps {
  initialTab?: { type: 'sql' | 'plugin'; id?: string; code?: string };
  onOpenSpreadsheet?: (data: { columns: string[]; values: any[][] }, sheetName?: string) => void;
  onOpenAI?: () => void;
  theme?: 'vs-dark' | 'vs-light';
  gawContext?: any;
}

export const GAWIDE: React.FC<GAWIDEProps> = ({
  initialTab,
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
          title: 'Query.sql',
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

  // Schema state for autocompletion
  const schema = useMemo(() => engine.getSchema(), [engine]);

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
        schema.forEach((table) => {
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            insertText: table.name,
            detail: `Table (${table.rowCount} rows)`,
            documentation: `Columns: ${table.columns.map((c) => `${c.name} (${c.type})`).join(', ')}`,
            range,
          });

          // Add column names
          table.columns.forEach((col) => {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col.name,
              detail: `${table.name}.${col.name} : ${col.type}`,
              range,
            });
          });
        });

        // Common SQL keywords
        const keywords = [
          'SELECT',
          'FROM',
          'WHERE',
          'INSERT INTO',
          'UPDATE',
          'DELETE FROM',
          'JOIN',
          'LEFT JOIN',
          'INNER JOIN',
          'GROUP BY',
          'ORDER BY',
          'HAVING',
          'LIMIT',
          'COUNT',
          'SUM',
          'AVG',
          'MIN',
          'MAX',
          'ROUND',
          'AS',
          'DESC',
          'ASC',
          'CREATE TABLE',
          'PRAGMA',
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

    // Add keyboard shortcut: Ctrl+Enter / Cmd+Enter to run query
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCurrentQuery();
    });
  };

  // Run Query
  const runCurrentQuery = () => {
    if (!activeTab || activeTab.type !== 'sql') return;
    setIsExecuting(true);

    setTimeout(() => {
      try {
        const results = engine.exec(activeTab.content);
        setQueryResults(results);
        setActiveResultIndex(0);
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

  // Save Plugin or Query
  const handleSaveActiveTab = () => {
    if (!activeTab) return;

    if (activeTab.type === 'plugin' && activeTab.pluginId) {
      // Update t_plugins in SQLite
      const now = new Date().toISOString();
      engine.run('UPDATE t_plugins SET code = ?, updated_at = ? WHERE id = ?', [
        activeTab.content,
        now,
        activeTab.pluginId,
      ]);

      // Invalidate compiled component cache to hot-reload immediately!
      PluginEngine.clearCache(activeTab.pluginId);

      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t))
      );

      // Notify app that plugin has reloaded
      engine.notifyChange();
    } else if (activeTab.type === 'sql') {
      const queryName = activeTab.title.replace(/\.sql$/i, '');
      const existingQueries = engine.getSavedQueries();
      const existing = existingQueries.find((q) => q.name === queryName || q.id === activeTab.queryId);

      const now = new Date().toISOString();
      if (existing) {
        engine.run('UPDATE t_sql_queries SET query = ? WHERE id = ?', [activeTab.content, existing.id]);
      } else {
        const newId = `q_${Date.now()}`;
        engine.run(
          'INSERT INTO t_sql_queries (id, name, description, query, params, layout, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newId, queryName, 'Custom Query saved from IDE', activeTab.content, '{}', '{}', now]
        );
      }

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
                      ? 'bg-slate-900 text-white border-slate-700 shadow-sm'
                      : 'bg-white text-slate-900 border-slate-300 shadow-sm'
                    : isDark
                    ? 'bg-slate-950 text-slate-400 border-transparent hover:text-slate-200'
                    : 'bg-slate-100 text-slate-600 border-transparent hover:text-slate-800'
                }`}
              >
                {tab.type === 'sql' ? (
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="truncate max-w-[120px]">{tab.title}</span>
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
          {activeTab?.type === 'sql' ? (
            <>
              <button
                onClick={runCurrentQuery}
                disabled={isExecuting}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-xs shadow-sm transition disabled:opacity-50"
                title="Execute SQL Query (Ctrl+Enter)"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Run (Ctrl+Enter)</span>
              </button>
              <button
                onClick={handleSaveActiveTab}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs transition"
                title="Save Query to Database"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Query</span>
              </button>
            </>
          ) : (
            <>
              {/* Plugin status */}
              <div className="flex items-center gap-1.5 mr-2">
                {compileStatus.valid ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>TSX Valid</span>
                  </span>
                ) : (
                  <span
                    className="flex items-center gap-1 text-[11px] text-red-400 font-medium truncate max-w-xs"
                    title={compileStatus.error}
                  >
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{compileStatus.error}</span>
                  </span>
                )}
              </div>

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

              <button
                onClick={handleSaveActiveTab}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs shadow-sm transition"
                title="Save TSX code to SQLite t_plugins and reload live"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save & Hot Reload</span>
              </button>
            </>
          )}

          {onOpenAI && (
            <button
              onClick={onOpenAI}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-xs transition"
              title="AI Prompt & Code Generator Assistant"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>AI Prompt Exporter</span>
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
              language={activeTab?.type === 'sql' ? 'sql' : 'typescript'}
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

          {/* Results Panel for SQL Tabs */}
          {activeTab?.type === 'sql' && queryResults.length > 0 && (
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
                    <strong>SQL Execution Error:</strong>
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
