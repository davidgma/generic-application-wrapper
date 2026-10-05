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
  PanelLeft
} from 'lucide-react';

interface NavbarProps {
  theme: 'vs-dark' | 'vs-light';
  activeRoute: 'file' | 'view' | 'database' | 'plugins' | 'help' | string;
  onSelectRoute: (route: string) => void;
  onThemeToggle: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  theme,
  activeRoute,
  onSelectRoute,
  onThemeToggle,
  onToggleSidebar,
  isSidebarOpen,
  onOpenSettings,
}) => {
  const isDark = theme === 'vs-dark';

  const navItems = [
    { id: 'file', label: 'File', icon: FolderOpen },
    { id: 'view', label: 'View', icon: LayoutGrid },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'plugins', label: 'Plugins', icon: Puzzle },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  return (
    <header className={`border-b select-text transition-colors ${
      isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
    }`}>
      {/* Top Application Bar - Centered: Cat Icon, Gawkyy / Generic Application Wrapper, and Action Icons */}
      <div className={`flex items-center justify-center px-3 py-1.5 gap-3 sm:gap-5 border-b ${
        isDark ? 'border-slate-850 border-slate-800/60' : 'border-slate-250 border-slate-300/80'
      }`}>
        {/* Centered Brand: Cat Icon + Gawkyy / Generic Application Wrapper */}
        <div className="flex items-center gap-2">
          <img
            src="/gawkyy-cat-64x64.png"
            alt="Gawkyy"
            className="w-7 h-7 object-contain bg-transparent flex-shrink-0"
          />
          <div className="flex flex-col text-left leading-tight">
            <span className={`font-black text-sm md:text-base tracking-tight leading-none ${
              isDark ? 'text-sky-300' : 'text-blue-950'
            }`}>
              Gawkyy
            </span>
            <span className={`text-[10px] md:text-[11px] font-medium tracking-tight mt-0.5 ${
              isDark ? 'text-sky-300/80' : 'text-blue-900/80'
            }`}>
              Generic Application Wrapper
            </span>
          </div>
        </div>

        {/* Action Icons right next to it in the middle */}
        <div className="flex items-center gap-1.5 pl-2 sm:pl-3 border-l border-slate-700/50">
          {/* Toggle Navigation Pane Icon */}
          <button
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-lg border transition active:scale-95 cursor-pointer ${
              isSidebarOpen
                ? isDark ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300' : 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850' : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title={isSidebarOpen ? 'Hide Navigation Side Panel' : 'Show Navigation Side Panel'}
            aria-label="Toggle Navigation Pane"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={onThemeToggle}
            className={`p-1.5 rounded-lg border transition active:scale-95 cursor-pointer ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850' : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
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
              isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850' : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title="Settings & Storage Preferences"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 2: 5 Mobile-like Navigation Icons centered on desktop and mobile */}
      <nav aria-label="Main Navigation" className={`flex items-center px-2 py-1 justify-center gap-2 sm:gap-4 md:gap-6 ${
        isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-200/50 text-slate-700'
      }`}>
        {navItems.map((item) => {
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectRoute(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 md:px-4 rounded-xl transition-all cursor-pointer min-w-[56px] md:min-w-[64px] active:scale-95 ${
                isActive
                  ? isDark
                    ? 'bg-indigo-600/30 text-white border border-indigo-500/50 shadow-sm'
                    : 'bg-white text-indigo-900 border border-slate-300 shadow-sm'
                  : isDark
                  ? 'hover:bg-slate-900 hover:text-white text-slate-400 border border-transparent'
                  : 'hover:bg-slate-200/80 hover:text-slate-900 text-slate-600 border border-transparent'
              }`}
            >
              {/* Same height as the cat icon above (w-7 h-7) */}
              <div className="w-7 h-7 flex items-center justify-center">
                <item.icon className={`w-5 h-5 ${isActive ? isDark ? 'text-sky-300' : 'text-indigo-600' : 'opacity-80'}`} />
              </div>
              <span className={`text-[10px] md:text-[11px] font-semibold tracking-tight ${
                isActive ? isDark ? 'text-white' : 'text-indigo-950 font-bold' : ''
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
