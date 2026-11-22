/**
 * Official Documentation:
 * - React Functional Components: https://react.dev/learn/your-first-component
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */
import React from 'react';
import { AlertTriangle, Clock, RefreshCw, Copy, Save } from 'lucide-react';
import { ConflictDetails } from '../types/storage';
import { formatProviderLabel } from '../engine/h2Bridge';

interface ConflictDialogProps {
  conflict: ConflictDetails;
  onKeepLocal: () => void;
  onReloadDisk: () => void;
  onSaveCopy: () => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  conflict,
  onKeepLocal,
  onReloadDisk,
  onSaveCopy,
}) => {
  const isH2 = conflict.source === 'h2';
  const externalLabel = isH2
    ? `${formatProviderLabel(conflict.provider)} (Clockie H2)`
    : 'Local Disk';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-red-500/50 rounded-xl shadow-2xl p-6 text-slate-100">
        <div className="flex items-center gap-3 text-red-400 mb-3">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <h2 className="text-base font-bold text-white">External File Conflict Detected</h2>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          The database file <strong className="text-white font-mono">{conflict.fileName}</strong> was modified on{' '}
          <strong className="text-sky-300">{externalLabel}</strong> while you also had unsaved changes in Gawkyy, and the changes could not be merged automatically.
        </p>

        {/* Visual Comparison Box */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs mb-5">
          <div className="p-2.5 rounded bg-slate-900/80 border border-blue-500/30">
            <span className="text-[11px] font-bold text-blue-400 block mb-1">Local Gawkyy Memory</span>
            <div className="text-slate-200 font-semibold">
              {(conflict.localSize / 1024).toFixed(1)} KB
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{conflict.localModifiedAt.toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="p-2.5 rounded bg-slate-900/80 border border-red-500/30">
            <span className="text-[11px] font-bold text-red-400 block mb-1">Modified on {externalLabel}</span>
            <div className="text-slate-200 font-semibold">
              {(conflict.diskSize / 1024).toFixed(1)} KB
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{conflict.diskModifiedAt.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <button
            onClick={onKeepLocal}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-left transition cursor-pointer"
          >
            <div>
              <strong className="text-white block font-semibold">Keep Local Memory (Overwrite {externalLabel})</strong>
              <span className="text-[11px] text-blue-200">Forces writing your current in-memory SQLite state over the external version.</span>
            </div>
            <Save className="w-4 h-4 text-blue-400 flex-shrink-0" />
          </button>

          <button
            onClick={onReloadDisk}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-red-950/40 hover:bg-red-950/60 border border-red-700/50 text-left transition cursor-pointer"
          >
            <div>
              <strong className="text-white block font-semibold">Reload from {externalLabel} (Discard Local)</strong>
              <span className="text-[11px] text-red-200">Replaces the active database with the latest external version.</span>
            </div>
            <RefreshCw className="w-4 h-4 text-red-400 flex-shrink-0" />
          </button>

          <button
            onClick={onSaveCopy}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-700/50 text-left transition cursor-pointer"
          >
            <div>
              <strong className="text-white block font-semibold">Save as New Copy (Keep Both)</strong>
              <span className="text-[11px] text-emerald-200">Preserves the external file and saves your local edits into a new .sqlite copy.</span>
            </div>
            <Copy className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
