import React from 'react';
import { AlertTriangle, Clock, HardDrive, RefreshCw, Copy, Save } from 'lucide-react';
import { ConflictDetails } from '../types/storage';

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-amber-500/50 rounded-xl shadow-2xl p-6 text-slate-100">
        <div className="flex items-center gap-3 text-amber-400 mb-3">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <h2 className="text-base font-bold text-white">External File Conflict Detected</h2>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          The underlying file <strong className="text-white font-mono">{conflict.fileName}</strong> was modified externally on your disk or cloud sync while Gawkyy was running.
        </p>

        {/* Visual Comparison Box */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs mb-5">
          <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">Local Gawkyy Memory</span>
            <div className="text-slate-200 font-semibold">
              {(conflict.localSize / 1024).toFixed(1)} KB
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{conflict.localModifiedAt.toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Modified On Disk</span>
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
            className="w-full flex items-center justify-between p-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-left transition"
          >
            <div>
              <strong className="text-white block font-semibold">Keep Local Memory (Overwrite Disk)</strong>
              <span className="text-[11px] text-indigo-300">Forces writing the in-memory SQLite state over the disk version.</span>
            </div>
            <Save className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          </button>

          <button
            onClick={onReloadDisk}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left transition"
          >
            <div>
              <strong className="text-white block font-semibold">Reload from Disk (Discard Local)</strong>
              <span className="text-[11px] text-slate-400">Replaces active database with the latest disk version.</span>
            </div>
            <RefreshCw className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>

          <button
            onClick={onSaveCopy}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left transition"
          >
            <div>
              <strong className="text-white block font-semibold">Save as New Copy (Keep Both)</strong>
              <span className="text-[11px] text-slate-400">Preserves external file and saves local changes into a new .db file.</span>
            </div>
            <Copy className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
