import React from 'react';
import { Database, HardDrive, Wifi, WifiOff, Clock, ShieldCheck, Code2 } from 'lucide-react';
import { StorageMetadata } from '../types/storage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { PWAInstallButton } from './PWAInstallButton';

interface StatusBarProps {
  storageMeta: StorageMetadata;
  tableCount: number;
  pluginCount: number;
  theme?: 'vs-dark' | 'vs-light';
  onOpenSettings?: () => void;
  isVSCodeMode?: boolean;
  onToggleVSCodeMode?: () => void;
  activeView?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  storageMeta,
  tableCount,
  pluginCount,
  theme = 'vs-dark',
  onOpenSettings,
  isVSCodeMode = false,
  onToggleVSCodeMode,
  activeView,
}) => {
  const isOnline = useOnlineStatus();
  const isDark = theme === 'vs-dark';

  return (
    <footer className={`flex flex-wrap items-center justify-between px-3 py-1 border-t text-[11px] font-mono select-text ${
      isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-600'
    }`}>
      {/* Left Diagnostics */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-indigo-400 font-semibold">
          <Database className="w-3.5 h-3.5" />
          <span>SQLite Wasm</span>
        </div>

        <div className="flex items-center gap-1 text-slate-300">
          <HardDrive className="w-3 h-3 text-slate-500" />
          <span className="font-semibold text-white">{storageMeta.fileName}</span>
          <span className="text-slate-500">({(storageMeta.fileSize / 1024).toFixed(1)} KB)</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-slate-400">
          <span>{tableCount} tables</span>
          <span>•</span>
          <span>{pluginCount} plugins</span>
        </div>
      </div>

      {/* Center: Full-Screen Monaco IDE Toggle */}
      {onToggleVSCodeMode && (
        <button
          onClick={onToggleVSCodeMode}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-sans font-medium transition border cursor-pointer active:scale-95 ${
            isVSCodeMode
              ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
              : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-slate-700/80 hover:text-white'
          }`}
          title="Toggle between standard Gawkyy shell and full Monaco IDE layout (Ctrl+Shift+F)"
        >
          <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>{isVSCodeMode ? 'Monaco IDE: FULL' : 'Monaco IDE'}</span>
          <kbd className="opacity-80 text-[9px] px-1 bg-black/40 rounded border border-white/10 font-mono">
            Ctrl+Shift+F
          </kbd>
        </button>
      )}

      {/* Right Sync & PWA Diagnostics */}
      <div className="flex items-center gap-3">
        {/* Auto Sync Frequency */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1 hover:text-white transition"
          title="Click to configure Auto-Save interval"
        >
          <Clock className="w-3 h-3 text-slate-500" />
          <span>
            {storageMeta.isAutoSyncEnabled
              ? `Auto-Sync: ${storageMeta.autoSyncIntervalSec}s`
              : 'Auto-Sync: Off'}
          </span>
        </button>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-1">
          {storageMeta.syncStatus === 'dirty' && (
            storageMeta.hasUserModifications ? (
              <span className="inline-flex items-center gap-1 text-amber-400 font-bold" title="Unsaved user modifications">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Unsaved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-500 font-medium" title="No uncommitted user modifications">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                Unsaved
              </span>
            )
          )}
          {storageMeta.syncStatus === 'saving' && (
            <span className="text-indigo-400 font-medium">Syncing...</span>
          )}
          {storageMeta.syncStatus === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Synced</span>
            </span>
          )}
          {storageMeta.syncStatus === 'conflict' && (
            <span className="text-red-400 font-bold">Conflict</span>
          )}
        </div>

        {/* Connectivity status */}
        <div className="flex items-center gap-1">
          {isOnline ? (
            <span className="flex items-center gap-1 text-emerald-400" title="Online: Cloud sync available">
              <Wifi className="w-3 h-3" />
              <span className="hidden md:inline">Online</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400" title="Offline: Native SQLite operates locally">
              <WifiOff className="w-3 h-3" />
              <span className="hidden md:inline">Offline</span>
            </span>
          )}
        </div>

        <PWAInstallButton compact={true} />
      </div>
    </footer>
  );
};
