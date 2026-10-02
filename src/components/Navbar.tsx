import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  FileCode,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HardDrive,
  Save,
  Settings,
  Sparkles,
  Cloud,
  Layers,
  ChevronDown,
  RotateCcw,
  Check,
  Moon,
  Sun,
  Plus,
} from 'lucide-react';
import { StorageMetadata } from '../types/storage';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  appTitle: string;
  storageMeta: StorageMetadata;
  theme: 'vs-dark' | 'vs-light';
  onThemeToggle: () => void;
  onNewDatabase: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveAsFile: () => void;
  onOpenDropbox: () => void;
  onOpenSettings: () => void;
  onOpenAI: () => void;
  onOpenIDE: (tab?: any) => void;
  onOpenSpreadsheet: () => void;
  onToggleSidebar: () => void;
  onResetDefault: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  appTitle,
  storageMeta,
  theme,
  onThemeToggle,
  onNewDatabase,
  onOpenFile,
  onSaveFile,
  onSaveAsFile,
  onOpenDropbox,
  onOpenSettings,
  onOpenAI,
  onOpenIDE,
  onOpenSpreadsheet,
  onToggleSidebar,
  onResetDefault,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isDark = theme === 'vs-dark';

  return (
    <header className={`border-b select-none ${isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'}`}>
      {/* Top Application Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 gap-3">
        {/* Brand & Title */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md font-black text-xs">
            GAW
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-xs tracking-tight text-white">{appTitle}</span>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              [{storageMeta.fileName}]
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Save Button with Dirty Badge */}
          <button
            onClick={onSaveFile}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition shadow-sm ${
              storageMeta.syncStatus === 'dirty'
                ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                : storageMeta.syncStatus === 'saving'
                ? 'bg-indigo-700 text-slate-200'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Save to underlying file handle (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {storageMeta.syncStatus === 'dirty'
                ? 'Save Changes *'
                : storageMeta.syncStatus === 'saving'
                ? 'Saving...'
                : 'Saved'}
            </span>
          </button>

          {/* Dropbox Cloud Button */}
          <button
            onClick={onOpenDropbox}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs transition ${
              isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
            title="Sync with Dropbox"
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Dropbox</span>
          </button>

          {/* AI Assistant Button */}
          <button
            onClick={onOpenAI}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-xs transition"
            title="AI Specification Exporter"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">AI Generator</span>
          </button>

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Theme Toggle */}
          <button
            onClick={onThemeToggle}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Settings & Storage Preferences"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Menu Bar (File, Edit, View, Database, Plugins, Tools, Help) */}
      <div ref={menuBarRef} className={`flex items-center gap-1 px-2.5 py-1 border-t text-xs ${isDark ? 'border-slate-800/80 bg-slate-950' : 'border-slate-300 bg-slate-200/60'}`}>
        {/* File Menu */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
            className={`px-2.5 py-1 rounded font-medium text-xs transition ${openMenu === 'file' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-100 hover:text-white hover:bg-slate-800/90' : 'text-slate-800 hover:text-slate-950 hover:bg-slate-300/80'}`}
          >
            File
          </button>
          {openMenu === 'file' && (
            <div className="absolute left-0 top-full mt-0.5 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
              <button
                onClick={() => {
                  onNewDatabase();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>New Database</span>
                <span className="text-[10px] text-slate-500">Blank</span>
              </button>
              <button
                onClick={() => {
                  onOpenFile();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Open File...</span>
                <span className="text-[10px] text-slate-500">Ctrl+O</span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => {
                  onSaveFile();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Save Database</span>
                <span className="text-[10px] text-slate-500">Ctrl+S</span>
              </button>
              <button
                onClick={() => {
                  onSaveAsFile();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Save As New Copy...</span>
                <span className="text-[10px] text-slate-500">.db</span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => {
                  onOpenDropbox();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Dropbox Two-Way Sync...</span>
                <Cloud className="w-3.5 h-3.5 text-indigo-400" />
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => {
                  onResetDefault();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-300 transition"
              >
                <span>Reset to Northwind Demo</span>
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}
            className={`px-2.5 py-1 rounded font-medium text-xs transition ${openMenu === 'view' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-100 hover:text-white hover:bg-slate-800/90' : 'text-slate-800 hover:text-slate-950 hover:bg-slate-300/80'}`}
          >
            View
          </button>
          {openMenu === 'view' && (
            <div className="absolute left-0 top-full mt-0.5 w-52 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
              <button
                onClick={() => {
                  onToggleSidebar();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Toggle Navigation Pane</span>
                <span className="text-[10px] text-slate-500">Access Pane</span>
              </button>
              <button
                onClick={() => {
                  onOpenSpreadsheet();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Spreadsheet Studio</span>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              </button>
              <button
                onClick={() => {
                  onOpenIDE({ type: 'sql' });
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Internal Monaco IDE</span>
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              </button>
            </div>
          )}
        </div>

        {/* Database Menu */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'db' ? null : 'db')}
            className={`px-2.5 py-1 rounded font-medium text-xs transition ${openMenu === 'db' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-100 hover:text-white hover:bg-slate-800/90' : 'text-slate-800 hover:text-slate-950 hover:bg-slate-300/80'}`}
          >
            Database
          </button>
          {openMenu === 'db' && (
            <div className="absolute left-0 top-full mt-0.5 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
              <button
                onClick={() => {
                  onOpenIDE({ type: 'sql' });
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Open SQL Query Editor</span>
                <span className="text-[10px] text-slate-500">Ctrl+E</span>
              </button>
              <button
                onClick={() => {
                  onOpenSettings();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Schema & Engine Diagnostics</span>
                <Database className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          )}
        </div>

        {/* Plugins Menu */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'plugins' ? null : 'plugins')}
            className={`px-2.5 py-1 rounded font-medium text-xs transition ${openMenu === 'plugins' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-100 hover:text-white hover:bg-slate-800/90' : 'text-slate-800 hover:text-slate-950 hover:bg-slate-300/80'}`}
          >
            Plugins
          </button>
          {openMenu === 'plugins' && (
            <div className="absolute left-0 top-full mt-0.5 w-60 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-xs text-slate-200">
              <button
                onClick={() => {
                  onOpenAI();
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>AI Prompt Exporter & Assistant</span>
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              </button>
              <button
                onClick={() => {
                  onOpenIDE({ type: 'plugin' });
                  setOpenMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600 hover:text-white transition"
              >
                <span>Plugin IDE Editor (.tsx)</span>
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'help' ? null : 'help')}
            className={`px-2.5 py-1 rounded font-medium text-xs transition ${openMenu === 'help' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-100 hover:text-white hover:bg-slate-800/90' : 'text-slate-800 hover:text-slate-950 hover:bg-slate-300/80'}`}
          >
            Help
          </button>
          {openMenu === 'help' && (
            <div className="absolute left-0 top-full mt-0.5 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 p-3 text-xs text-slate-300 space-y-2">
              <div className="font-bold text-white border-b border-slate-800 pb-1">
                GAW - Generic Application Wrapper
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Self-contained MS Access for the modern web. Every table, plugin, saved query, and report is stored directly inside your portable SQLite .db file.
              </p>
              <div className="text-[10px] text-indigo-400 font-mono pt-1 border-t border-slate-800">
                PWA • sql.js WebAssembly • Sucrase TSX
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
