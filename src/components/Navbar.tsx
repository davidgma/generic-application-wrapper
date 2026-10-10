import React from 'react';
import {
  FolderOpen,
  LayoutGrid,
  Database,
  Puzzle,
  HelpCircle,
  Sun,
  Moon,
  Settings,
  Sparkles,
} from 'lucide-react';
import { PluginRecord } from '../types/plugin';

interface NavbarProps {
  theme: 'vs-dark' | 'vs-light';
  mode: 'dev' | 'app';
  activeRoute: string;
  activeView: string;
  onSelectRoute: (route: string) => void;
  onSelectView?: (view: string) => void;
  onThemeToggle: () => void;
  onModeToggle: (mode: 'dev' | 'app') => void;
  onOpenSettings: () => void;
  appName?: string;
  appDescription?: string;
  userPlugins?: PluginRecord[];
}

export const Navbar: React.FC<NavbarProps> = ({
  theme,
  mode,
  activeRoute,
  activeView,
  onSelectRoute,
  onSelectView,
  onThemeToggle,
  onModeToggle,
  onOpenSettings,
  appName = 'New App',
  appDescription = '',
  userPlugins = [],
}) => {
  const isDark = theme === 'vs-dark';

  // In App mode: replace 'Gawkyy' with app_name from settings if there is one (otherwise blank),
  // and 'Generic Application Wrapper' with app_description if there is one (otherwise blank).
  // In Dev mode: restore 'Gawkyy' and 'Generic Application Wrapper'.
  const brandTitle = mode === 'app' ? (appName || '') : 'Gawkyy';
  const brandSubtitle = mode === 'app' ? (appDescription || '') : 'Generic Application Wrapper';

  // Navigation Items according to mode:
  // Dev mode: File, View, Database, Plugins, Help
  // App mode: File/Workspace, plus actual application panes (user plugins) and/or All Panes hub
  const devNavItems = [
    { id: 'file', label: 'File', icon: FolderOpen },
    { id: 'view', label: 'View', icon: LayoutGrid },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'plugins', label: 'Plugins', icon: Puzzle },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  const appNavItems = React.useMemo(() => {
    const items: Array<{ id: string; label: string; icon: any; isView?: boolean }> = [
      { id: 'file', label: 'Files', icon: FolderOpen },
    ];

    if (userPlugins.length === 1) {
      items.push({
        id: `plugin:${userPlugins[0].id}`,
        label: userPlugins[0].name,
        icon: Sparkles,
        isView: true,
      });
    } else if (userPlugins.length > 1 && userPlugins.length <= 4) {
      userPlugins.forEach((p) => {
        items.push({
          id: `plugin:${p.id}`,
          label: p.name,
          icon: Sparkles,
          isView: true,
        });
      });
      items.push({
        id: 'app_hub',
        label: 'All Panes',
        icon: LayoutGrid,
        isView: true,
      });
    } else if (userPlugins.length > 4) {
      // First 3 plugins + All Panes hub
      userPlugins.slice(0, 3).forEach((p) => {
        items.push({
          id: `plugin:${p.id}`,
          label: p.name,
          icon: Sparkles,
          isView: true,
        });
      });
      items.push({
        id: 'app_hub',
        label: 'All Panes',
        icon: LayoutGrid,
        isView: true,
      });
    } else {
      // 0 user plugins
      items.push({
        id: 'app_hub',
        label: 'App Panes',
        icon: LayoutGrid,
        isView: true,
      });
    }

    return items;
  }, [userPlugins]);

  const navItems = mode === 'app' ? appNavItems : devNavItems;

  const handleNavItemClick = (item: { id: string; isView?: boolean }) => {
    if (item.id === 'file') {
      onSelectRoute('file');
    } else if (item.isView && onSelectView) {
      onSelectView(item.id);
    } else if (item.id.startsWith('plugin:') && onSelectView) {
      onSelectView(item.id);
    } else if (item.id === 'app_hub' && onSelectView) {
      onSelectView('app_hub');
    } else {
      onSelectRoute(item.id);
    }
  };

  return (
    <header
      className={`border-b select-text transition-colors ${
        isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
      }`}
    >
      {/* Top Application Bar - Centered: Cat Icon, Gawkyy / App Details, and Action Icons */}
      <div
        className={`flex items-center justify-center px-3 py-1.5 gap-3 sm:gap-5 border-b ${
          isDark ? 'border-slate-800/60' : 'border-slate-300/80'
        }`}
      >
        {/* Centered Brand: Cat Icon + Gawkyy or App Name / Description */}
        <div className="flex items-center gap-2">
          <img
            src="/gawkyy-cat-64x64.png"
            alt="Gawkyy"
            className="w-7 h-7 object-contain bg-transparent flex-shrink-0"
          />
          <div className="flex flex-col text-left leading-tight min-h-[28px] justify-center">
            {brandTitle ? (
              <span
                className={`font-black text-sm md:text-base tracking-tight leading-none ${
                  isDark ? 'text-sky-300' : 'text-blue-700'
                }`}
              >
                {brandTitle}
              </span>
            ) : null}
            {brandSubtitle ? (
              <span
                className={`text-[10px] md:text-[11px] font-medium tracking-tight mt-0.5 ${
                  isDark ? 'text-sky-300/80' : 'text-blue-600/80'
                }`}
              >
                {brandSubtitle}
              </span>
            ) : null}
          </div>
        </div>

        {/* Action Controls right next to brand in the middle */}
        <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 border-l border-slate-700/50">
          {/* Dev / App Mode Toggle */}
          <div
            className={`flex items-center rounded-lg border p-0.5 text-xs font-semibold ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/80 border-slate-300'
            }`}
          >
            <button
              type="button"
              onClick={() => onModeToggle('dev')}
              className={`px-2 py-1 rounded-md transition text-[11px] font-bold cursor-pointer ${
                mode === 'dev'
                  ? isDark
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-blue-700 shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Developer Mode: inspect plugins, database tables, queries, reports, and code editor"
            >
              Dev
            </button>
            <button
              type="button"
              onClick={() => onModeToggle('app')}
              className={`px-2 py-1 rounded-md transition text-[11px] font-bold cursor-pointer ${
                mode === 'app'
                  ? isDark
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-600 text-white shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="App Mode: run the interactive application panes"
            >
              App
            </button>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={onThemeToggle}
            className={`p-1.5 rounded-lg border transition active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Settings Cog Button */}
          <button
            onClick={onOpenSettings}
            className={`p-1.5 rounded-lg border transition active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title="Settings & Storage Preferences"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Navigation Icons centered on desktop and mobile */}
      <nav
        aria-label="Main Navigation"
        className={`flex items-center px-2 py-1 justify-center gap-2 sm:gap-4 md:gap-6 overflow-x-auto ${
          isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-200/50 text-slate-700'
        }`}
      >
        {navItems.map((item) => {
          const isActive =
            item.id === 'file'
              ? activeRoute === 'file' || activeView === 'plugin:plugin_file_manager'
              : mode === 'app'
              ? activeView === item.id || activeRoute === item.id
              : activeRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleNavItemClick(item)}
              className={`flex flex-col items-center justify-center py-1 px-3 md:px-4 rounded-xl transition-all cursor-pointer min-w-[56px] md:min-w-[64px] active:scale-95 flex-shrink-0 ${
                isActive
                  ? isDark
                    ? 'bg-indigo-600/30 text-white border border-indigo-500/50 shadow-sm'
                    : mode === 'app'
                    ? 'bg-emerald-600 text-white border border-emerald-500 shadow-sm'
                    : 'bg-white text-blue-700 border border-slate-300 shadow-sm'
                  : isDark
                  ? 'hover:bg-slate-900 hover:text-white text-slate-400 border border-transparent'
                  : 'hover:bg-slate-200/80 hover:text-slate-900 text-slate-600 border border-transparent'
              }`}
            >
              <div className="w-7 h-7 flex items-center justify-center">
                <item.icon
                  className={`w-5 h-5 ${
                    isActive
                      ? isDark
                        ? 'text-sky-300'
                        : mode === 'app'
                        ? 'text-white'
                        : 'text-blue-700'
                      : 'opacity-80'
                  }`}
                />
              </div>
              <span
                className={`text-[10px] md:text-[11px] font-semibold tracking-tight truncate max-w-[120px] ${
                  isActive ? (isDark ? 'text-white' : mode === 'app' ? 'text-white font-bold' : 'text-blue-700 font-bold') : ''
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
