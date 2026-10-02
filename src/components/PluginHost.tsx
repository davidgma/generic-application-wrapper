import React, { useMemo } from 'react';
import { PluginEngine, PluginErrorBoundary } from '../engine/pluginEngine';
import { GAWContext } from '../types/plugin';

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
  // Compile the TSX source code into an executable React component
  const { success, component: Component, error } = useMemo(() => {
    return PluginEngine.compile(code, pluginId);
  }, [code, pluginId]);

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
          {onOpenInIDE && (
            <button
              onClick={onOpenInIDE}
              className="mt-4 w-full py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
            >
              Open in GAW IDE to Fix
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <PluginErrorBoundary pluginName={pluginName} onOpenInIDE={onOpenInIDE}>
      <div className="w-full h-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <Component gaw={gawContext} />
      </div>
    </PluginErrorBoundary>
  );
};
