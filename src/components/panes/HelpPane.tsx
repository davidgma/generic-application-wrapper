import React from 'react';
import {
  HelpCircle,
  Sparkles,
  Download,
  Smartphone,
  Keyboard,
  Cloud,
  Shield,
  ExternalLink,
  Code2,
  Database
} from 'lucide-react';
import { PWAInstallButton } from '../PWAInstallButton';

interface HelpPaneProps {
  theme: 'vs-dark' | 'vs-light';
  onOpenAI: () => void;
  onOpenSettings: () => void;
  onOpenPlugin: (pluginId: string) => void;
}

export const HelpPane: React.FC<HelpPaneProps> = ({
  theme,
  onOpenAI,
  onOpenSettings,
  onOpenPlugin,
}) => {
  const isDark = theme === 'vs-dark';

  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-6 select-text transition-colors ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isDark ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          }`}>
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-sky-300' : 'text-slate-900'}`}>
              Help, Tools & About Gawkyy
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              AI code generation, progressive web app installation, keyboard shortcuts, and documentation.
            </p>
          </div>
        </div>

        {/* Primary Moved Actions: AI Generator & Install App */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* 1. AI Specification Generator (Moved from top row) */}
          <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}>
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>AI Specification Generator</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Prompt Exporter
                  </span>
                </h3>
                <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                  Generate tailored prompts embedded with your active SQLite schema and the Gawkyy TypeScript API.
                  Copy and paste into Google Gemini, Claude, or ChatGPT to instantly build custom plugins.
                </p>
              </div>
            </div>
            <button
              onClick={onOpenAI}
              className="mt-4 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch AI Prompt Generator</span>
            </button>
          </div>

          {/* 2. Install App as PWA (Moved from top row) */}
          <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}>
            <div className="space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Install Gawkyy App (PWA)</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Offline Ready
                  </span>
                </h3>
                <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                  Install Gawkyy on your PC, Mac, iPad, iPhone, or Android device as a standalone desktop app.
                  Works 100% offline with zero server dependencies.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <PWAInstallButton className="w-full justify-center py-2.5 rounded-xl" />
            </div>
          </div>
        </div>

        {/* About Gawkyy Card */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <img
              src="/gawkyy-cat-256x256.png"
              alt="Gawkyy Mascot"
              className="w-16 h-16 rounded-2xl object-cover shadow-md ring-2 ring-amber-400/40 flex-shrink-0"
            />
            <div className="space-y-1">
              <h3 className={`text-base font-bold flex items-center gap-2 ${isDark ? 'text-sky-300' : 'text-slate-900'}`}>
                <span>Gawkyy — Generic Application Wrapper</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono font-normal">
                  v1.2.0
                </span>
              </h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                A modern, web-native offline-first replacement for MS Access. Portable SQLite database architecture
                with client-side dynamic TSX plugins, interactive query grids, Excel-compatible spreadsheets, and publication reports.
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono text-indigo-400">
                <span>• sql.js WebAssembly SQLite</span>
                <span>• Sucrase Runtime TSX Compiler</span>
                <span>• File System Access API</span>
                <span>• Dropbox Cloud Sync</span>
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Table */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800/40">
            <Keyboard className="w-4 h-4 text-indigo-400" />
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-sky-300/90' : 'text-slate-900'}`}>
              Keyboard Shortcuts Reference
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 text-xs">
            {[
              ['Ctrl + Shift + F', 'Toggle Full VS Code Studio Mode / Gawkyy Shell'],
              ['Ctrl + O', 'Open Local SQLite Database File'],
              ['Ctrl + S', 'Save Active Database to Disk / Memory'],
              ['Ctrl + Enter', 'Run SQL Query / Test Plugin in IDE'],
              ['Shift + Alt + F', 'Format Document (Prettier Auto-format)'],
              ['Ctrl + B', 'Toggle Navigation Side Bar'],
            ].map(([shortcut, desc], idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                  isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-800 font-medium'}`}>{desc}</span>
                <kbd className="px-2 py-1 rounded bg-black/40 text-sky-300 font-mono text-[10px] font-bold border border-white/10 flex-shrink-0">
                  {shortcut}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Dropbox Cloud Sync Guide */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-sky-400" />
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-sky-300/90' : 'text-slate-900'}`}>
                Dropbox Cloud Synchronization
              </h3>
            </div>
            <button
              onClick={() => onOpenPlugin('plugin_dropbox_sync')}
              className="text-xs text-sky-400 hover:text-sky-300 underline font-medium flex items-center gap-1"
            >
              <span>Open Dropbox Plugin</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <p className={`text-xs mt-3 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            Gawkyy can seamlessly synchronize your SQLite database with Dropbox.
            Enter your Dropbox App Token in the Dropbox Sync plugin or Settings modal to enable one-click cloud pull, push, and remote file browsing.
          </p>
        </div>
      </div>
    </div>
  );
};
