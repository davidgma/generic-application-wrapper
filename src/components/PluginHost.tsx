import React, { useMemo, useState } from 'react';
import { PluginEngine, PluginErrorBoundary } from '../engine/pluginEngine';
import { GAWContext } from '../types/plugin';
import { SQLiteEngine } from '../engine/sqliteEngine';
import {
  DEFAULT_HELP_PLUGIN_CODE,
  DEFAULT_PLUGIN_MANAGER_CODE,
  DEFAULT_DROPBOX_PLUGIN_CODE,
  DEFAULT_LOCAL_STORAGE_PLUGIN_CODE,
  DEFAULT_FILE_MANAGER_PLUGIN_CODE,
  DEFAULT_DATABASE_MANAGEMENT_PLUGIN_CODE,
  DEFAULT_HELLO_WORLD_PLUGIN_CODE,
} from '../engine/defaultPlugins';

const DEFAULT_PLUGIN_REGISTRY: Record<string, string> = {
  plugin_help: DEFAULT_HELP_PLUGIN_CODE,
  plugin_manager: DEFAULT_PLUGIN_MANAGER_CODE,
  plugin_dropbox_sync: DEFAULT_DROPBOX_PLUGIN_CODE,
  plugin_local_storage: DEFAULT_LOCAL_STORAGE_PLUGIN_CODE,
  plugin_file_manager: DEFAULT_FILE_MANAGER_PLUGIN_CODE,
  plugin_database_management: DEFAULT_DATABASE_MANAGEMENT_PLUGIN_CODE,
  plugin_hello_world: DEFAULT_HELLO_WORLD_PLUGIN_CODE,
};

interface PluginHostProps {
  code: string;
  pluginName: string;
  pluginId: string;
  theme?: 'vs-dark' | 'vs-light';
  gawContext: GAWContext;
  onOpenInIDE?: () => void;
}

export const PluginHost: React.FC<PluginHostProps> = ({
  code,
  pluginName,
  pluginId,
  theme = 'vs-dark',
  gawContext,
  onOpenInIDE,
}) => {
  const [restoredCode, setRestoredCode] = useState<string | null>(null);
  const effectiveCode = restoredCode ?? code;

  // Compile the TSX source code into an executable React component
  const { success, component: Component, error } = useMemo(() => {
    let res = PluginEngine.compile(effectiveCode, pluginId);
    // If the plugin failed to compile, but it is a core system plugin (especially plugin_help):
    if (!res.success && DEFAULT_PLUGIN_REGISTRY[pluginId]) {
      const fallback = PluginEngine.compile(DEFAULT_PLUGIN_REGISTRY[pluginId], pluginId);
      if (fallback.success) {
        // Automatically repair the SQLite table so the corrupted version is replaced
        try {
          SQLiteEngine.getInstance().run('UPDATE t_plugins SET code = ?, updated_at = ? WHERE id = ?;', [
            DEFAULT_PLUGIN_REGISTRY[pluginId],
            new Date().toISOString(),
            pluginId,
          ]);
          SQLiteEngine.getInstance().notifyChange(true);
        } catch (e) {
          // ignore
        }
        return fallback;
      }
    }
    return res;
  }, [effectiveCode, pluginId]);

  const handleRestoreDefault = () => {
    const factory = DEFAULT_PLUGIN_REGISTRY[pluginId];
    if (factory) {
      setRestoredCode(factory);
      try {
        SQLiteEngine.getInstance().run('UPDATE t_plugins SET code = ?, updated_at = ? WHERE id = ?;', [
          factory,
          new Date().toISOString(),
          pluginId,
        ]);
        gawContext.toast?.success?.('Plugin restored to factory default successfully.');
      } catch (e) {
        // ignore
      }
    }
  };

  if (!success || !Component) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-slate-900 text-slate-100">
        <div className="max-w-md w-full bg-slate-950 border border-amber-500/40 rounded-xl p-6 shadow-2xl">
          <h2 className="text-base font-bold text-amber-400 mb-2">Plugin Compilation Error</h2>
          <p className="text-xs text-slate-400 mb-4">
            The TypeScript / TSX source code for <strong>{pluginName}</strong> contains syntax errors.
          </p>
          <pre className="bg-slate-900 p-3 rounded text-red-400 font-mono text-xs overflow-auto max-h-40 border border-slate-800">
            {error || 'Unknown syntax error'}
          </pre>
          <div className="flex flex-col gap-2 mt-4">
            {DEFAULT_PLUGIN_REGISTRY[pluginId] && (
              <button
                onClick={handleRestoreDefault}
                className="w-full py-2 rounded bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition shadow"
              >
                Restore Factory Default Code
              </button>
            )}
            {onOpenInIDE && (
              <button
                onClick={onOpenInIDE}
                className="w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
              >
                Open in Gawkyy IDE to Fix
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <PluginErrorBoundary pluginName={pluginName} onOpenInIDE={onOpenInIDE}>
      <div className={`@container plugin-container w-full h-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${theme === 'vs-dark' ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
        <Component gaw={gawContext} />
      </div>
    </PluginErrorBoundary>
  );
};
