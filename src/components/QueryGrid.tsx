import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Filter,
  Pin,
  PinOff,
  Search,
  Table as TableIcon,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { QueryResult } from '../types/sqlite';

interface QueryGridProps {
  result: QueryResult;
  onOpenInSpreadsheet?: (data: { columns: string[]; values: any[][] }, title?: string) => void;
  title?: string;
  tableName?: string;
  theme?: 'vs-dark' | 'vs-light';
}

interface ColumnFilterState {
  searchTerm: string;
  selectedValues: Set<string>; // for discrete checkbox filter
  numericOp: '' | '=' | '>' | '<' | '>=' | '<=' | 'between';
  numVal1: string;
  numVal2: string;
}

export const QueryGrid: React.FC<QueryGridProps> = ({
  result,
  onOpenInSpreadsheet,
  title,
  tableName,
  theme = 'vs-dark',
}) => {
  const { columns, values, execTimeMs, rowsAffected } = result;

  // Sorting
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Column visibility & freezing
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [frozenColCount, setFrozenColCount] = useState<number>(0);
  const [showColMenu, setShowColMenu] = useState(false);

  // Column Filters
  const [filters, setFilters] = useState<Record<string, ColumnFilterState>>({});
  const [openFilterMenuCol, setOpenFilterMenuCol] = useState<string | null>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Pagination
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(50);

  // Copy notification
  const [copied, setCopied] = useState<boolean>(false);

  // Close filter menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setOpenFilterMenuCol(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute distinct values per column for checkbox filtering
  const distinctValuesByCol = useMemo(() => {
    const map: Record<string, string[]> = {};
    columns.forEach((col, idx) => {
      const set = new Set<string>();
      values.forEach((row) => {
        const val = row[idx];
        set.add(val === null || val === undefined ? '(Blank)' : String(val));
      });
      map[col] = Array.from(set).sort();
    });
    return map;
  }, [columns, values]);

  // Handle Sort Toggle
  const toggleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortCol(null);
      }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Filter & Sort Logic
  const filteredAndSortedRows = useMemo(() => {
    let rows = values.map((valRow, index) => ({ originalIndex: index, row: valRow }));

    // 1. Apply column filters
    Object.entries(filters).forEach(([col, state]) => {
      const colIdx = columns.indexOf(col);
      if (colIdx === -1) return;

      rows = rows.filter(({ row }) => {
        const rawVal = row[colIdx];
        const strVal = rawVal === null || rawVal === undefined ? '(Blank)' : String(rawVal);

        // A. Search term filter
        if (state.searchTerm && !strVal.toLowerCase().includes(state.searchTerm.toLowerCase())) {
          return false;
        }

        // B. Discrete checkbox multi-select
        if (state.selectedValues && state.selectedValues.size > 0) {
          if (!state.selectedValues.has(strVal)) {
            return false;
          }
        }

        // C. Numeric comparison
        if (state.numericOp && state.numVal1 !== '') {
          const num = Number(rawVal);
          const v1 = Number(state.numVal1);
          if (isNaN(num)) return false;

          switch (state.numericOp) {
            case '=':
              if (num !== v1) return false;
              break;
            case '>':
              if (num <= v1) return false;
              break;
            case '<':
              if (num >= v1) return false;
              break;
            case '>=':
              if (num < v1) return false;
              break;
            case '<=':
              if (num > v1) return false;
              break;
            case 'between': {
              const v2 = Number(state.numVal2);
              if (num < v1 || num > v2) return false;
              break;
            }
          }
        }

        return true;
      });
    });

    // 2. Apply Sort
    if (sortCol) {
      const sortIdx = columns.indexOf(sortCol);
      if (sortIdx !== -1) {
        rows.sort((a, b) => {
          const valA = a.row[sortIdx];
          const valB = b.row[sortIdx];

          if (valA === valB) return 0;
          if (valA === null || valA === undefined) return 1;
          if (valB === null || valB === undefined) return -1;

          const numA = Number(valA);
          const numB = Number(valB);

          if (!isNaN(numA) && !isNaN(numB)) {
            return sortDir === 'asc' ? numA - numB : numB - numA;
          }

          const strA = String(valA).toLowerCase();
          const strB = String(valB).toLowerCase();
          return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        });
      }
    }

    return rows;
  }, [columns, values, filters, sortCol, sortDir]);

  // Paginated Rows
  const totalRows = filteredAndSortedRows.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = page * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, page, pageSize]);

  // Visible Columns
  const visibleColumns = useMemo(() => {
    return columns.filter((col) => !hiddenCols.has(col));
  }, [columns, hiddenCols]);

  // Active filters list
  const activeFilters = useMemo(() => {
    return Object.entries(filters).filter(([_, state]) => {
      return (
        state.searchTerm !== '' ||
        (state.selectedValues && state.selectedValues.size > 0 && state.selectedValues.size < (distinctValuesByCol[_]?.length || 0)) ||
        state.numericOp !== ''
      );
    });
  }, [filters, distinctValuesByCol]);

  // Clear Filter helper
  const clearFilter = (col: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[col];
      return next;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
    setSortCol(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    const header = visibleColumns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
    const body = filteredAndSortedRows
      .map(({ row }) =>
        visibleColumns
          .map((c) => {
            const idx = columns.indexOf(c);
            const val = row[idx];
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    const csvContent = `${header}\n${body}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableName || title || 'query_results'}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // Copy JSON
  const handleCopyJSON = () => {
    const jsonRows = filteredAndSortedRows.map(({ row }) => {
      const obj: any = {};
      visibleColumns.forEach((c) => {
        const idx = columns.indexOf(c);
        obj[c] = row[idx];
      });
      return obj;
    });

    navigator.clipboard.writeText(JSON.stringify(jsonRows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open in Spreadsheet
  const handleTransferToSpreadsheet = () => {
    if (onOpenInSpreadsheet) {
      onOpenInSpreadsheet(
        {
          columns: visibleColumns,
          values: filteredAndSortedRows.map(({ row }) =>
            visibleColumns.map((c) => row[columns.indexOf(c)])
          ),
        },
        tableName || title || 'Data View'
      );
    }
  };

  const isDark = theme === 'vs-dark';

  return (
    <div className={`flex flex-col h-full border ${isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} overflow-hidden select-text`}>
      {/* Top Toolbar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'} text-xs`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold">
            <TableIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span>{tableName || title || 'Query Results'}</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
            {totalRows} rows {filteredAndSortedRows.length !== values.length && `(filtered from ${values.length})`}
          </span>
          {execTimeMs !== undefined && (
            <span className="text-[11px] text-slate-400 font-mono">
              ⚡ {execTimeMs} ms
            </span>
          )}
          {rowsAffected !== undefined && (
            <span className="text-[11px] text-emerald-400 font-mono">
              ✓ {rowsAffected} rows affected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Columns Visibility Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(!showColMenu)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs transition ${
                isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Columns ({visibleColumns.length}/{columns.length})</span>
            </button>

            {showColMenu && (
              <div className={`absolute right-0 top-full mt-1 w-52 rounded-lg border shadow-xl z-50 p-2 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}>
                <div className="text-[11px] font-bold pb-1.5 mb-1.5 border-b border-slate-700/50 flex justify-between items-center">
                  <span>Toggle Columns</span>
                  <button
                    onClick={() => setHiddenCols(new Set())}
                    className="text-indigo-400 hover:underline text-[10px]"
                  >
                    Show All
                  </button>
                </div>
                <div className="max-h-48 overflow-auto space-y-1">
                  {columns.map((c) => {
                    const isVisible = !hiddenCols.has(c);
                    return (
                      <label key={c} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-slate-800/40 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => {
                            setHiddenCols((prev) => {
                              const next = new Set(prev);
                              if (isVisible) next.add(c);
                              else next.delete(c);
                              return next;
                            });
                          }}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                        <span className="truncate">{c}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {onOpenInSpreadsheet && (
            <button
              onClick={handleTransferToSpreadsheet}
              title="Send results into interactive Excel-like spreadsheet"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>Open in Spreadsheet</span>
            </button>
          )}

          <button
            onClick={handleCopyJSON}
            title="Copy as JSON"
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs transition ${
              isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Copy className="w-3 h-3" />
            <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            title="Download CSV"
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs transition ${
              isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Download className="w-3 h-3" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeFilters.length > 0 && (
        <div className={`flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b text-[11px] ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
          <span className="text-slate-400 font-medium mr-1">Active Filters:</span>
          {activeFilters.map(([col, state]) => (
            <span
              key={col}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
            >
              <strong>{col}:</strong>
              {state.searchTerm && <span>"{state.searchTerm}"</span>}
              {state.numericOp && <span>{state.numericOp} {state.numVal1} {state.numVal2 && `and ${state.numVal2}`}</span>}
              <button
                onClick={() => clearFilter(col)}
                className="hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs text-red-400 hover:text-red-300 underline ml-2 font-medium"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Data Table with MS Access Grid Styling */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse text-xs">
          <thead className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 text-slate-200 border-b border-slate-700' : 'bg-slate-100 text-slate-800 border-b border-slate-300'}`}>
            <tr>
              {/* Row index header */}
              <th className={`w-10 px-2 py-1.5 text-center font-mono text-[10px] border-r ${isDark ? 'border-slate-700 bg-slate-800/80 text-slate-500' : 'border-slate-200 bg-slate-200/60 text-slate-400'}`}>
                #
              </th>
              {visibleColumns.map((col, idx) => {
                const hasFilter = !!filters[col];
                const isSorted = sortCol === col;
                const isFrozen = idx < frozenColCount;

                return (
                  <th
                    key={col}
                    className={`relative py-1.5 px-3 text-left font-semibold border-r transition ${
                      isDark ? 'border-slate-700 hover:bg-slate-700/80' : 'border-slate-200 hover:bg-slate-200'
                    } ${isFrozen ? 'sticky z-30 left-0 bg-slate-800' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1 group">
                      <div
                        onClick={() => toggleSort(col)}
                        className="flex items-center gap-1.5 cursor-pointer flex-1 truncate"
                        title="Click to sort column"
                      >
                        <span className="truncate">{col}</span>
                        {isSorted && (
                          sortDir === 'asc' ? <ArrowUpAZ className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" /> : <ArrowDownAZ className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        )}
                      </div>

                      {/* Filter Popover Trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFilterMenuCol(openFilterMenuCol === col ? null : col);
                        }}
                        className={`p-1 rounded hover:bg-slate-600/50 transition ${
                          hasFilter ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                        title="Filter column values (Excel/Access style)"
                      >
                        <Filter className={`w-3 h-3 ${hasFilter ? 'fill-indigo-400' : ''}`} />
                      </button>
                    </div>

                    {/* MS Access Filter Dropdown Menu */}
                    {openFilterMenuCol === col && (
                      <div
                        ref={filterMenuRef}
                        className={`absolute left-0 top-full mt-1 w-64 rounded-lg shadow-2xl border z-50 p-3 text-xs font-normal ${
                          isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Sort actions */}
                        <div className="space-y-1 pb-2 border-b border-slate-700/50">
                          <button
                            onClick={() => {
                              setSortCol(col);
                              setSortDir('asc');
                              setOpenFilterMenuCol(null);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition"
                          >
                            <ArrowUpAZ className="w-3.5 h-3.5" />
                            <span>Sort Ascending (A to Z / 0 to 9)</span>
                          </button>
                          <button
                            onClick={() => {
                              setSortCol(col);
                              setSortDir('desc');
                              setOpenFilterMenuCol(null);
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition"
                          >
                            <ArrowDownAZ className="w-3.5 h-3.5" />
                            <span>Sort Descending (Z to A / 9 to 0)</span>
                          </button>
                        </div>

                        {/* Text Search in Column */}
                        <div className="mt-2.5">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search in column..."
                              value={filters[col]?.searchTerm || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFilters((prev) => ({
                                  ...prev,
                                  [col]: {
                                    ...(prev[col] || {
                                      searchTerm: '',
                                      selectedValues: new Set(),
                                      numericOp: '',
                                      numVal1: '',
                                      numVal2: '',
                                    }),
                                    searchTerm: val,
                                  },
                                }));
                              }}
                              className={`w-full pl-7 pr-2 py-1 rounded border text-xs focus:outline-none focus:border-indigo-500 ${
                                isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Distinct Value Checkbox List */}
                        <div className="mt-2">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 pb-1">
                            <span>Distinct Values ({distinctValuesByCol[col]?.length || 0})</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setFilters((prev) => ({
                                    ...prev,
                                    [col]: {
                                      ...(prev[col] || { searchTerm: '', numericOp: '', numVal1: '', numVal2: '' }),
                                      selectedValues: new Set(distinctValuesByCol[col] || []),
                                    },
                                  }));
                                }}
                                className="text-indigo-400 hover:underline"
                              >
                                All
                              </button>
                              <button
                                onClick={() => {
                                  setFilters((prev) => ({
                                    ...prev,
                                    [col]: {
                                      ...(prev[col] || { searchTerm: '', numericOp: '', numVal1: '', numVal2: '' }),
                                      selectedValues: new Set(),
                                    },
                                  }));
                                }}
                                className="text-indigo-400 hover:underline"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className="max-h-32 overflow-auto border rounded p-1 space-y-0.5 border-slate-700/60 bg-slate-950/40">
                            {(distinctValuesByCol[col] || []).map((val) => {
                              const isChecked =
                                !filters[col]?.selectedValues ||
                                filters[col]?.selectedValues.size === 0 ||
                                filters[col]?.selectedValues.has(val);

                              return (
                                <label key={val} className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-slate-800 rounded cursor-pointer text-[11px]">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setFilters((prev) => {
                                        const currentSet = new Set(
                                          prev[col]?.selectedValues && prev[col].selectedValues.size > 0
                                            ? prev[col].selectedValues
                                            : distinctValuesByCol[col] || []
                                        );

                                        if (isChecked) {
                                          currentSet.delete(val);
                                        } else {
                                          currentSet.add(val);
                                        }

                                        return {
                                          ...prev,
                                          [col]: {
                                            ...(prev[col] || { searchTerm: '', numericOp: '', numVal1: '', numVal2: '' }),
                                            selectedValues: currentSet,
                                          },
                                        };
                                      });
                                    }}
                                    className="rounded text-indigo-600 focus:ring-0"
                                  />
                                  <span className="truncate">{val}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Numeric Comparison Section */}
                        <div className="mt-2.5 pt-2 border-t border-slate-700/50">
                          <span className="text-[10px] text-slate-400 font-semibold block mb-1">Numeric Comparison</span>
                          <div className="flex gap-1.5">
                            <select
                              value={filters[col]?.numericOp || ''}
                              onChange={(e) => {
                                const op = e.target.value as any;
                                setFilters((prev) => ({
                                  ...prev,
                                  [col]: {
                                    ...(prev[col] || { searchTerm: '', selectedValues: new Set(), numVal1: '', numVal2: '' }),
                                    numericOp: op,
                                  },
                                }));
                              }}
                              className={`px-1.5 py-1 rounded border text-xs ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                            >
                              <option value="">None</option>
                              <option value="=">=</option>
                              <option value=">">&gt;</option>
                              <option value="<">&lt;</option>
                              <option value=">=">&gt;=</option>
                              <option value="<=">&lt;=</option>
                              <option value="between">Between</option>
                            </select>

                            <input
                              type="number"
                              placeholder="Value"
                              value={filters[col]?.numVal1 || ''}
                              onChange={(e) => {
                                const v1 = e.target.value;
                                setFilters((prev) => ({
                                  ...prev,
                                  [col]: {
                                    ...(prev[col] || { searchTerm: '', selectedValues: new Set(), numericOp: '>' }),
                                    numVal1: v1,
                                  },
                                }));
                              }}
                              className={`w-20 px-1.5 py-1 rounded border text-xs ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                            />

                            {filters[col]?.numericOp === 'between' && (
                              <input
                                type="number"
                                placeholder="To"
                                value={filters[col]?.numVal2 || ''}
                                onChange={(e) => {
                                  const v2 = e.target.value;
                                  setFilters((prev) => ({
                                    ...prev,
                                    [col]: {
                                      ...(prev[col] || { searchTerm: '', selectedValues: new Set(), numericOp: 'between', numVal1: '' }),
                                      numVal2: v2,
                                    },
                                  }));
                                }}
                                className={`w-20 px-1.5 py-1 rounded border text-xs ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                              />
                            )}
                          </div>
                        </div>

                        {/* Clear column filter */}
                        <div className="mt-3 pt-2 border-t border-slate-700/50 flex justify-end">
                          <button
                            onClick={() => {
                              clearFilter(col);
                              setOpenFilterMenuCol(null);
                            }}
                            className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          >
                            Reset Filter
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-200 text-slate-700'}`}>
            {paginatedRows.map(({ row, originalIndex }) => (
              <tr
                key={originalIndex}
                className={`transition ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}
              >
                <td className={`px-2 py-1.5 text-center font-mono text-[10px] border-r ${isDark ? 'border-slate-800 text-slate-500 bg-slate-900/50' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>
                  {page * pageSize + paginatedRows.indexOf(paginatedRows.find((r) => r.originalIndex === originalIndex)!) + 1}
                </td>
                {visibleColumns.map((col) => {
                  const val = row[columns.indexOf(col)];
                  const isNull = val === null || val === undefined;
                  const isNumber = typeof val === 'number';

                  return (
                    <td
                      key={col}
                      className={`px-3 py-1.5 border-r truncate max-w-xs ${isDark ? 'border-slate-800' : 'border-slate-200'} ${
                        isNumber ? 'text-right font-mono' : ''
                      }`}
                    >
                      {isNull ? (
                        <span className="italic text-slate-500 text-[11px]">NULL</span>
                      ) : (
                        String(val)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {paginatedRows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length + 1}
                  className="py-12 text-center text-slate-500 text-xs italic"
                >
                  No rows found matching the current query criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t text-xs ${isDark ? 'bg-slate-950/80 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className={`px-1.5 py-0.5 rounded border text-xs ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300'}`}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
          </select>
          <span className="ml-2 font-mono text-[11px]">
            Showing {totalRows === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalRows)} of {totalRows}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className={`px-2.5 py-1 rounded border text-xs disabled:opacity-40 transition ${
              isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
            }`}
          >
            Previous
          </button>
          <span className="font-mono text-[11px] px-1">
            {page + 1} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className={`px-2.5 py-1 rounded border text-xs disabled:opacity-40 transition ${
              isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
