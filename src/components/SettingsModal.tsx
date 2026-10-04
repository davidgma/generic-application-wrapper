import React, { useState, useEffect } from 'react';
import { SQLiteEngine } from '../engine/sqliteEngine';
import { FileStorageEngine } from '../engine/fileStorage';
import { Settings, X, Save, Database, HardDrive, RefreshCw } from 'lucide-react';

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
  const engine = SQLiteEngine.getInstance();
  const storage = FileStorageEngine.getInstance();
  const meta = storage.getMetadata();

  const [syncInterval, setSyncInterval] = useState(String(meta.autoSyncIntervalSec || 30));
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(meta.isAutoSyncEnabled);

  const handleSave = () => {
    engine.setSetting('auto_sync_interval', syncInterval);
    storage.setAutoSyncInterval(Number(syncInterval));
    storage.setAutoSyncEnabled(autoSyncEnabled);
    engine.notifyChange();
    onClose();
  };

  const dbStats = (() => {
    try {
      const pageCount = engine.query('PRAGMA page_count;').values[0][0];
      const pageSize = engine.query('PRAGMA page_size;').values[0][0];
      const schemaVer = engine.query('PRAGMA schema_version;').values[0][0];
      return { pageCount, pageSize, schemaVer, totalBytes: pageCount * pageSize };
    } catch (e) {
      return { pageCount: 0, pageSize: 4096, schemaVer: 1, totalBytes: 0 };
    }
  })();

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


          {/* Storage & Auto-Save */}
          <div className={`space-y-3 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <h3 className="font-bold text-indigo-500 uppercase tracking-wider text-[11px]">Storage & Auto-Save</h3>
            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className={`font-semibold block ${isDark ? 'text-white' : 'text-slate-900'}`}>Auto-Save to Native File Handle</span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Automatically sync in-memory edits to disk file handle.</span>
              </div>
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
              />
            </div>

            <div>
              <label className={`block mb-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Auto-Save Frequency</label>
              <select
                value={syncInterval}
                onChange={(e) => setSyncInterval(e.target.value)}
                className={`w-full px-3 py-1.5 rounded border focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="15">Every 15 Seconds</option>
                <option value="30">Every 30 Seconds (Default)</option>
                <option value="60">Every 1 Minute</option>
                <option value="120">Every 2 Minutes</option>
                <option value="0">Manual Save Only</option>
              </select>
            </div>
          </div>

          {/* SQLite Engine Diagnostics */}
          <div className={`pt-3 border-t space-y-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <h3 className="font-bold text-indigo-500 uppercase tracking-wider text-[11px]">SQLite Engine Diagnostics</h3>
            <div className={`grid grid-cols-2 gap-2 text-[11px] p-3 rounded-lg border font-mono ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Database Name: </span>
                <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{engine.activeDbName}</span>
              </div>
              <div>
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Schema Version: </span>
                <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{dbStats.schemaVer}</span>
              </div>
              <div>
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Page Count: </span>
                <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{dbStats.pageCount}</span>
              </div>
              <div>
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Page Size: </span>
                <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>{dbStats.pageSize} B</span>
              </div>
              <div className="col-span-2">
                <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>Total File Footprint: </span>
                <span className="text-emerald-500 font-bold">{(dbStats.totalBytes / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`flex justify-end gap-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            onClick={onClose}
            className={`px-3.5 py-1.5 rounded text-xs font-medium transition ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
