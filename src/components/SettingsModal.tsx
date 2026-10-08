import React, { useState, useEffect } from 'react';
import { Settings, X, AppWindow, Check } from 'lucide-react';
import { SQLiteEngine } from '../engine/sqliteEngine';

interface SettingsModalProps {
  onClose: () => void;
  theme: 'vs-dark' | 'vs-light';
  onThemeChange: (theme: 'vs-dark' | 'vs-light') => void;
  onSettingsSaved?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  theme,
  onThemeChange,
  onSettingsSaved,
}) => {
  const isDark = theme === 'vs-dark';

  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [initialPlugin, setInitialPlugin] = useState('main');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    try {
      const engine = SQLiteEngine.getInstance();
      const name = engine.getSetting('app_name', 'New App');
      const desc = engine.getSetting('app_description') || engine.getSetting('app_descripton', '');
      const init = engine.getSetting('initial_plugin', 'main');
      setAppName(name);
      setAppDescription(desc);
      setInitialPlugin(init);
    } catch (e) {
      console.error('Failed to load settings in modal:', e);
    }
  }, []);

  const handleSaveAppSettings = () => {
    try {
      const engine = SQLiteEngine.getInstance();
      engine.setSetting('app_name', appName.trim() || 'New App');
      engine.setSetting('app_description', appDescription.trim());
      engine.setSetting('app_descripton', appDescription.trim());
      engine.setSetting('initial_plugin', initialPlugin.trim() || 'main');
      setSavedSuccess(true);
      if (onSettingsSaved) {
        onSettingsSaved();
      }
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className={`w-full max-w-lg rounded-xl shadow-2xl p-6 flex flex-col max-h-[85vh] border transition-colors ${
        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
      }`}>
        <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Application & System Settings</h2>
          </div>
          <button onClick={onClose} className={`p-1 transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-5 text-xs">
          {/* App Mode & Brand Configuration (t_settings) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AppWindow className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-emerald-500 uppercase tracking-wider text-[11px]">Application Settings (t_settings)</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">SQLite Database</span>
            </div>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Configures the title, description, and initial landing plugin shown when running in App Mode.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1">
                  App Name (<code className="font-mono text-[10px]">app_name</code>)
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="New App"
                  className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1">
                  App Description (<code className="font-mono text-[10px]">app_description</code>)
                </label>
                <input
                  type="text"
                  value={appDescription}
                  onChange={(e) => setAppDescription(e.target.value)}
                  placeholder="Custom Application Description"
                  className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-indigo-500 ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1">
                  Initial Plugin (<code className="font-mono text-[10px]">initial_plugin</code>)
                </label>
                <input
                  type="text"
                  value={initialPlugin}
                  onChange={(e) => setInitialPlugin(e.target.value)}
                  placeholder="main"
                  className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none focus:border-indigo-500 font-mono ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Target plugin ID or name launched on startup in App Mode (default: main).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveAppSettings}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-sm flex items-center gap-1.5"
                >
                  {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{savedSuccess ? 'Saved to SQLite!' : 'Save Application Settings'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className={`h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

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
            onClick={() => {
              handleSaveAppSettings();
              onClose();
            }}
            className={`px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
