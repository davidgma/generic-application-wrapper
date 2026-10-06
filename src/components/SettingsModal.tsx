import React from 'react';
import { Settings, X } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  theme: 'vs-dark' | 'vs-light';
  onThemeChange: (theme: 'vs-dark' | 'vs-light') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  theme,
  onThemeChange,
}) => {
  const isDark = theme === 'vs-dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className={`w-full max-w-lg rounded-xl shadow-2xl p-6 flex flex-col max-h-[85vh] border transition-colors ${
        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
      }`}>
        <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Application & Database Settings</h2>
          </div>
          <button onClick={onClose} className={`p-1 transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {/* Appearance Theme (Browser Local Storage) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-indigo-500 uppercase tracking-wider text-[11px]">Visual Appearance (Browser Local Storage)</h3>
              <span className="text-[10px] font-mono text-slate-400">key: gaw_theme</span>
            </div>
            <div>
              <p className={`text-[11px] mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Visual theme is saved in your browser local storage across sessions.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onThemeChange('vs-dark')}
                  className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition ${
                    theme === 'vs-dark'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Dark Mode (vs-dark)
                </button>
                <button
                  type="button"
                  onClick={() => onThemeChange('vs-light')}
                  className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition ${
                    theme === 'vs-light'
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                      : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Light Mode (vs-light)
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`flex justify-end gap-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
