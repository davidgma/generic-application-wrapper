import React from 'react';
import {
  ArrowLeft,
  Code2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  Database,
  Layers,
} from 'lucide-react';
import { QueryResult, SavedQuery } from '../types/sqlite';
import { QueryGrid } from './QueryGrid';

interface MultiQueryResultsViewProps {
  savedQuery: SavedQuery | null;
  results: QueryResult[];
  title: string;
  theme: 'vs-dark' | 'vs-light';
  onOpenInIDE: (tab?: { type: 'query'; id: string; name: string }) => void;
  onOpenSpreadsheet: (data?: { columns: string[]; values: any[][] }, sheetName?: string) => void;
  onBackToView: () => void;
  onRerunQuery?: () => void;
}

export const MultiQueryResultsView: React.FC<MultiQueryResultsViewProps> = ({
  savedQuery,
  results,
  title,
  theme,
  onOpenInIDE,
  onOpenSpreadsheet,
  onBackToView,
  onRerunQuery,
}) => {
  const isDark = theme === 'vs-dark';

  return (
    <div className={`flex-1 flex flex-col overflow-hidden select-text ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Top Action & Navigation Header */}
      <div className={`px-4 py-2 border-b flex items-center justify-between text-xs flex-shrink-0 ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBackToView}
            className={`flex items-center gap-1 font-medium transition ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-black'
            }`}
            title="Back to View Hub"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>View</span>
          </button>
          <span className="text-slate-500">/</span>
          <span className="font-bold truncate text-sm">{title.replace(/\.sql$/i, '')}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
            results.length > 1
              ? isDark ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/50' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
          }`}>
            {results.length} {results.length === 1 ? 'statement' : 'statements'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onRerunQuery && (
            <button
              onClick={onRerunQuery}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition text-xs font-medium border ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs'
              }`}
              title="Re-run query statements"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-run</span>
            </button>
          )}

          <button
            onClick={() => {
              if (savedQuery) {
                onOpenInIDE({ type: 'query', id: savedQuery.id, name: savedQuery.name });
              } else {
                onOpenInIDE();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition active:scale-95"
            title="Edit this query in Monaco IDE (Ctrl+Shift+F)"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Edit Query in IDE</span>
            <kbd className="opacity-80 text-[10px] px-1 bg-black/30 rounded border border-white/20 font-mono ml-0.5">
              Ctrl+Shift+F
            </kbd>
          </button>
        </div>
      </div>

      {/* Main Results Container: Single or Multiple Statement Results */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
        {results.length === 0 ? (
          <div className={`p-8 text-center rounded-xl border ${isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>
            <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No statements were executed.</p>
          </div>
        ) : (
          results.map((res, index) => {
            const hasError = !!res.error || (res.columns.length === 1 && res.columns[0] === 'error');
            const errorMessage = res.error || (hasError && res.values?.[0]?.[0] ? String(res.values[0][0]) : null);
            const isMutationOnly = !hasError && res.columns.length === 2 && res.columns[0] === 'status' && res.columns[1] === 'rows_affected';
            const hasTableData = !hasError && !isMutationOnly && res.columns.length > 0;

            return (
              <div
                key={index}
                className={`rounded-xl border shadow-sm overflow-hidden flex flex-col ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                {/* Statement Header */}
                <div className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs font-sans ${
                  isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                      isDark ? 'bg-blue-900/60 text-blue-300 border border-blue-700/60' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {index + 1}
                    </span>
                    {results.length > 1 && (
                      <span className="font-semibold text-xs opacity-75">
                        Query {index + 1} of {results.length}
                      </span>
                    )}
                    {res.sqlQuery && (
                      <code className={`px-2 py-0.5 rounded text-[11px] font-mono truncate max-w-md ${
                        isDark ? 'bg-slate-950 text-slate-300 border border-slate-800' : 'bg-slate-200 text-slate-800 border border-slate-300'
                      }`} title={res.sqlQuery}>
                        {res.sqlQuery}
                      </code>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {res.execTimeMs !== undefined && (
                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {res.execTimeMs} ms
                      </span>
                    )}
                    {res.rowsAffected !== undefined && (
                      <span className="text-[11px] text-emerald-500 font-mono">
                        ✓ {res.rowsAffected} affected
                      </span>
                    )}
                    {hasTableData && (
                      <span className="text-[11px] font-mono opacity-75">
                        {res.values.length} rows
                      </span>
                    )}
                  </div>
                </div>

                {/* Statement Content */}
                <div className="flex-1 min-h-0">
                  {/* Case 1: Error Message */}
                  {hasError && (
                    <div className="p-4 flex items-start gap-3 bg-red-950/20 text-red-400 border-l-4 border-red-500">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
                      <div className="space-y-1">
                        <div className="font-semibold text-xs text-red-300">Statement Execution Error</div>
                        <div className="text-xs font-mono break-all">{errorMessage}</div>
                        {res.sqlQuery && (
                          <div className={`mt-2 p-2 rounded text-[11px] font-mono overflow-x-auto ${isDark ? 'bg-black/40 text-slate-400' : 'bg-slate-100 text-slate-700'}`}>
                            {res.sqlQuery}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Case 2: Mutation / No Table Output (e.g. INSERT, UPDATE, DROP, CREATE) */}
                  {isMutationOnly && (
                    <div className="p-4 flex items-center gap-3 bg-emerald-950/20 text-emerald-400 border-l-4 border-emerald-500">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                      <div className="space-y-0.5">
                        <div className="font-semibold text-xs text-emerald-300">Executed Successfully</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {res.rowsAffected !== undefined ? `${res.rowsAffected} rows modified.` : 'Query completed with no rows returned.'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case 3: Table Results */}
                  {hasTableData && (
                    <div className={results.length > 1 ? 'h-[360px] flex flex-col' : 'min-h-[420px] flex flex-col'}>
                      <QueryGrid
                        result={res}
                        title={results.length > 1 ? `${title} (Statement #${index + 1})` : title}
                        onOpenInSpreadsheet={onOpenSpreadsheet}
                        theme={theme}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
