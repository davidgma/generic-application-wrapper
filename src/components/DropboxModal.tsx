import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Download,
  Upload,
  RefreshCw,
  X,
  CheckCircle,
  ExternalLink,
  Key,
  Folder,
  File,
} from 'lucide-react';
import { DropboxSyncEngine, DropboxFileItem } from '../engine/dropboxSync';
import { DropboxConfig } from '../types/storage';

interface DropboxModalProps {
  onClose: () => void;
  onFileLoaded?: (fileName: string) => void;
}

export const DropboxModal: React.FC<DropboxModalProps> = ({ onClose, onFileLoaded }) => {
  const dropbox = DropboxSyncEngine.getInstance();
  const [config, setConfig] = useState<DropboxConfig>(dropbox.getConfig());
  const [files, setFiles] = useState<DropboxFileItem[]>([]);
  const [tokenInput, setTokenInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState(config.clientId || '');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    const unsub = dropbox.subscribe((cfg) => {
      setConfig(cfg);
      if (cfg.connected) {
        loadFiles();
      }
    });
    if (config.connected) {
      loadFiles();
    }
    return unsub;
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    setStatusMsg('Listing SQLite files in Dropbox...');
    try {
      const items = await dropbox.listDatabaseFiles('');
      setFiles(items);
      setStatusMsg('');
    } catch (e: any) {
      setStatusMsg('Failed to list files: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setLoading(true);
    setStatusMsg('Connecting with token...');
    const ok = await dropbox.setAccessToken(tokenInput);
    if (ok) {
      setStatusMsg('Connected successfully!');
      setTokenInput('');
      await loadFiles();
    } else {
      setStatusMsg('Invalid or expired Dropbox token.');
    }
    setLoading(false);
  };

  const handlePKCEAuth = async () => {
    if (!clientIdInput.trim()) {
      alert('Please enter your Dropbox App Key (Client ID)');
      return;
    }
    const redirectUri = `${window.location.origin}/auth/callback`;
    dropbox.setClientId(clientIdInput);
    await dropbox.initiateOAuthFlow(clientIdInput, redirectUri);
  };

  const handleDownload = async (fileItem: DropboxFileItem) => {
    setLoading(true);
    setStatusMsg(`Downloading ${fileItem.name}...`);
    try {
      await dropbox.downloadFile(fileItem);
      setStatusMsg(`Loaded ${fileItem.name}`);
      if (onFileLoaded) onFileLoaded(fileItem.name);
      onClose();
    } catch (e: any) {
      setStatusMsg('Download failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadActive = async () => {
    setLoading(true);
    setStatusMsg('Uploading database to Dropbox...');
    try {
      const res = await dropbox.uploadActiveDatabase();
      setStatusMsg(`Saved to Dropbox: ${res.name}`);
      await loadFiles();
    } catch (e: any) {
      setStatusMsg('Upload failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 text-slate-100 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Dropbox Two-Way Cloud Sync</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {/* Connection Status */}
          {config.connected ? (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-semibold text-emerald-300">Connected to Dropbox</div>
                  <div className="text-[11px] text-slate-400">{config.accountName} ({config.accountEmail})</div>
                </div>
              </div>
              <button
                onClick={() => dropbox.disconnect()}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Token Quick Connect */}
              <form onSubmit={handleConnectToken} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Key className="w-4 h-4 text-indigo-400" />
                  <span>Connect with Dropbox Access Token</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Generate a scoped access token in your Dropbox App Console (<code className="text-indigo-300">files.content.read</code>, <code className="text-indigo-300">files.content.write</code>).
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="sl.B_... or OAuth Token"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !tokenInput.trim()}
                    className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition"
                  >
                    Connect
                  </button>
                </div>
              </form>

              {/* OAuth PKCE Flow */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="font-semibold text-white block">Or Connect via OAuth PKCE (Client ID)</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Dropbox App Key (Client ID)"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handlePKCEAuth}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                  >
                    Launch Auth
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Files List if Connected */}
          {config.connected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">SQLite Databases in Dropbox</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadFiles}
                    disabled={loading}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Refresh list"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleUploadActive}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Active DB</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-800 rounded-lg bg-slate-950/60 divide-y divide-slate-800 max-h-56 overflow-auto">
                {files.map((file) => (
                  <div key={file.id} className="p-3 flex items-center justify-between hover:bg-slate-800/40 transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <File className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold text-white truncate">{file.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {(file.size / 1024).toFixed(1)} KB • {new Date(file.server_modified).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={loading}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white font-medium text-xs transition flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Open</span>
                    </button>
                  </div>
                ))}
                {files.length === 0 && !loading && (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    No .db or .sqlite files found in Dropbox root. Click <strong>Upload Active DB</strong> to sync one!
                  </div>
                )}
              </div>
            </div>
          )}

          {statusMsg && (
            <div className="text-xs text-indigo-400 font-mono italic">{statusMsg}</div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
