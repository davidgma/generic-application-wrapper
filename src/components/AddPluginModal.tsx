import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Cloud,
  FileCode,
  Folder,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { SQLiteEngine } from '../engine/sqliteEngine';
import { PluginEngine } from '../engine/pluginEngine';
import { DropboxSyncEngine, DropboxFileItem } from '../engine/dropboxSync';
import { PluginRecord } from '../types/plugin';

interface AddPluginModalProps {
  onClose: () => void;
  onPluginAdded: (plugin: PluginRecord, openInIDE?: boolean) => void;
  onOpenDropboxSettings: () => void;
  theme?: 'vs-dark' | 'vs-light';
}

export const AddPluginModal: React.FC<AddPluginModalProps> = ({
  onClose,
  onPluginAdded,
  onOpenDropboxSettings,
  theme = 'vs-dark',
}) => {
  const engine = SQLiteEngine.getInstance();
  const dropbox = DropboxSyncEngine.getInstance();
  const [activeTab, setActiveTab] = useState<'local' | 'dropbox' | 'blank'>('local');

  // Local File State
  const [localFileContent, setLocalFileContent] = useState<string>('');
  const [localFileName, setLocalFileName] = useState<string>('');
  const [pluginName, setPluginName] = useState<string>('');
  const [pluginCategory, setPluginCategory] = useState<string>('Custom');
  const [pluginDescription, setPluginDescription] = useState<string>('Custom dynamic TSX plugin');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dropbox State
  const [dropboxFiles, setDropboxFiles] = useState<DropboxFileItem[]>([]);
  const [dropboxLoading, setDropboxLoading] = useState(false);
  const [dropboxError, setDropboxError] = useState('');
  const [isDropboxConnected, setIsDropboxConnected] = useState(dropbox.getConfig().connected);

  useEffect(() => {
    const unsub = dropbox.subscribe((cfg) => {
      setIsDropboxConnected(cfg.connected);
      if (cfg.connected && activeTab === 'dropbox') {
        loadDropboxPlugins();
      }
    });
    if (dropbox.getConfig().connected) {
      loadDropboxPlugins();
    }
    return unsub;
  }, [activeTab]);

  const loadDropboxPlugins = async () => {
    setDropboxLoading(true);
    setDropboxError('');
    try {
      const items = await dropbox.listPluginFiles('');
      setDropboxFiles(items);
    } catch (e: any) {
      setDropboxError(e.message || 'Failed to list plugin files from Dropbox');
    } finally {
      setDropboxLoading(false);
    }
  };

  // Handle Local File Upload
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalFileName(file.name);
    // Suggest clean plugin name: replace underscores/dashes with spaces, remove extension
    const baseName = file.name
      .replace(/\.(tsx|ts|jsx|js)$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
    setPluginName(baseName);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setLocalFileContent(content);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read local file.');
    };
    reader.readAsText(file);
  };

  // Install from Local File
  const handleInstallLocal = () => {
    if (!localFileContent) {
      setErrorMsg('Please choose a .tsx file first.');
      return;
    }
    if (!pluginName.trim()) {
      setErrorMsg('Please enter a plugin name.');
      return;
    }

    const pluginId = `plugin_${pluginName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
    const now = new Date().toISOString();

    const newPlugin: PluginRecord = {
      id: pluginId,
      name: pluginName.trim(),
      version: '1.0.0',
      enabled: 1,
      icon: 'Boxes',
      menu_category: pluginCategory,
      route: `/${pluginName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      description: pluginDescription.trim(),
      code: localFileContent,
      created_at: now,
      updated_at: now,
    };

    engine.run(
      'INSERT INTO t_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newPlugin.id,
        newPlugin.name,
        newPlugin.version,
        newPlugin.enabled,
        newPlugin.icon,
        newPlugin.menu_category,
        newPlugin.route,
        newPlugin.description,
        newPlugin.code,
        newPlugin.created_at,
        newPlugin.updated_at,
      ]
    );

    PluginEngine.clearCache(newPlugin.id);
    engine.notifyChange();
    onPluginAdded(newPlugin, false);
    onClose();
  };

  // Install from Dropbox item
  const handleInstallDropboxFile = async (item: DropboxFileItem) => {
    setDropboxLoading(true);
    setDropboxError('');
    try {
      const code = await dropbox.downloadFileText(item);
      const cleanName = item.name
        .replace(/\.(tsx|ts|jsx|js)$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const pluginId = `plugin_dbx_${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      const now = new Date().toISOString();

      const newPlugin: PluginRecord = {
        id: pluginId,
        name: cleanName,
        version: '1.0.0',
        enabled: 1,
        icon: 'Cloud',
        menu_category: 'Dropbox',
        route: `/${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        description: `Synced from Dropbox: ${item.path_display}`,
        code,
        created_at: now,
        updated_at: now,
      };

      engine.run(
        'INSERT OR REPLACE INTO t_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          newPlugin.id,
          newPlugin.name,
          newPlugin.version,
          newPlugin.enabled,
          newPlugin.icon,
          newPlugin.menu_category,
          newPlugin.route,
          newPlugin.description,
          newPlugin.code,
          newPlugin.created_at,
          newPlugin.updated_at,
        ]
      );

      PluginEngine.clearCache(newPlugin.id);
      engine.notifyChange();
      onPluginAdded(newPlugin, false);
      onClose();
    } catch (e: any) {
      setDropboxError(`Failed to import from Dropbox: ${e.message}`);
    } finally {
      setDropboxLoading(false);
    }
  };

  // Create Blank Plugin & Open in IDE
  const handleCreateBlank = () => {
    const name = pluginName.trim() || 'My Custom Plugin';
    const cleanId = `plugin_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
    const now = new Date().toISOString();

    const starterCode = `import React, { useState, useEffect } from 'react';
import { GAWContext } from 'gaw';
import { Database, Sparkles, RefreshCw } from 'lucide-react';

interface PluginProps {
  gawContext: GAWContext;
}

export default function ${name.replace(/[^a-zA-Z0-9]/g, '') || 'CustomPlugin'}({ gawContext }: PluginProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    try {
      // Execute live queries using the in-browser SQLite database
      const result = gawContext.sqlite.query('SELECT * FROM customers LIMIT 10;');
      setData(result.values);
      gawContext.ui.toast.info('Loaded customer preview');
    } catch (err: any) {
      gawContext.ui.toast.error('Query failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>${name}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic MS Access-style TSX Plugin running in SQLite.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
        <h3 className="font-semibold text-slate-200 mb-2">Query Preview (Customers):</h3>
        <p className="text-slate-400">Total rows loaded: {data.length}</p>
      </div>
    </div>
  );
}
`;

    const newPlugin: PluginRecord = {
      id: cleanId,
      name,
      version: '1.0.0',
      enabled: 1,
      icon: 'Boxes',
      menu_category: pluginCategory,
      route: `/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      description: pluginDescription.trim(),
      code: starterCode,
      created_at: now,
      updated_at: now,
    };

    engine.run(
      'INSERT INTO t_plugins (id, name, version, enabled, icon, menu_category, route, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        newPlugin.id,
        newPlugin.name,
        newPlugin.version,
        newPlugin.enabled,
        newPlugin.icon,
        newPlugin.menu_category,
        newPlugin.route,
        newPlugin.description,
        newPlugin.code,
        newPlugin.created_at,
        newPlugin.updated_at,
      ]
    );

    PluginEngine.clearCache(newPlugin.id);
    engine.notifyChange();
    onPluginAdded(newPlugin, true); // Open directly in IDE!
    onClose();
  };

  const isDark = theme === 'vs-dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-text">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Add Dynamic Plugin</h2>
              <p className="text-[11px] text-slate-400">
                Install from a local file, cloud Dropbox directory, or code a blank plugin.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigator */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition ${
              activeTab === 'local'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-amber-400" />
            <span>Local Directory / File</span>
          </button>

          <button
            onClick={() => setActiveTab('dropbox')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition ${
              activeTab === 'dropbox'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-400" />
            <span>Dropbox Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('blank')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition ${
              activeTab === 'blank'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>New Blank in IDE</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: LOCAL DIRECTORY / FILE */}
          {activeTab === 'local' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition hover:bg-slate-900/60 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".tsx,.ts,.jsx,.js"
                  onChange={handleLocalFileChange}
                  className="hidden"
                />
                <Upload className="w-8 h-8 mx-auto text-slate-500 group-hover:text-indigo-400 transition mb-2" />
                <p className="font-semibold text-white">
                  {localFileName ? localFileName : 'Select or drop a .tsx plugin file'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Choose any React TSX component from your local hard drive or folder.
                </p>
                {localFileContent && (
                  <div className="mt-2 text-emerald-400 text-[11px] font-mono flex items-center justify-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Loaded {localFileContent.split('\n').length} lines of code</span>
                  </div>
                )}
              </div>

              {localFileContent && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                      Plugin Display Name:
                    </label>
                    <input
                      type="text"
                      value={pluginName}
                      onChange={(e) => setPluginName(e.target.value)}
                      placeholder="e.g. Orders Management Desk"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                        Category:
                      </label>
                      <select
                        value={pluginCategory}
                        onChange={(e) => setPluginCategory(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Commercial">Commercial</option>
                        <option value="Logistics">Logistics</option>
                        <option value="Analytics">Analytics</option>
                        <option value="Finance">Finance</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                        Description:
                      </label>
                      <input
                        type="text"
                        value={pluginDescription}
                        onChange={(e) => setPluginDescription(e.target.value)}
                        placeholder="Brief summary..."
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleInstallLocal}
                    className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs shadow-md transition"
                  >
                    Install into SQLite Database
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DROPBOX DIRECTORY */}
          {activeTab === 'dropbox' && (
            <div className="space-y-3">
              {!isDropboxConnected ? (
                <div className="text-center py-8 space-y-3">
                  <Cloud className="w-10 h-10 mx-auto text-indigo-400/80" />
                  <p className="font-semibold text-white">Dropbox is not connected</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Connect your Dropbox account via OAuth or Access Token to sync and load TSX plugins stored in your cloud folders.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDropboxSettings();
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                  >
                    Connect Dropbox...
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-medium">
                      TSX Plugins found in Dropbox:
                    </span>
                    <button
                      onClick={loadDropboxPlugins}
                      disabled={dropboxLoading}
                      className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                    >
                      <RefreshCw className={`w-3 h-3 ${dropboxLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {dropboxError && (
                    <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                      {dropboxError}
                    </div>
                  )}

                  {dropboxFiles.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      {dropboxLoading ? (
                        <span>Scanning Dropbox for .tsx files...</span>
                      ) : (
                        <span>No .tsx plugin files found in your Dropbox root folder.</span>
                      )}
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden bg-slate-950">
                      {dropboxFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 hover:bg-slate-900 transition"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileCode className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <div className="truncate">
                              <p className="font-semibold text-slate-200 truncate">{file.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                {(file.size / 1024).toFixed(1)} KB • {file.path_display}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleInstallDropboxFile(file)}
                            disabled={dropboxLoading}
                            className="flex items-center gap-1 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition disabled:opacity-50"
                          >
                            <span>Install</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BLANK PLUGIN IN IDE */}
          {activeTab === 'blank' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                  Plugin Name:
                </label>
                <input
                  type="text"
                  value={pluginName}
                  onChange={(e) => setPluginName(e.target.value)}
                  placeholder="e.g. Sales Pipeline Tracker"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                    Category:
                  </label>
                  <select
                    value={pluginCategory}
                    onChange={(e) => setPluginCategory(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Commercial">Commercial</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Analytics">Analytics</option>
                    <option value="Finance">Finance</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                    Description:
                  </label>
                  <input
                    type="text"
                    value={pluginDescription}
                    onChange={(e) => setPluginDescription(e.target.value)}
                    placeholder="Short description..."
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                This creates a starter React TSX template connected to SQLite and immediately opens it in the internal Monaco IDE with TypeScript autocomplete and live preview.
              </p>

              <button
                onClick={handleCreateBlank}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Create & Open in Monaco IDE</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
