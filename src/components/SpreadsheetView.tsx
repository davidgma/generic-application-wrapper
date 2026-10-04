import React, { useState, useMemo, useEffect, useRef } from 'react';
import writeXlsxFile from 'write-excel-file/browser';
import readXlsxFile from 'read-excel-file/browser';
import {
  Bold,
  DollarSign,
  Download,
  FileSpreadsheet,
  Italic,
  Percent,
  Plus,
  Trash2,
  Upload,
  X,
  FileDown,
} from 'lucide-react';

export interface SpreadsheetCell {
  raw: string | number | null;
  formatted?: string;
  formula?: string;
  isBold?: boolean;
  isItalic?: boolean;
  textColor?: string;
  bgColor?: string;
  formatType?: 'text' | 'currency' | 'percent' | 'decimal';
}

export interface SheetData {
  id: string;
  name: string;
  rows: number;
  cols: number;
  data: Record<string, SpreadsheetCell>; // key: "row_col", e.g. "0_0" for A1
}

interface SpreadsheetViewProps {
  initialSheets?: Array<{
    name: string;
    columns: string[];
    values: any[][];
  }>;
  onClose?: () => void;
  theme?: 'vs-dark' | 'vs-light';
}

// Convert column index (0-based) to letter (A, B, ..., Z, AA, AB...)
function colToLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Convert letter (A, B, C...) to 0-based column index
function letterToCol(letter: string): number {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
}

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  initialSheets,
  onClose,
  theme = 'vs-dark',
}) => {
  const [sheets, setSheets] = useState<SheetData[]>(() => {
    if (initialSheets && initialSheets.length > 0) {
      return initialSheets.map((s, sIdx) => {
        const sheetData: Record<string, SpreadsheetCell> = {};
        const colCount = Math.max(s.columns.length, 12);
        const rowCount = Math.max(s.values.length + 1, 30);

        // Header row (row 0)
        s.columns.forEach((colName, cIdx) => {
          sheetData[`0_${cIdx}`] = {
            raw: colName,
            isBold: true,
            bgColor: '#1e293b',
            textColor: '#f8fafc',
          };
        });

        // Data rows (rows 1..N)
        s.values.forEach((row, rIdx) => {
          row.forEach((cellVal, cIdx) => {
            const num = Number(cellVal);
            const isNum = !isNaN(num) && cellVal !== '' && cellVal !== null;
            sheetData[`${rIdx + 1}_${cIdx}`] = {
              raw: cellVal,
              formatType: isNum ? 'decimal' : 'text',
            };
          });
        });

        return {
          id: `sheet_${sIdx}`,
          name: s.name || `Sheet${sIdx + 1}`,
          rows: rowCount,
          cols: colCount,
          data: sheetData,
        };
      });
    }

    // Default blank workbook
    return [
      {
        id: 'sheet_1',
        name: 'Sheet1',
        rows: 40,
        cols: 16,
        data: {},
      },
    ];
  });

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const activeSheet = sheets[activeSheetIndex] || sheets[0];

  // Selection
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingCell]);

  // Selected cell key
  const selectedKey = `${selectedCell.row}_${selectedCell.col}`;
  const currentCellObj = activeSheet.data[selectedKey] || { raw: '' };

  // Cell key coordinate helper
  const getCellRaw = (r: number, c: number, sheet = activeSheet): any => {
    return sheet.data[`${r}_${c}`]?.raw ?? null;
  };

  // Evaluate Formulas
  const evaluateCellValue = (cell: SpreadsheetCell | undefined): string => {
    if (!cell || cell.raw === null || cell.raw === undefined) return '';

    const rawStr = String(cell.raw);
    if (!rawStr.startsWith('=')) {
      if (cell.formatType === 'currency') {
        const num = Number(cell.raw);
        return isNaN(num) ? rawStr : `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (cell.formatType === 'percent') {
        const num = Number(cell.raw);
        return isNaN(num) ? rawStr : `${(num * 100).toFixed(1)}%`;
      }
      return rawStr;
    }

    // Formula execution
    try {
      const formula = rawStr.slice(1).toUpperCase().trim();

      // Range functions: SUM, AVERAGE, COUNT, MIN, MAX
      const rangeMatch = formula.match(/^(SUM|AVERAGE|AVG|COUNT|MIN|MAX)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/);
      if (rangeMatch) {
        const [, func, startColLetter, startRowStr, endColLetter, endRowStr] = rangeMatch;
        const startC = letterToCol(startColLetter);
        const endC = letterToCol(endColLetter);
        const startR = parseInt(startRowStr, 10) - 1; // 1-based to 0-based
        const endR = parseInt(endRowStr, 10) - 1;

        const numbers: number[] = [];
        for (let r = Math.min(startR, endR); r <= Math.max(startR, endR); r++) {
          for (let c = Math.min(startC, endC); c <= Math.max(startC, endC); c++) {
            const val = getCellRaw(r, c);
            const num = Number(val);
            if (!isNaN(num) && val !== null && val !== '') {
              numbers.push(num);
            }
          }
        }

        let result = 0;
        if (func === 'SUM') {
          result = numbers.reduce((a, b) => a + b, 0);
        } else if (func === 'AVERAGE' || func === 'AVG') {
          result = numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
        } else if (func === 'COUNT') {
          result = numbers.length;
        } else if (func === 'MIN') {
          result = numbers.length > 0 ? Math.min(...numbers) : 0;
        } else if (func === 'MAX') {
          result = numbers.length > 0 ? Math.max(...numbers) : 0;
        }

        if (cell.formatType === 'currency') {
          return `$${result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return String(Math.round(result * 1000) / 1000);
      }

      // Simple cell reference arithmetic like =A1+B1 or =A1*1.5
      let parsedExpr = formula.replace(/([A-Z]+)(\d+)/g, (_match, colLet, rowStr) => {
        const c = letterToCol(colLet);
        const r = parseInt(rowStr, 10) - 1;
        const val = getCellRaw(r, c);
        const num = Number(val);
        return isNaN(num) ? '0' : String(num);
      });

      // Safely evaluate simple math expressions
      if (/^[0-9+\-*/().\s]+$/.test(parsedExpr)) {
        // eslint-disable-next-line no-eval
        const calc = Function(`'use strict'; return (${parsedExpr})`)();
        if (cell.formatType === 'currency') {
          return `$${Number(calc).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return String(Math.round(Number(calc) * 1000) / 1000);
      }

      return '#VALUE!';
    } catch (e) {
      return '#ERR!';
    }
  };

  // Commit Cell Edit
  const commitEdit = (row: number, col: number, value: string) => {
    const key = `${row}_${col}`;
    setSheets((prev) => {
      const next = [...prev];
      const curSheet = { ...next[activeSheetIndex] };
      const currentCell = curSheet.data[key] || {};

      let parsedRaw: any = value;
      if (!value.startsWith('=')) {
        const num = Number(value);
        if (!isNaN(num) && value.trim() !== '') {
          parsedRaw = num;
        }
      }

      curSheet.data = {
        ...curSheet.data,
        [key]: {
          ...currentCell,
          raw: parsedRaw,
        },
      };
      next[activeSheetIndex] = curSheet;
      return next;
    });
    setEditingCell(null);
  };

  // Format toggles
  const updateSelectedCellFormat = (updates: Partial<SpreadsheetCell>) => {
    setSheets((prev) => {
      const next = [...prev];
      const curSheet = { ...next[activeSheetIndex] };
      const cur = curSheet.data[selectedKey] || { raw: '' };

      curSheet.data = {
        ...curSheet.data,
        [selectedKey]: {
          ...cur,
          ...updates,
        },
      };
      next[activeSheetIndex] = curSheet;
      return next;
    });
  };

  // Add sheet
  const addSheet = () => {
    const newIdx = sheets.length + 1;
    const newSheet: SheetData = {
      id: `sheet_${Date.now()}`,
      name: `Sheet${newIdx}`,
      rows: 40,
      cols: 16,
      data: {},
    };
    setSheets([...sheets, newSheet]);
    setActiveSheetIndex(sheets.length);
  };

  // Add Row
  const addRow = () => {
    setSheets((prev) => {
      const next = [...prev];
      const curSheet = { ...next[activeSheetIndex], rows: next[activeSheetIndex].rows + 5 };
      next[activeSheetIndex] = curSheet;
      return next;
    });
  };

  // Add Column
  const addCol = () => {
    setSheets((prev) => {
      const next = [...prev];
      const curSheet = { ...next[activeSheetIndex], cols: next[activeSheetIndex].cols + 3 };
      next[activeSheetIndex] = curSheet;
      return next;
    });
  };

  // Export to Excel (.xlsx)
  const exportToExcel = async () => {
    try {
      const sheetsData = sheets.map((sheet) => {
        const rows: any[][] = [];
        for (let r = 0; r < sheet.rows; r++) {
          const row: any[] = [];
          let hasContent = false;
          for (let c = 0; c < sheet.cols; c++) {
            const cell = sheet.data[`${r}_${c}`];
            const val = evaluateCellValue(cell);
            if (val !== '') hasContent = true;
            const num = Number(val);
            const isNum = !isNaN(num) && val !== '';
            row.push({
              value: isNum ? num : (val || null),
              fontWeight: cell?.isBold ? 'bold' : undefined,
            });
          }
          if (hasContent || r < 10) {
            rows.push(row);
          }
        }
        return {
          sheet: sheet.name.slice(0, 31),
          data: rows,
        };
      });

      await (writeXlsxFile as any)(sheetsData, {
        fileName: 'gaw_workbook.xlsx',
      });
    } catch (err) {
      console.error('Failed to export Excel:', err);
    }
  };

  // Import Excel (.xlsx / .csv)
  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
        const sheetData: Record<string, SpreadsheetCell> = {};
        let maxCol = 12;

        lines.forEach((line, rIdx) => {
          const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
          if (parts.length > maxCol) maxCol = parts.length;
          parts.forEach((cellVal, cIdx) => {
            const num = Number(cellVal);
            sheetData[`${rIdx}_${cIdx}`] = {
              raw: !isNaN(num) && cellVal !== '' ? num : cellVal,
              isBold: rIdx === 0,
            };
          });
        });

        const newSheet: SheetData = {
          id: `sheet_imp_${Date.now()}`,
          name: file.name.replace(/\.csv$/i, '').slice(0, 31),
          rows: Math.max(lines.length + 10, 30),
          cols: Math.max(maxCol + 4, 16),
          data: sheetData,
        };
        setSheets([newSheet]);
        setActiveSheetIndex(0);
        return;
      }

      // Read .xlsx file - parses all sheets
      const sheetList = await (readXlsxFile as any)(file);
      const importedSheets: SheetData[] = [];

      sheetList.forEach((sheetObj: any, sIdx: number) => {
        const sheetRows: any[][] = sheetObj.data || [];
        const sheetData: Record<string, SpreadsheetCell> = {};
        let maxCol = 12;

        sheetRows.forEach((row: any[], rIdx: number) => {
          if (row.length > maxCol) maxCol = row.length;
          row.forEach((cellVal: any, cIdx: number) => {
            if (cellVal !== null && cellVal !== undefined) {
              sheetData[`${rIdx}_${cIdx}`] = {
                raw: cellVal instanceof Date ? cellVal.toISOString().split('T')[0] : cellVal,
                isBold: rIdx === 0,
              };
            }
          });
        });

        importedSheets.push({
          id: `sheet_imp_${sIdx}_${Date.now()}`,
          name: sheetObj.sheet || `Sheet ${sIdx + 1}`,
          rows: Math.max(sheetRows.length + 10, 30),
          cols: Math.max(maxCol + 4, 16),
          data: sheetData,
        });
      });

      if (importedSheets.length > 0) {
        setSheets(importedSheets);
        setActiveSheetIndex(0);
      }
    } catch (err) {
      console.error('Failed to import Excel:', err);
    }
  };

  const isDark = theme === 'vs-dark';

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} overflow-hidden select-text`}>
      {/* Top Toolbar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300'} text-xs`}>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          <span className="font-bold text-sm">Gawkyy Interactive Spreadsheet</span>
        </div>

        {/* Formatting controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => updateSelectedCellFormat({ isBold: !currentCellObj.isBold })}
            className={`p-1.5 rounded transition ${currentCellObj.isBold ? 'bg-indigo-600 text-white' : isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200'}`}
            title="Bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => updateSelectedCellFormat({ isItalic: !currentCellObj.isItalic })}
            className={`p-1.5 rounded transition ${currentCellObj.isItalic ? 'bg-indigo-600 text-white' : isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200'}`}
            title="Italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Number Formats */}
          <button
            onClick={() => updateSelectedCellFormat({ formatType: currentCellObj.formatType === 'currency' ? 'text' : 'currency' })}
            className={`p-1.5 rounded transition ${currentCellObj.formatType === 'currency' ? 'bg-emerald-600 text-white' : isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200'}`}
            title="Currency Format ($)"
          >
            <DollarSign className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => updateSelectedCellFormat({ formatType: currentCellObj.formatType === 'percent' ? 'text' : 'percent' })}
            className={`p-1.5 rounded transition ${currentCellObj.formatType === 'percent' ? 'bg-indigo-600 text-white' : isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200'}`}
            title="Percentage Format (%)"
          >
            <Percent className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Add Rows / Columns */}
          <button
            onClick={addRow}
            className={`px-2 py-1 rounded border text-xs ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-200'}`}
            title="Add 5 more rows"
          >
            + Row
          </button>
          <button
            onClick={addCol}
            className={`px-2 py-1 rounded border text-xs ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-200'}`}
            title="Add 3 more columns"
          >
            + Col
          </button>
        </div>

        {/* Import & Export */}
        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs cursor-pointer ${isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-200'}`}>
            <Upload className="w-3 h-3" />
            <span>Import Excel</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} className="hidden" />
          </label>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition"
          >
            <Download className="w-3 h-3" />
            <span>Export .xlsx</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Formula Bar */}
      <div className={`flex items-center gap-2 px-3 py-1.5 border-b text-xs ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
        <span className="font-mono font-bold w-12 text-indigo-400 px-1 text-center bg-slate-800/80 py-0.5 rounded border border-slate-700">
          {colToLetter(selectedCell.col)}{selectedCell.row + 1}
        </span>
        <span className="text-slate-500 font-mono">fx</span>
        <input
          type="text"
          value={editingCell ? editValue : String(currentCellObj.raw ?? '')}
          onChange={(e) => {
            if (!editingCell) {
              setEditingCell(selectedCell);
            }
            setEditValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitEdit(selectedCell.row, selectedCell.col, editValue);
            } else if (e.key === 'Escape') {
              setEditingCell(null);
            }
          }}
          placeholder="Enter formula e.g. =SUM(A1:A10), =A1*1.2 or plain value"
          className={`flex-1 px-2.5 py-0.5 rounded border text-xs font-mono focus:outline-none focus:border-indigo-500 ${isDark ? 'bg-slate-950 border-slate-700 text-slate-100' : 'bg-white border-slate-300'}`}
        />
      </div>

      {/* Grid Canvas */}
      <div className="flex-1 overflow-auto relative">
        <table className="border-collapse text-xs table-fixed">
          <thead>
            <tr className={`sticky top-0 z-20 ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
              {/* Corner */}
              <th className={`w-12 h-6 border-b border-r text-center text-[10px] font-mono sticky left-0 z-30 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-200'}`}></th>
              {Array.from({ length: activeSheet.cols }).map((_, cIdx) => (
                <th
                  key={cIdx}
                  className={`w-28 h-6 border-b border-r text-center font-mono text-[11px] font-semibold ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
                >
                  {colToLetter(cIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: activeSheet.rows }).map((_, rIdx) => (
              <tr key={rIdx}>
                {/* Row Header */}
                <td className={`w-12 h-6 border-b border-r text-center font-mono text-[10px] sticky left-0 z-10 ${isDark ? 'border-slate-800 bg-slate-800/90 text-slate-400' : 'border-slate-300 bg-slate-100 text-slate-500'}`}>
                  {rIdx + 1}
                </td>
                {/* Data Cells */}
                {Array.from({ length: activeSheet.cols }).map((_, cIdx) => {
                  const key = `${rIdx}_${cIdx}`;
                  const cell = activeSheet.data[key];
                  const isSelected = selectedCell.row === rIdx && selectedCell.col === cIdx;
                  const isEditing = editingCell?.row === rIdx && editingCell?.col === cIdx;
                  const displayValue = evaluateCellValue(cell);

                  return (
                    <td
                      key={cIdx}
                      onClick={() => {
                        setSelectedCell({ row: rIdx, col: cIdx });
                        setEditingCell(null);
                      }}
                      onDoubleClick={() => {
                        setSelectedCell({ row: rIdx, col: cIdx });
                        setEditingCell({ row: rIdx, col: cIdx });
                        setEditValue(String(cell?.raw ?? ''));
                      }}
                      className={`w-28 h-6 px-2 border-b border-r truncate relative transition-colors ${
                        isDark ? 'border-slate-800' : 'border-slate-200'
                      } ${isSelected ? 'ring-2 ring-indigo-500 z-10 bg-indigo-950/30' : ''}`}
                      style={{
                        fontWeight: cell?.isBold ? 'bold' : 'normal',
                        fontStyle: cell?.isItalic ? 'italic' : 'normal',
                        backgroundColor: cell?.bgColor || undefined,
                        color: cell?.textColor || undefined,
                      }}
                    >
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(rIdx, cIdx, editValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              commitEdit(rIdx, cIdx, editValue);
                              setSelectedCell({ row: Math.min(rIdx + 1, activeSheet.rows - 1), col: cIdx });
                            } else if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          className={`absolute inset-0 w-full h-full px-2 text-xs font-mono border-none outline-none ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}`}
                        />
                      ) : (
                        <span>{displayValue}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet Tabs Bar */}
      <div className={`flex items-center justify-between px-2 py-1 border-t text-xs ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-200 border-slate-300'}`}>
        <div className="flex items-center gap-1 overflow-x-auto">
          {sheets.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSheetIndex(idx);
                setSelectedCell({ row: 0, col: 0 });
                setEditingCell(null);
              }}
              className={`px-3 py-1 rounded-t text-xs font-medium border-t border-x transition ${
                activeSheetIndex === idx
                  ? isDark
                    ? 'bg-slate-900 text-white border-slate-700 shadow-sm'
                    : 'bg-white text-slate-900 border-slate-300 shadow-sm'
                  : isDark
                  ? 'bg-slate-950 text-slate-400 border-transparent hover:text-slate-200'
                  : 'bg-slate-200 text-slate-600 border-transparent hover:text-slate-800'
              }`}
            >
              {s.name}
            </button>
          ))}
          <button
            onClick={addSheet}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Add Sheet Tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-mono pr-2">
          {activeSheet.rows} R × {activeSheet.cols} C
        </div>
      </div>
    </div>
  );
};
