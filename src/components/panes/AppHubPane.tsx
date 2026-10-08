import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Puzzle,
  ArrowRight,
  Search,
  Code2,
  Table as TableIcon,
  Layers,
  Wrench,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { PluginRecord, isSystemPlugin } from '../../types/plugin';

interface AppHubPaneProps {
  theme: 'vs-dark' | 'vs-light';
  plugins: PluginRecord[];
  appName?: string;
  appDescription?: string;
  onSelectPlugin: (plugin: PluginRecord) => void;
  onSwitchToDev: () => void;
}

export const AppHubPane: React.FC<AppHubPaneProps> = ({
  theme,
  plugins,
  appName = 'New App',
  appDescription = '',
  onSelectPlugin,
  onSwitchToDev,
}) => {
  const isDark = theme === 'vs-dark';
  const [search, setSearch] = useState('');

  // Only user-created application plugins (enabled)
  const userPlugins = useMemo(() => {
    return plugins.filter((p) => !isSystemPlugin(p) && p.enabled === 1);
  }, [plugins]);

  const filteredPlugins = useMemo(() => {
    if (!search.trim()) return userPlugins;
    const q = search.toLowerCase();
    return userPlugins.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [userPlugins, search]);

  return (
    <div
      className={`flex-1 overflow-y-auto p-4 md:p-8 select-text transition-colors ${
        isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* App Mode Welcome Banner */}
        <div
          className={`p-6 md:p-8 rounded-3xl border shadow-sm transition ${
            isDark
              ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border-slate-800'
              : 'bg-gradient-to-br from-white via-slate-50 to-emerald-50/50 border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold'
                  }`}
                >
                  App Mode
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Interactive Application Runtime
                </span>
              </div>
              <h1
                className={`text-2xl md:text-3xl font-black tracking-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {appName || 'Application'}
              </h1>
              {appDescription && (
                <p className={`text-xs md:text-sm max-w-2xl ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {appDescription}
                </p>
              )}
            </div>

            <button
              onClick={onSwitchToDev}
              className={`self-start sm:self-center px-3.5 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 flex items-center gap-1.5 cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
              }`}
              title="Switch to Developer Mode to edit code, database, and settings"
            >
              <Wrench className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dev Mode</span>
            </button>
          </div>
        </div>

        {/* Section Header & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className={`text-sm md:text-base font-bold ${isDark ? 'text-sky-300' : 'text-blue-700'}`}>
              Application Panes ({userPlugins.length})
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Select an application pane below to run:
            </p>
          </div>

          {userPlugins.length > 3 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter panes..."
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          )}
        </div>

        {/* List of User Plugins */}
        {filteredPlugins.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlugins.map((plugin) => (
              <div
                key={plugin.id}
                onClick={() => onSelectPlugin(plugin)}
                className={`p-5 rounded-2xl border flex flex-col justify-between shadow-sm cursor-pointer transition hover:scale-[1.01] group ${
                  isDark
                    ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/60'
                    : 'bg-white border-slate-200 hover:border-emerald-500 shadow-sm'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition group-hover:scale-105 ${
                        isDark
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      }`}
                    >
                      <Puzzle className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isDark
                          ? 'bg-slate-900 text-slate-400 border-slate-800'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      v{plugin.version}
                    </span>
                  </div>

                  <div>
                    <h3
                      className={`text-sm font-bold tracking-tight transition group-hover:text-emerald-500 ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {plugin.name}
                    </h3>
                    <p
                      className={`text-xs mt-1 line-clamp-3 leading-relaxed ${
                        isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {plugin.description || 'Custom interactive application module.'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-slate-800/20 flex items-center justify-between">
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {plugin.route || `/${plugin.id}`}
                  </span>
                  <div
                    className={`flex items-center gap-1 text-xs font-semibold transition ${
                      isDark ? 'text-emerald-400' : 'text-emerald-800'
                    }`}
                  >
                    <span>Launch</span>
                    <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`p-10 rounded-3xl border text-center space-y-4 ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center">
              <Puzzle className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {search ? 'No matching panes' : 'No application panes found'}
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {search
                  ? `No application panes matching "${search}".`
                  : 'There are currently no custom user plugins available in this workspace. Switch to Dev Mode to create or enable plugins.'}
              </p>
            </div>
            <button
              onClick={onSwitchToDev}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95"
            >
              Switch to Dev Mode
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
