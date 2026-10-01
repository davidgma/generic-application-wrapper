import React, { useState } from 'react';
import { SQLiteEngine } from '../engine/sqliteEngine';
import { SavedReport, ReportConfig } from '../types/report';
import { X, Save, Plus, Trash2 } from 'lucide-react';

interface ReportBuilderProps {
  report?: SavedReport | null;
  onSave: (report: SavedReport) => void;
  onClose: () => void;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  report,
  onSave,
  onClose,
}) => {
  const engine = SQLiteEngine.getInstance();
  const savedQueries = engine.getSavedQueries();

  const [name, setName] = useState(report?.name || 'New Custom Report');
  const [description, setDescription] = useState(report?.description || 'Custom management overview');
  const [queryId, setQueryId] = useState(report?.query_id || (savedQueries[0]?.id || ''));
  const [customSql, setCustomSql] = useState(report?.custom_sql || '');

  const initialConfig: ReportConfig = (() => {
    try {
      if (report?.config) return JSON.parse(report.config);
    } catch (e) {
      // ignore
    }
    return {
      companyName: 'Northwind Global Corp',
      reportTitle: name,
      subtitle: 'Periodic Operational Review',
      preparedBy: 'Management Analytics',
      periodText: 'Current Fiscal Period',
      notes: 'Prepared using GAW SQLite Engine.',
      kpiCards: [
        { id: 'kpi_1', title: 'Primary Metric', queryIndex: 0, valueColumn: 'gross_revenue', format: 'currency' },
      ],
      charts: [
        { id: 'chart_1', title: 'Distribution Chart', chartType: 'bar', queryIndex: 0, labelColumn: 'name', valueColumn: 'total_sales', color: '#6366f1' },
      ],
      tables: [
        { id: 'table_1', title: 'Data Summary', queryIndex: 0, showTotalRow: true },
      ],
    };
  })();

  const [config, setConfig] = useState<ReportConfig>(initialConfig);

  const handleSave = () => {
    const updatedReport: SavedReport = {
      id: report?.id || `report_${Date.now()}`,
      name,
      description,
      query_id: queryId,
      custom_sql: customSql,
      config: JSON.stringify(config, null, 2),
      created_at: report?.created_at || new Date().toISOString(),
    };

    engine.run(
      'INSERT OR REPLACE INTO t_reports (id, name, description, query_id, custom_sql, config, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        updatedReport.id,
        updatedReport.name,
        updatedReport.description,
        updatedReport.query_id,
        updatedReport.custom_sql || '',
        updatedReport.config,
        updatedReport.created_at,
      ]
    );

    onSave(updatedReport);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 text-slate-100 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white">Customize Report Specification</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {/* General Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Report Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setConfig({ ...config, reportTitle: e.target.value });
                }}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Company / Organization Branding</label>
              <input
                type="text"
                value={config.companyName}
                onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Report Subtitle / Purpose</label>
            <input
              type="text"
              value={config.subtitle}
              onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
            />
          </div>

          {/* Query Source */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg space-y-3">
            <h3 className="font-bold text-indigo-400">Data Source (SQL Query)</h3>
            <div>
              <label className="block text-slate-400 mb-1">Bind to Saved Query</label>
              <select
                value={queryId}
                onChange={(e) => setQueryId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100"
              >
                {savedQueries.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name} ({q.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-400 mb-1">Executive Notes & Commentary</label>
            <textarea
              rows={2}
              value={config.notes || ''}
              onChange={(e) => setConfig({ ...config, notes: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-sans"
              placeholder="Notes printed at the bottom of the memo..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white shadow transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Report to Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};
