import React, { useMemo, useState } from 'react';
import { Printer, Download, Edit3, RefreshCw, ChevronLeft, Sparkles } from 'lucide-react';
import { SQLiteEngine } from '../engine/sqliteEngine';
import { SavedReport, ReportConfig } from '../types/report';
import { QueryResult } from '../types/sqlite';

interface ReportViewerProps {
  report: SavedReport;
  onEdit?: () => void;
  onBack?: () => void;
  theme?: 'vs-dark' | 'vs-light';
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  report,
  onEdit,
  onBack,
  theme = 'vs-dark',
}) => {
  const engine = SQLiteEngine.getInstance();
  const [refreshKey, setRefreshKey] = useState(0);

  // Parse config
  const config: ReportConfig = useMemo(() => {
    try {
      return JSON.parse(report.config);
    } catch (e) {
      return {
        companyName: 'Company Name',
        reportTitle: report.name,
        subtitle: report.description,
        preparedBy: 'GAW Analytics',
        kpiCards: [],
        charts: [],
        tables: [],
      };
    }
  }, [report.config]);

  // Execute report queries
  const queryResults: QueryResult[] = useMemo(() => {
    // If report has query_id, retrieve it from t_sql_queries
    let sqlToRun = report.custom_sql;
    if (!sqlToRun && report.query_id) {
      const savedQueries = engine.getSavedQueries();
      const q = savedQueries.find((sq) => sq.id === report.query_id);
      if (q) sqlToRun = q.query;
    }

    if (!sqlToRun) return [];
    try {
      return engine.exec(sqlToRun);
    } catch (err: any) {
      return [{ columns: ['error'], values: [[err.message]] }];
    }
  }, [report, refreshKey, engine]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto">
      {/* Non-printing Control Bar */}
      <div className="print:hidden print-hidden flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950/80 sticky top-0 z-30 backdrop-blur">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-sm font-bold text-white">{report.name}</h1>
            <p className="text-[11px] text-slate-400">{report.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Data</span>
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Customize Report</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Report Canvas */}
      <div className="flex-1 p-6 sm:p-10 flex justify-center">
        <div className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl p-8 sm:p-12 print:p-0 print:shadow-none print:w-full print:max-w-none print:rounded-none">
          {/* Header Branding */}
          <div className="border-b-2 border-slate-900 pb-6 mb-8 flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="text-xs uppercase font-extrabold tracking-widest text-indigo-700">
                {config.companyName || 'Northwind Global Corp'}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight">
                {config.reportTitle || report.name}
              </h1>
              {config.subtitle && (
                <p className="text-sm text-slate-600 mt-1 font-medium">{config.subtitle}</p>
              )}
            </div>

            <div className="text-right text-xs text-slate-600 space-y-1">
              <div>
                <span className="text-slate-400">Date Generated: </span>
                <span className="font-semibold text-slate-800">
                  {new Date().toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {config.periodText && (
                <div>
                  <span className="text-slate-400">Reporting Period: </span>
                  <span className="font-semibold text-slate-800">{config.periodText}</span>
                </div>
              )}
              {config.preparedBy && (
                <div>
                  <span className="text-slate-400">Prepared by: </span>
                  <span className="font-semibold text-slate-800">{config.preparedBy}</span>
                </div>
              )}
              <div>
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-300 uppercase tracking-wider">
                  Official Record
                </span>
              </div>
            </div>
          </div>

          {/* KPI Highlight Cards */}
          {config.kpiCards && config.kpiCards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {config.kpiCards.map((kpi) => {
                const targetRes = queryResults[kpi.queryIndex || 0];
                let displayVal = '—';

                if (targetRes && targetRes.values.length > 0) {
                  const colIdx = targetRes.columns.indexOf(kpi.valueColumn);
                  if (colIdx !== -1) {
                    const raw = targetRes.values[0][colIdx];
                    if (kpi.format === 'currency') {
                      displayVal = `$${Number(raw).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    } else if (kpi.format === 'percent') {
                      displayVal = `${(Number(raw) * 100).toFixed(1)}%`;
                    } else if (kpi.format === 'number') {
                      displayVal = Number(raw).toLocaleString();
                    } else {
                      displayVal = String(raw);
                    }
                  }
                }

                return (
                  <div
                    key={kpi.id}
                    className="p-4 rounded-lg bg-slate-50 border border-slate-200 shadow-sm print:border-slate-300"
                  >
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {kpi.title}
                    </span>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      {displayVal}
                    </div>
                    {kpi.subtitle && (
                      <p className="text-[11px] text-slate-500 mt-1">{kpi.subtitle}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* SVG Summary Charts */}
          {config.charts && config.charts.length > 0 && (
            <div className="space-y-6 mb-8">
              {config.charts.map((chart) => {
                const targetRes = queryResults[chart.queryIndex || 0];
                if (!targetRes || targetRes.values.length === 0) return null;

                const labelIdx = targetRes.columns.indexOf(chart.labelColumn);
                const valIdx = targetRes.columns.indexOf(chart.valueColumn);
                if (labelIdx === -1 || valIdx === -1) return null;

                const chartData = targetRes.values.map((row) => ({
                  label: String(row[labelIdx]),
                  value: Number(row[valIdx]) || 0,
                }));

                const maxVal = Math.max(...chartData.map((d) => d.value), 1);

                return (
                  <div key={chart.id} className="p-5 rounded-lg border border-slate-200 bg-slate-50/50">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">
                      {chart.title}
                    </h3>

                    {/* Clean SVG Bar Chart */}
                    <div className="space-y-2.5">
                      {chartData.map((item, idx) => {
                        const pct = Math.round((item.value / maxVal) * 100);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-slate-700">
                              <span>{item.label}</span>
                              <span className="font-mono">${item.value.toLocaleString()}</span>
                            </div>
                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(pct, 2)}%`,
                                  backgroundColor: chart.color || '#4f46e5',
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Report Data Tables */}
          {config.tables && config.tables.length > 0 && (
            <div className="space-y-8 mb-8">
              {config.tables.map((tableCfg) => {
                const targetRes = queryResults[tableCfg.queryIndex || 0];
                if (!targetRes) return null;

                const colsToRender = tableCfg.columns || targetRes.columns;

                return (
                  <div key={tableCfg.id}>
                    <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wider">
                      {tableCfg.title || 'Data Breakdown'}
                    </h3>
                    <div className="overflow-x-auto border border-slate-300 rounded">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-semibold">
                          <tr>
                            {colsToRender.map((c) => (
                              <th key={c} className="py-2 px-3 border-r border-slate-200 last:border-r-0">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-800">
                          {targetRes.values.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50">
                              {colsToRender.map((c) => {
                                const cIdx = targetRes.columns.indexOf(c);
                                const val = row[cIdx];
                                const isNum = typeof val === 'number';
                                return (
                                  <td
                                    key={c}
                                    className={`py-2 px-3 border-r border-slate-200 last:border-r-0 ${isNum ? 'text-right font-mono' : ''}`}
                                  >
                                    {val === null || val === undefined ? '—' : String(val)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Commentary & Notes */}
          {config.notes && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 mb-8">
              <strong className="block font-semibold mb-1">Executive Notes:</strong>
              <p className="whitespace-pre-wrap">{config.notes}</p>
            </div>
          )}

          {/* Footer Branding & Disclaimer */}
          <div className="border-t border-slate-300 pt-4 mt-8 flex justify-between items-center text-[10px] text-slate-500">
            <span>Generated securely via GAW (Generic Application Wrapper) • Embedded SQLite</span>
            <span>Confidential & Proprietary</span>
          </div>
        </div>
      </div>
    </div>
  );
};
