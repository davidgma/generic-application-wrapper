/**
 * Official Documentation:
 * - React Hooks (useState, useEffect, useRef): https://react.dev/reference/react
 * - FileReader API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/FileReader
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Cloud,
  FileCode,
  Folder,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Plus,
  ChevronRight,
  HardDrive,
} from 'lucide-react';
import { SQLiteEngine } from '../engine/sqliteEngine';
import { PluginEngine } from '../engine/pluginEngine';
import { H2BridgeEngine, formatProviderLabel } from '../engine/h2Bridge';
import { H2BridgeState, H2Provider, H2TreeNode } from '../types/storage';
import { PluginRecord } from '../types/plugin';

interface AddPluginModalProps {
  onClose: () => void;
  onPluginAdded: (plugin: PluginRecord, openInIDE?: boolean) => void;
  onOpenBridgeSettings: () => void;
  theme?: 'vs-dark' | 'vs-light';
}

const PROVIDERS: H2Provider[] = ['pcloud', 'gdrive', 'dropbox', 'local'];

export const AddPluginModal: React.FC<AddPluginModalProps> = ({
  onClose,
  onPluginAdded,
  onOpenBridgeSettings,
}) => {
  const engine = SQLiteEngine.getInstance();
  const h2Engine = H2BridgeEngine.getInstance();
  const [activeTab, setActiveTab] = useState<'h2' | 'local' | 'blank'>('h2');

  // Local File State
  const [localFileContent, setLocalFileContent] = useState<string>('');
  const [localFileName, setLocalFileName] = useState<string>('');
  const [pluginName, setPluginName] = useState<string>('');
  const [pluginCategory, setPluginCategory] = useState<string>('Custom');
  const [pluginDescription, setPluginDescription] = useState<string>('Custom dynamic TSX plugin');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clockie H2 Bridge State
  const [h2State, setH2State] = useState<H2BridgeState>(() => h2Engine.getState());
  const [selectedProvider, setSelectedProvider] = useState<H2Provider>('local');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [entries, setEntries] = useState<H2TreeNode[]>([]);
  const [h2Loading, setH2Loading] = useState(false);
  const [h2Error, setH2Error] = useState('');

  useEffect(() => {
    const unsub = h2Engine.subscribe((st) => {
      setH2State(st);
    });
    return unsub;
  }, [h2Engine]);

  // Pick first connected drive automatically when Clockie H2 connects
  useEffect(() => {
    if (h2State.status === 'connected') {
      const firstConnected = PROVIDERS.find((p) => h2State.drives[p]?.connected);
      if (firstConnected && !h2State.drives[selectedProvider]?.connected) {
        setSelectedProvider(firstConnected);
        setCurrentPath('');
      }
    }
  }, [h2State.status, h2State.drives, selectedProvider]);

  const loadH2Folder = async (provider: H2Provider, basePath: string) => {
    if (h2State.status !== 'connected') return;
    setH2Loading(true);
    setH2Error('');
    try {
      const res = await h2Engine.getClient().listFolder({
        provider,
        driveRoot: true,
        basePath,
        maxDepth: 1,
      });
      const rawNodes: H2TreeNode[] = res.nodes || res.entries || res.children || res.tree?.children || [];
      const filtered = rawNodes
        .filter((node) => node.type === 'folder' || /\.(tsx|ts|jsx|js)$/i.test(node.name || ''))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return (a.name || '').localeCompare(b.name || '');
        });
      setEntries(filtered);
    } catch (e: any) {
      setH2Error(e?.message || 'Failed to browse Clockie H2 folder.');
      setEntries([]);
    } finally {
      setH2Loading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'h2' && h2State.status === 'connected' && h2State.drives[selectedProvider]?.connected) {
      loadH2Folder(selectedProvider, currentPath);
    }
  }, [activeTab, h2State.status, selectedProvider, currentPath]);

  // Handle Local File Upload
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalFileName(file.name);
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

  const persistPlugin = (newPlugin: PluginRecord, openInIDE: boolean) => {
    engine.savePlugin(newPlugin);
    PluginEngine.clearCache(newPlugin.id);
    onPluginAdded(newPlugin, openInIDE);
    onClose();
  };

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

    persistPlugin(
      {
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
      },
      false
    );
  };

  const handleInstallH2File = async (node: H2TreeNode) => {
    setH2Loading(true);
    setH2Error('');
    try {
      const res = await h2Engine.getClient().readFile({
        provider: node.provider || selectedProvider,
        driveRoot: true,
        relativePath: node.relativePath,
        fileId: node.fileId,
        encoding: 'utf-8',
      });
      const code = res.content || '';
      const cleanName = node.name
        .replace(/\.(tsx|ts|jsx|js)$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const pluginId = `plugin_h2_${node.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      const now = new Date().toISOString();

      persistPlugin(
        {
          id: pluginId,
          name: cleanName,
          version: '1.0.0',
          enabled: 1,
          icon: 'Cloud',
          menu_category: formatProviderLabel(node.provider || selectedProvider),
          route: `/${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          description: `Imported via Clockie H2 (${formatProviderLabel(node.provider || selectedProvider)}): ${node.relativePath}`,
          code,
          created_at: now,
          updated_at: now,
        },
        false
      );
    } catch (e: any) {
      setH2Error(`Failed to import from Clockie H2: ${e?.message || 'Unknown error'}`);
    } finally {
      setH2Loading(false);
    }
  };

  const handleCreateBlank = () => {
    const name = pluginName.trim() || 'My Custom Plugin';
    const cleanId = `plugin_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
    const now = new Date().toISOString();

    const starterCode = `import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

export default function ${name.replace(/[^a-zA-Z0-9]/g, '') || 'CustomPlugin'}({ gaw }) {
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    try {
      const list = gaw.db.getTables();
      setTables(list);
      gaw.toast.info('Loaded database tables');
    } catch (err: any) {
      gaw.toast.error('Query failed: ' + err.message);
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
            <Sparkles className="w-5 h-5 text-sky-400" />
            <span>${name}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic TSX component running against embedded SQLite and Clockie H2.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
        <h3 className="font-semibold text-slate-200 mb-2">Active Tables ({tables.length}):</h3>
        <p className="text-slate-400 font-mono">{tables.join(', ') || 'No tables yet'}</p>
      </div>
    </div>
  );
}
`;

    persistPlugin(
      {
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
      },
      true
    );
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);
  const isConnected = h2State.status === 'connected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-700/60 flex items-center justify-center text-sky-400">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Add Dynamic Component</h2>
              <p className="text-[11px] text-slate-400">
                Import a TSX file via Clockie H2 drives, local disk, or create a new blank component in the IDE.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigator */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-5 pt-3 gap-2 text-xs flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('h2')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl border-2 font-bold transition cursor-pointer ${
              activeTab === 'h2'
                ? 'bg-blue-600 text-white border-blue-500 border-b-blue-600 shadow-md'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-300" />
            <span>Clockie H2 Drives</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl border-2 font-bold transition cursor-pointer ${
              activeTab === 'local'
                ? 'bg-blue-600 text-white border-blue-500 border-b-blue-600 shadow-md'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Local File</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('blank')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl border-2 font-bold transition cursor-pointer ${
              activeTab === 'blank'
                ? 'bg-blue-600 text-white border-blue-500 border-b-blue-600 shadow-md'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
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

          {/* Tab 1: Clockie H2 Drives */}
          {activeTab === 'h2' && (
            <div className="space-y-3">
              {!isConnected ? (
                <div className="text-center py-8 space-y-3">
                  <Cloud className="w-10 h-10 mx-auto text-sky-400/80" />
                  <p className="font-semibold text-white">Clockie H2 Bridge is not connected</p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Connect the Clockie H2 extension to browse and import TSX components stored across pCloud, Google Drive, Dropbox, and Local drives.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => h2Engine.reconnect()}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition cursor-pointer"
                    >
                      Reconnect Bridge
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenBridgeSettings();
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
                    >
                      Open Clockie H2 Drives
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Drive switcher */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PROVIDERS.map((prov) => {
                        const connected = Boolean(h2State.drives[prov]?.connected);
                        return (
                          <button
                            key={prov}
                            type="button"
                            disabled={!connected}
                            onClick={() => {
                              setSelectedProvider(prov);
                              setCurrentPath('');
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                              selectedProvider === prov
                                ? 'bg-blue-600 text-white border-blue-500'
                                : connected
                                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                                : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {formatProviderLabel(prov)}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => loadH2Folder(selectedProvider, currentPath)}
                      disabled={h2Loading}
                      className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${h2Loading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* Breadcrumbs */}
                  <div className="flex items-center gap-1 text-[11px] font-mono bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setCurrentPath('')}
                      className="text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      /
                    </button>
                    {breadcrumbs.map((seg, idx) => {
                      const pathToHere = breadcrumbs.slice(0, idx + 1).join('/');
                      return (
                        <React.Fragment key={pathToHere}>
                          <ChevronRight className="w-3 h-3 text-slate-600" />
                          <button
                            type="button"
                            onClick={() => setCurrentPath(pathToHere)}
                            className="text-sky-400 hover:text-sky-300 cursor-pointer"
                          >
                            {seg}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {h2Error && (
                    <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-red-300 text-xs">
                      {h2Error}
                    </div>
                  )}

                  {entries.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      {h2Loading
                        ? `Loading ${formatProviderLabel(selectedProvider)}...`
                        : 'No folders or .tsx/.ts/.js plugin files found in this folder.'}
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden bg-slate-950 max-h-60 overflow-y-auto">
                      {entries.map((item) => (
                        <div
                          key={item.fileId || item.folderId || item.relativePath}
                          className="flex items-center justify-between p-2.5 hover:bg-slate-900 transition"
                        >
                          {item.type === 'folder' ? (
                            <button
                              type="button"
                              onClick={() => setCurrentPath(item.relativePath)}
                              className="flex items-center gap-2.5 truncate text-left flex-1 cursor-pointer"
                            >
                              <Folder className="w-4 h-4 text-sky-400 flex-shrink-0" />
                              <span className="font-semibold text-slate-200 truncate">{item.name}</span>
                            </button>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5 truncate">
                                <FileCode className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <div className="truncate">
                                  <p className="font-semibold text-slate-200 truncate">{item.name}</p>
                                  <p className="text-[10px] text-slate-500 font-mono truncate">
                                    {(((item.sizeBytes ?? item.size ?? 0) / 1024)).toFixed(1)} KB • {item.relativePath}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleInstallH2File(item)}
                                disabled={h2Loading}
                                className="flex items-center gap-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow transition disabled:opacity-50 cursor-pointer"
                              >
                                <span>Import</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Local File */}
          {activeTab === 'local' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition hover:bg-slate-900/60 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".tsx,.ts,.jsx,.js"
                  onChange={handleLocalFileChange}
                  className="hidden"
                />
                <Upload className="w-8 h-8 mx-auto text-slate-500 group-hover:text-sky-400 transition mb-2" />
                <p className="font-semibold text-white">
                  {localFileName ? localFileName : 'Select a .tsx component file'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Choose any React TSX component directly from your computer.
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
                      Component Display Name:
                    </label>
                    <input
                      type="text"
                      value={pluginName}
                      onChange={(e) => setPluginName(e.target.value)}
                      placeholder="e.g. Orders Management Desk"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
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
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
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
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleInstallLocal}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-white text-xs shadow-md transition cursor-pointer"
                  >
                    Install into SQLite Database
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Blank Component in IDE */}
          {activeTab === 'blank' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                  Component Name:
                </label>
                <input
                  type="text"
                  value={pluginName}
                  onChange={(e) => setPluginName(e.target.value)}
                  placeholder="e.g. Sales Pipeline Tracker"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
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
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
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
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                Creates a starter React TSX component wired to SQLite and Clockie H2 and opens it immediately in the Monaco IDE.
              </p>

              <button
                onClick={handleCreateBlank}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-white text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
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
