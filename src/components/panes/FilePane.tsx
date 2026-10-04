import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  PlusCircle,
  HardDrive,
  Cloud,
  Layers,
  Sparkles,
  Save,
  Download,
  Trash2,
  Clock,
  ExternalLink,
  Database,
  CheckCircle2,
  ArrowRight,
  FileText,
  X,
  Edit2,
  Check,
  Building2,
  Tag
} from 'lucide-react';
import { StorageMetadata } from '../../types/storage';
import { RecentFileItem, RecentFilesManager } from '../../engine/recentFiles';
import { DropboxSyncEngine } from '../../engine/dropboxSync';
import { FileStorageEngine } from '../../engine/fileStorage';
import { SQLiteEngine } from '../../engine/sqliteEngine';

interface FilePaneProps {
  storageMeta: StorageMetadata;
  theme: 'vs-dark' | 'vs-light';
  onNewDatabase: () => void;
  onOpenFile: () => void;
  onOpenDropbox: () => void;
  onOpenFileManager: () => void;
  onOpenDemo: () => void;
  onOpenSettings: () => void;
  onOpenPlugin: (pluginId: string) => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  onConfirm: (message: string) => Promise<boolean>;
}

export const FilePane: React.FC<FilePaneProps> = ({
  storageMeta,
  theme,
  onNewDatabase,
  onOpenFile,
  onOpenDropbox,
  onOpenFileManager,
  onOpenDemo,
  onOpenSettings,
  onOpenPlugin,
  onToast,
  onConfirm,
}) => {
  const isDark = theme === 'vs-dark';
  const [recentFiles, setRecentFiles] = useState<RecentFileItem[]>(() =>
    RecentFilesManager.getRecentFiles()
  );
  const [dropboxConfig, setDropboxConfig] = useState(() =>
    DropboxSyncEngine.getInstance().getConfig()
  );

  // Active Database Information (Editable)
  const [appTitle, setAppTitle] = useState(() =>
    SQLiteEngine.getInstance().getSetting('app_title', 'New Application')
  );
  const [companyName, setCompanyName] = useState(() =>
    SQLiteEngine.getInstance().getSetting('company_name', 'None')
  );
  const [dbName, setDbName] = useState(() =>
    storageMeta.fileName || SQLiteEngine.getInstance().activeDbName || 'new_database.sqlite'
  );

  // Field being edited inline
  const [editingField, setEditingField] = useState<'dbName' | 'appTitle' | 'companyName' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Save As modal state ('local' | 'dropbox' | null)
  const [saveAsTarget, setSaveAsTarget] = useState<'local' | 'dropbox' | null>(null);
  const [saveAsNewName, setSaveAsNewName] = useState<string>('');

  useEffect(() => {
    const unsubDropbox = DropboxSyncEngine.getInstance().subscribe((cfg) => {
      setDropboxConfig(cfg);
    });
    return unsubDropbox;
  }, []);

  useEffect(() => {
    const updateFromEngine = () => {
      const engine = SQLiteEngine.getInstance();
      setAppTitle(engine.getSetting('app_title', 'New Application'));
      setCompanyName(engine.getSetting('company_name', 'None'));
      setDbName(storageMeta.fileName || engine.activeDbName || 'new_database.sqlite');
    };

    const unsub = SQLiteEngine.getInstance().subscribe(updateFromEngine);
    updateFromEngine();
    return unsub;
  }, [storageMeta.fileName]);

  const refreshRecent = () => {
    setRecentFiles(RecentFilesManager.getRecentFiles());
  };

  const handleStartEdit = (field: 'dbName' | 'appTitle' | 'companyName') => {
    setEditingField(field);
    if (field === 'dbName') setTempValue(dbName);
    if (field === 'appTitle') setTempValue(appTitle);
    if (field === 'companyName') setTempValue(companyName);
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setTempValue('');
  };

  const handleSaveEdit = () => {
    const clean = tempValue.trim();
    if (!clean && editingField === 'dbName') {
      onToast('warning', 'Database file name cannot be empty.');
      return;
    }

    const engine = SQLiteEngine.getInstance();
    const storage = FileStorageEngine.getInstance();

    if (editingField === 'dbName') {
      const finalName = clean.endsWith('.sqlite') || clean.endsWith('.db') || clean.endsWith('.sqlite3')
        ? clean
        : `${clean}.sqlite`;

      storage.setFileName(finalName);
      const dropbox = DropboxSyncEngine.getInstance();
      const remote = dropbox.getCurrentRemoteFile();
      if (remote) {
        remote.name = finalName;
        remote.path_display = '/' + finalName;
        remote.path_lower = ('/' + finalName).toLowerCase();
      }
      storage.markDirty(true);
      setDbName(finalName);
      onToast('success', `Database file name changed to ${finalName}`);
    } else if (editingField === 'appTitle') {
      const titleVal = clean || 'New Application';
      engine.setSetting('app_title', titleVal);
      storage.markDirty(true);
      engine.notifyChange();
      setAppTitle(titleVal);
      onToast('success', `Application Title updated to "${titleVal}"`);
    } else if (editingField === 'companyName') {
      const compVal = clean || 'None';
      engine.setSetting('company_name', compVal);
      storage.markDirty(true);
      engine.notifyChange();
      setCompanyName(compVal);
      onToast('success', `Organization Name updated to "${compVal}"`);
    }

    setEditingField(null);
    setTempValue('');
  };

  // --- Save Operations ---
  const handleSaveLocal = async () => {
    try {
      const ok = await FileStorageEngine.getInstance().save();
      if (ok) {
        refreshRecent();
        onToast('success', 'Database saved as local file.');
      }
    } catch (err: any) {
      onToast('error', `Failed to save local file: ${err.message || String(err)}`);
    }
  };

  const handleSaveDropbox = async () => {
    if (!dropboxConfig.connected) {
      onToast('warning', 'Dropbox is not connected. Opening Dropbox connection...');
      onOpenDropbox();
      return;
    }

    try {
      const item = await DropboxSyncEngine.getInstance().uploadActiveDatabase();
      FileStorageEngine.getInstance().markSaved();
      RecentFilesManager.addRecentFile({
        name: item.name,
        source: 'dropbox',
        path: item.path_display,
        size: item.size,
      });
      refreshRecent();
      onToast('success', `Saved ${item.name} in Dropbox.`);
    } catch (err: any) {
      onToast('error', `Failed to save in Dropbox: ${err.message || String(err)}`);
    }
  };

  // --- Save As Operations ---
  const handleOpenSaveAs = (target: 'local' | 'dropbox') => {
    if (target === 'dropbox' && !dropboxConfig.connected) {
      onToast('warning', 'Dropbox is not connected. Please connect to Dropbox first.');
      onOpenDropbox();
      return;
    }
    const baseName = dbName.replace(/\.(db|sqlite3?)$/i, '');
    setSaveAsNewName(`${baseName}_copy.sqlite`);
    setSaveAsTarget(target);
  };

  const handleConfirmSaveAsLocal = async () => {
    const clean = saveAsNewName.trim();
    if (!clean) {
      onToast('warning', 'Please provide a valid file name.');
      return;
    }

    const finalName = clean.endsWith('.sqlite') || clean.endsWith('.db') || clean.endsWith('.sqlite3')
      ? clean
      : `${clean}.sqlite`;

    try {
      const ok = await FileStorageEngine.getInstance().saveAs(finalName);
      if (ok) {
        setDbName(finalName);
        FileStorageEngine.getInstance().setActiveTarget('local');
        refreshRecent();
        onToast('success', `Saved copy "${finalName}" as local file and updated active database.`);
        setSaveAsTarget(null);
      }
    } catch (err: any) {
      onToast('error', `Failed to save copy: ${err.message || String(err)}`);
    }
  };

  const handleConfirmSaveAsDropbox = async () => {
    const clean = saveAsNewName.trim();
    if (!clean) {
      onToast('warning', 'Please provide a valid file name.');
      return;
    }

    const finalName = clean.endsWith('.sqlite') || clean.endsWith('.db') || clean.endsWith('.sqlite3')
      ? clean
      : `${clean}.sqlite`;

    try {
      const item = await DropboxSyncEngine.getInstance().uploadActiveDatabase('/' + finalName);
      FileStorageEngine.getInstance().setFileName(item.name);
      FileStorageEngine.getInstance().markSaved();
      FileStorageEngine.getInstance().setActiveTarget('dropbox');
      DropboxSyncEngine.getInstance().setActiveTarget('dropbox');
      RecentFilesManager.addRecentFile({
        name: item.name,
        source: 'dropbox',
        path: item.path_display,
        size: item.size,
      });
      setDbName(item.name);
      refreshRecent();
      onToast('success', `Saved copy "${item.name}" in Dropbox and updated active database.`);
      setSaveAsTarget(null);
    } catch (err: any) {
      onToast('error', `Failed to save copy in Dropbox: ${err.message || String(err)}`);
    }
  };

  const handleOpenRecent = async (file: RecentFileItem) => {
    if (file.source === 'demo') {
      onOpenDemo();
      RecentFilesManager.addRecentFile({
        name: 'Northwind Commerce Demo',
        source: 'demo',
      });
      refreshRecent();
      return;
    }

    if (file.source === 'dropbox') {
      if (!dropboxConfig.connected) {
        onToast('warning', 'Dropbox is not connected. Opening Dropbox Sync...');
        onOpenPlugin('plugin_dropbox_sync');
        return;
      }
      try {
        const ok = await DropboxSyncEngine.getInstance().downloadFile({
          id: file.id || file.name,
          name: file.name,
          path_lower: (file.path || `/${file.name}`).toLowerCase(),
          path_display: file.path || `/${file.name}`,
          size: file.size || 0,
          server_modified: new Date().toISOString(),
          rev: '',
        });
        if (ok) {
          RecentFilesManager.addRecentFile({
            name: file.name,
            source: 'dropbox',
            path: file.path,
          });
          refreshRecent();
          onToast('success', `Loaded ${file.name} from Dropbox.`);
        }
      } catch (err: any) {
        onToast('error', `Could not open Dropbox file: ${err.message || 'File not found'}`);
      }
      return;
    }

    // Local file
    onOpenFile();
  };

  const handleRemoveRecent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    RecentFilesManager.removeRecentFile(id);
    refreshRecent();
    onToast('info', 'Removed entry from recent files list.');
  };

  const handleClearRecent = () => {
    RecentFilesManager.clearRecentFiles();
    refreshRecent();
    onToast('success', 'Cleared recent files history.');
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 KB';
    const k = 1024;
    return (bytes / k).toFixed(1) + ' KB';
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-6 select-text transition-colors ${
      isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Active Database Information Card */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-sm transition-all ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          {/* Top Row: Title + Sync Status + Save Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/40">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isDark ? 'bg-blue-600/20 text-sky-400 border border-blue-500/30' : 'bg-blue-50 text-blue-900 border border-blue-200'
              }`}>
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    isDark ? 'text-sky-300/80' : 'text-blue-950'
                  }`}>
                    Active Database Information
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    storageMeta.syncStatus === 'dirty'
                      ? storageMeta.hasUserModifications
                        ? isDark ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-300'
                        : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'
                      : isDark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}>
                    {storageMeta.syncStatus === 'dirty'
                      ? storageMeta.hasUserModifications ? 'Unsaved Modifications' : 'Unsaved'
                      : 'Synchronized'}
                  </span>
                </div>
                <h2 className="text-base md:text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  {dbName}
                </h2>
              </div>
            </div>

            {/* Save Buttons & Save As Options */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Save as local file */}
              <button
                onClick={handleSaveLocal}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition active:scale-95"
                title="Save changes to local file or native disk handle"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save as local file</span>
              </button>

              {/* Save in dropbox */}
              <button
                onClick={handleSaveDropbox}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition active:scale-95"
                title={dropboxConfig.connected ? "Upload and save current database to Dropbox" : "Connect to Dropbox to save"}
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Save in dropbox</span>
              </button>

              {/* Save As Local File */}
              <button
                onClick={() => handleOpenSaveAs('local')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95 flex items-center gap-1.5 ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title="Save a copy of the database under a new name locally"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Save As Local File...</span>
              </button>

              {/* Save As Dropbox */}
              <button
                onClick={() => handleOpenSaveAs('dropbox')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95 flex items-center gap-1.5 ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
                title="Save a copy of the database under a new name in Dropbox"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Save As Dropbox...</span>
              </button>

              {/* Export raw .db */}
              <button
                onClick={() => FileStorageEngine.getInstance().exportDownload()}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95 ${
                  isDark ? 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
                }`}
                title="Download raw SQLite .db file directly"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Editable Details: Database Name, Application Title, Organization Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4 border-b border-slate-800/40">
            {/* 1. Database File Name */}
            <div className={`p-3 rounded-xl border transition ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  <Database className="w-3.5 h-3.5" />
                  <span>Database File Name</span>
                </span>
                {editingField !== 'dbName' && (
                  <button
                    onClick={() => handleStartEdit('dbName')}
                    className={`p-1 rounded hover:bg-indigo-500/10 text-indigo-400 transition`}
                    title="Change database file name"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {editingField === 'dbName' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    placeholder="database_name.sqlite"
                    className={`w-full px-2.5 py-1 rounded text-xs border font-mono font-semibold focus:outline-none focus:border-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleSaveEdit}
                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-mono font-bold text-xs md:text-sm text-slate-900 dark:text-white truncate">
                    {dbName}
                  </p>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Changes file name locally and on Dropbox.
                  </p>
                </div>
              )}
            </div>

            {/* 2. Application Title */}
            <div className={`p-3 rounded-xl border transition ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Application Title</span>
                </span>
                {editingField !== 'appTitle' && (
                  <button
                    onClick={() => handleStartEdit('appTitle')}
                    className={`p-1 rounded hover:bg-indigo-500/10 text-indigo-400 transition`}
                    title="Change application title"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {editingField === 'appTitle' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    placeholder="Application Title"
                    className={`w-full px-2.5 py-1 rounded text-xs border font-semibold focus:outline-none focus:border-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleSaveEdit}
                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-xs md:text-sm text-slate-900 dark:text-white truncate">
                    {appTitle}
                  </p>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Saved in database settings (<span className="font-mono">app_title</span>).
                  </p>
                </div>
              )}
            </div>

            {/* 3. Organization / Company Name */}
            <div className={`p-3 rounded-xl border transition ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Organization / Company</span>
                </span>
                {editingField !== 'companyName' && (
                  <button
                    onClick={() => handleStartEdit('companyName')}
                    className={`p-1 rounded hover:bg-indigo-500/10 text-indigo-400 transition`}
                    title="Change organization name"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {editingField === 'companyName' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    placeholder="Organization Name"
                    className={`w-full px-2.5 py-1 rounded text-xs border font-semibold focus:outline-none focus:border-indigo-500 ${
                      isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleSaveEdit}
                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-xs md:text-sm text-slate-900 dark:text-white truncate">
                    {companyName}
                  </p>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Saved in database settings (<span className="font-mono">company_name</span>).
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Database Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-xs">
            <div>
              <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Size</span>
              <span className="font-mono font-semibold">{formatBytes(storageMeta.fileSize)}</span>
            </div>
            <div>
              <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Storage Target</span>
              <span className="font-semibold capitalize">
                {storageMeta.activeTarget === 'dropbox' ? 'Dropbox Cloud' : storageMeta.hasFileHandle ? 'Local Disk Handle' : 'In-Memory DB'}
              </span>
            </div>
            <div>
              <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Last Saved</span>
              <span className="font-semibold">
                {storageMeta.lastSavedAt ? formatDate(storageMeta.lastSavedAt.toISOString()) : 'Not Saved Yet'}
              </span>
            </div>
            <div>
              <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Tables</span>
              <span className="font-semibold">{SQLiteEngine.getInstance().getSchema().length} tables</span>
            </div>
          </div>
        </div>

        {/* 5 Primary Launch Action Cards */}
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${
            isDark ? 'text-sky-300/90' : 'text-blue-950'
          }`}>
            Launch & Open Databases
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* 1. Create New Database */}
            <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between transition group shadow-sm ${
              isDark ? 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300'
            }`}>
              <div className="space-y-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Create New Database</h4>
                  <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Creates a fresh database named "new_database.sqlite" with the minimal starting set (System tables, Hello World, Dropbox, Local Storage, File & Plugin Managers). You can customize defaults and save locally or in Dropbox.
                  </p>
                </div>
              </div>
              <button
                onClick={onNewDatabase}
                className="mt-4 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create New Database</span>
              </button>
            </div>

            {/* 2. Open Local Database File */}
            <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between transition group shadow-sm ${
              isDark ? 'bg-slate-950/80 border-slate-800 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-300'
            }`}>
              <div className="space-y-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-blue-600/20 text-sky-400 border border-blue-500/30' : 'bg-blue-50 text-blue-900 border border-blue-200'
                }`}>
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Open Local File</h4>
                  <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Open any SQLite database file (.db, .sqlite, .sqlite3) stored directly on your computer's drive.
                  </p>
                </div>
                {/* Direct Link to API/Connect settings */}
                <div className="pt-1">
                  <button
                    onClick={() => onOpenPlugin('plugin_dropbox_sync')}
                    className={`inline-flex items-center gap-1 text-[11px] underline font-medium transition ${
                      isDark ? 'text-sky-300 hover:text-sky-200' : 'text-blue-900 hover:text-blue-950'
                    }`}
                  >
                    <span>Configure Dropbox API & Sync Settings</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <button
                onClick={onOpenFile}
                className="mt-4 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Choose Local File...</span>
              </button>
            </div>

            {/* 3. Open Dropbox Database File */}
            <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between transition group shadow-sm ${
              isDark ? 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300'
            }`}>
              <div className="space-y-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Open from Dropbox</h4>
                    {dropboxConfig.connected && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {dropboxConfig.connected
                      ? 'Browse and pull database files directly from your connected Dropbox cloud folder.'
                      : 'Connect to Dropbox for automatic cross-device cloud sync and file browsing.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <button
                  onClick={onOpenDropbox}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Cloud className="w-4 h-4" />
                  <span>{dropboxConfig.connected ? 'Browse Dropbox Files...' : 'Connect to Dropbox'}</span>
                </button>
              </div>
            </div>

            {/* 4. Open File & Workspace Manager */}
            <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between transition group shadow-sm ${
              isDark ? 'bg-slate-950/80 border-slate-800 hover:border-purple-500/50' : 'bg-white border-slate-200 hover:border-purple-300'
            }`}>
              <div className="space-y-2.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200'
                }`}>
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Workspace Manager</h4>
                  <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Full storage hub: inspect OS file handles, configure auto-save timers, and audit session logs.
                  </p>
                </div>
              </div>
              <button
                onClick={onOpenFileManager}
                className={`mt-4 w-full py-2.5 rounded-xl text-xs font-semibold border transition active:scale-95 flex items-center justify-center gap-1.5 ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                <span>Open Workspace Hub</span>
              </button>
            </div>

            {/* 5. Open Northwind Demo */}
            <div className={`p-4 md:p-5 rounded-2xl border flex flex-col justify-between transition group shadow-sm md:col-span-2 ${
              isDark
                ? 'bg-gradient-to-r from-slate-950 via-slate-950 to-indigo-950/40 border-indigo-900/50 hover:border-indigo-600/60'
                : 'bg-gradient-to-r from-white via-white to-indigo-50/60 border-indigo-200 hover:border-indigo-400'
            }`}>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isDark ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-purple-50 text-purple-700 border border-purple-200'
                  }`}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Northwind Modern Commerce Demo</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Pre-loaded Sample
                      </span>
                    </h4>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Sample relational database complete with Customer Directory CRM, Inventory Valuation, Executive KPI Pulse, queries, and reports.
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={onOpenDemo}
                className="mt-4 w-full sm:w-auto self-start px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Open Northwind Demo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Files Section */}
        <div className={`p-4 md:p-5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/40">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h3 className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-sky-300/90' : 'text-blue-950'
              }`}>
                Recent Files & Databases
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {recentFiles.length} recorded
              </span>
            </div>

            {recentFiles.length > 0 && (
              <button
                onClick={handleClearRecent}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1 border ${
                  isDark ? 'bg-slate-800 text-slate-400 hover:text-red-300 hover:bg-red-950/30 border-slate-700' : 'bg-slate-100 text-slate-600 hover:text-red-700 hover:bg-red-50 border-slate-300'
                }`}
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {recentFiles.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <FolderOpen className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                No recent database files recorded in browser local storage yet.
              </p>
              <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Open a local file, pull from Dropbox, or launch the Northwind Demo to see them here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/40 overflow-x-auto">
              {recentFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleOpenRecent(file)}
                  className={`py-2.5 px-2 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition ${
                    isDark ? 'hover:bg-slate-900' : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      file.source === 'demo'
                        ? 'bg-purple-600/20 text-purple-400'
                        : file.source === 'dropbox'
                        ? 'bg-indigo-600/20 text-indigo-400'
                        : 'bg-blue-600/20 text-blue-400'
                    }`}>
                      {file.source === 'demo' ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : file.source === 'dropbox' ? (
                        <Cloud className="w-3.5 h-3.5" />
                      ) : (
                        <HardDrive className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-slate-900 dark:text-white">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span className="capitalize">{file.source}</span>
                        <span>•</span>
                        <span>{formatDate(file.lastOpened)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRecent(file);
                      }}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition shadow"
                    >
                      Open
                    </button>
                    <button
                      onClick={(e) => handleRemoveRecent(file.id, e)}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                      title="Remove from history"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save As... Modal Dialog for Local or Dropbox */}
      {saveAsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-text">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-4 transition ${
            isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {saveAsTarget === 'dropbox' ? (
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
                    <Cloud className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                    <HardDrive className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm">
                    {saveAsTarget === 'dropbox' ? 'Save As Dropbox Copy' : 'Save As Local File'}
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    A copy of the database will be saved under this new name, and active database updated.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSaveAsTarget(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold">
                Database Copy File Name:
              </label>
              <input
                type="text"
                value={saveAsNewName}
                onChange={(e) => setSaveAsNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (saveAsTarget === 'dropbox') handleConfirmSaveAsDropbox();
                    else handleConfirmSaveAsLocal();
                  }
                }}
                placeholder="my_database_copy.sqlite"
                className={`w-full px-3 py-2 rounded-xl text-xs border font-mono font-medium focus:outline-none focus:border-indigo-500 ${
                  isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
                autoFocus
              />
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {saveAsTarget === 'dropbox'
                  ? 'File will be uploaded to your connected Dropbox root folder.'
                  : 'File will be saved to your local drive or downloaded.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setSaveAsTarget(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (saveAsTarget === 'dropbox') handleConfirmSaveAsDropbox();
                  else handleConfirmSaveAsLocal();
                }}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow flex items-center gap-1.5 ${
                  saveAsTarget === 'dropbox'
                    ? 'bg-sky-600 hover:bg-sky-500'
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
