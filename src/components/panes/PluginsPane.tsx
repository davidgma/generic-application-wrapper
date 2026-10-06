import React from 'react';
import {
  Puzzle,
  Plus,
  FileCode,
  Sparkles,
  Play,
  Edit3,
  Power,
  FolderOpen
} from 'lucide-react';
import { PluginRecord } from '../../types/plugin';

interface PluginsPaneProps {
  theme: 'vs-dark' | 'vs-light';
  plugins: PluginRecord[];
  onOpenIDE: (tab?: any) => void;
  onAddPlugin: () => void;
  onSelectView: (view: string) => void;
  onTogglePlugin: (plugin: PluginRecord) => void;
}

export const PluginsPane: React.FC<PluginsPaneProps> = ({
  theme,
  plugins,
  onOpenIDE,
  onAddPlugin,
  onSelectView,
  onTogglePlugin,
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
            isDark ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200'
          }`}>
            <Puzzle className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-sky-300' : 'text-blue-950'}`}>
              Dynamic TSX Plugins
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Client-compiled React TSX micro-apps running directly inside SQLite.
            </p>
          </div>
        </div>

        {/* Primary Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {/* Add / Import Plugin */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-purple-500/50' : 'bg-white border-slate-200 hover:border-purple-300'
          }`}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Import or Add Plugin</h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Import a TSX plugin from disk, Dropbox, or pick from pre-built templates.
              </p>
            </div>
            <button
              onClick={onAddPlugin}
              className="mt-3 w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Plugin Wizard</span>
            </button>
          </div>

          {/* Plugin Monaco IDE */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <FileCode className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Plugin IDE (.tsx)</h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Code plugins in the built-in Monaco editor with live compiler and SQLite API access.
              </p>
            </div>
            <button
              onClick={() => onOpenIDE({ type: 'plugin' })}
              className="mt-3 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Open Plugin IDE</span>
            </button>
          </div>

          {/* Plugin Manager Hub */}
          <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm transition hover:scale-[1.01] ${
            isDark ? 'bg-slate-950/80 border-slate-800 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-300'
          }`}>
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-sky-400 border border-blue-500/30 flex items-center justify-center">
                <FolderOpen className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Plugin Registry Hub</h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Manage runtime visibility, delete custom plugins, and search registry records.
              </p>
            </div>
            <button
              onClick={() => onSelectView('plugin:plugin_manager')}
              className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold border transition active:scale-95 flex items-center justify-center gap-1.5 ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Manage Registry</span>
            </button>
          </div>
        </div>

        {/* Installed Plugins Explorer */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-sky-300/90' : 'text-blue-950'}`}>
            Installed Plugins ({plugins.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {plugins.map((p) => {
              const isActive = p.enabled !== 0;
              const isProtected = p.id === 'plugin_manager' || p.id === 'plugin_local_storage' || p.id === 'plugin_file_manager';
              return (
                <div
                  key={p.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition ${
                    isActive
                      ? isDark
                        ? 'bg-slate-900/90 border-slate-800 shadow-sm'
                        : 'bg-white border-slate-200 shadow-sm'
                      : isDark
                      ? 'bg-slate-950/40 border-slate-800/40 opacity-70'
                      : 'bg-slate-50 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold truncate text-slate-900 dark:text-white">
                            {p.name}
                          </h4>
                          <span className={`text-[10px] font-mono px-1 py-0.2 rounded border ${
                            isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}>
                            v{p.version || '1.0.0'}
                          </span>
                        </div>
                        <span className="text-[10px] text-indigo-400 font-medium">
                          {p.menu_category || 'Plugin'}
                        </span>
                      </div>

                      <button
                        onClick={() => onTogglePlugin(p)}
                        disabled={isProtected}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                          isProtected
                            ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-400 cursor-not-allowed'
                            : isActive
                            ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                            : isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'
                        }`}
                        title={isProtected ? 'Core system plugin' : isActive ? 'Active (visible in sidebar)' : 'Inactive'}
                      >
                        <Power className="w-2.5 h-2.5" />
                        <span>{isActive ? 'Active' : 'Inactive'}</span>
                      </button>
                    </div>

                    <p className={`text-[11px] line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {p.description || 'Dynamic client-side React plugin component.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 pt-3 mt-2 border-t border-slate-800/40">
                    <button
                      onClick={() => onSelectView(`plugin:${p.id}`)}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] shadow transition active:scale-95 flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>Open</span>
                    </button>
                    <button
                      onClick={() => onOpenIDE({ type: 'plugin', id: p.id, name: p.name })}
                      className={`px-2.5 py-1 rounded border text-[11px] font-medium transition active:scale-95 flex items-center gap-1 ${
                        isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit in IDE</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
