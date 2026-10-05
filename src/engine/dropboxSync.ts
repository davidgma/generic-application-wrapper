import { SQLiteEngine } from './sqliteEngine';
import { DropboxConfig, StorageTarget } from '../types/storage';
import { FileStorageEngine } from './fileStorage';
import { RecentFilesManager } from './recentFiles';

export interface DropboxFileItem {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size: number;
  server_modified: string;
  rev: string;
}

export class DropboxSyncEngine {
  private static instance: DropboxSyncEngine | null = null;
  private config: DropboxConfig = {
    clientId: '',
    accessToken: '',
    connected: false,
  };
  private currentRemoteFile: DropboxFileItem | null = null;
  private autoSyncIntervalSec: number = 60;
  private isAutoSyncEnabled: boolean = false;
  private lastDropboxSyncRev: string | null = null;
  private lastDropboxSyncRemoteTime: string | null = null;
  private lastDropboxSyncInternalTime: number | null = null;
  private activeTarget: StorageTarget = 'local';
  private autoSyncTimer: any = null;
  private lastSyncTime: Date | null = null;
  private listeners: Set<(config: DropboxConfig) => void> = new Set();
  private static processedCodes: Set<string> = new Set();
  private static activeExchanges: Map<string, Promise<boolean>> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;

  private constructor() {
    this.loadPersistedConfig();
    this.setupCrossTabSync();
    this.startAutoSync();

    FileStorageEngine.getInstance().registerRemoteSyncChecker((internalModifiedTime) => ({
      hasRemote: this.hasRemoteFile(),
      isSynced: this.isDropboxSynced(internalModifiedTime),
    }));

    SQLiteEngine.getInstance().setOnDatabaseReset(() => {
      this.resetActiveRemote();
    });
  }

  public static getInstance(): DropboxSyncEngine {
    if (!DropboxSyncEngine.instance) {
      DropboxSyncEngine.instance = new DropboxSyncEngine();
    }
    return DropboxSyncEngine.instance;
  }

  public hasRemoteFile(): boolean {
    return this.currentRemoteFile !== null;
  }

  public isDropboxSynced(internalModifiedTime: number | null): boolean {
    if (!this.currentRemoteFile) return true;
    if (internalModifiedTime === null) return true;
    return this.lastDropboxSyncInternalTime !== null && this.lastDropboxSyncInternalTime >= internalModifiedTime;
  }

  public resetActiveRemote(): void {
    this.currentRemoteFile = null;
    this.lastDropboxSyncRev = null;
    this.lastDropboxSyncRemoteTime = null;
    this.lastDropboxSyncInternalTime = null;
    this.notify();
  }

  private setupCrossTabSync(): void {
    if (typeof window === 'undefined') return;
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('gaw_dropbox_auth');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'DROPBOX_AUTH_UPDATE' || event.data?.type === 'DROPBOX_AUTH_SUCCESS') {
            this.loadPersistedConfig();
            this.notify();
          }
        };
      }
      window.addEventListener('storage', (e) => {
        if (
          e.key === 'gaw_dropbox_config' ||
          e.key === 'gaw_active_storage_target' ||
          e.key === 'gaw_dropbox_auth_broadcast'
        ) {
          this.loadPersistedConfig();
          this.notify();
        }
      });
    } catch (err) {
      console.warn('Cross-tab sync error:', err);
    }
  }

  private broadcastUpdate(): void {
    if (typeof window === 'undefined') return;
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'DROPBOX_AUTH_UPDATE',
          config: this.config,
          activeTarget: this.activeTarget,
        });
      }
      localStorage.setItem('gaw_dropbox_auth_broadcast', Date.now().toString());
    } catch (e) {
      // ignore
    }
  }

  public reloadFromStorage(): void {
    this.loadPersistedConfig();
    this.notify();
  }

  public async autoConnectIfActive(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    this.loadPersistedConfig();
    const prevTarget = (localStorage.getItem('gaw_active_storage_target') as StorageTarget) || 'local';

    if (this.config.accessToken) {
      const isValid = await this.validateToken();
      if (isValid) {
        if (prevTarget === 'dropbox') {
          this.setActiveTarget('dropbox');
          FileStorageEngine.getInstance().setActiveTarget('dropbox');
        }
        this.notify();
        return true;
      }
      if (this.config.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const validAfter = await this.validateToken();
          if (validAfter) {
            if (prevTarget === 'dropbox') {
              this.setActiveTarget('dropbox');
              FileStorageEngine.getInstance().setActiveTarget('dropbox');
            }
            this.notify();
            return true;
          }
        }
      }
    }

    if (prevTarget === 'dropbox' && !this.config.connected) {
      this.setActiveTarget('local');
      FileStorageEngine.getInstance().setActiveTarget('local');
    }
    return false;
  }

  private loadPersistedConfig(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('gaw_dropbox_config');
      if (stored) {
        this.config = JSON.parse(stored);
        if (this.config.accessToken) {
          // Optimistically maintain connected state while validating in background
          this.config.connected = true;
          this.validateToken().catch(() => {});
        }
      }
      const savedEnabled = localStorage.getItem('gaw_dropbox_auto_sync_enabled');
      const savedInterval = localStorage.getItem('gaw_dropbox_auto_sync_interval');
      if (savedEnabled !== null) {
        this.isAutoSyncEnabled = savedEnabled === 'true';
      } else {
        this.isAutoSyncEnabled = false;
      }
      if (savedInterval !== null) {
        this.autoSyncIntervalSec = parseInt(savedInterval, 10) || 60;
      } else {
        this.autoSyncIntervalSec = 60;
      }
      const savedTarget = localStorage.getItem('gaw_active_storage_target');
      if (savedTarget === 'local' || savedTarget === 'dropbox') {
        this.activeTarget = savedTarget as StorageTarget;
      }
    } catch (e) {
      console.error('Failed to load Dropbox config:', e);
    }
  }

  private saveConfig(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('gaw_dropbox_config', JSON.stringify(this.config));
    } catch (e) {
      console.error('Failed to persist Dropbox config:', e);
    }
    this.broadcastUpdate();
    this.notify();
  }

  public subscribe(listener: (config: DropboxConfig) => void): () => void {
    this.listeners.add(listener);
    listener(this.getConfig());
    return () => this.listeners.delete(listener);
  }

  public notify(): void {
    const cfg = this.getConfig();
    this.listeners.forEach((fn) => {
      try {
        fn(cfg);
      } catch (e) {
        console.error(e);
      }
    });
  }

  public getConfig(): DropboxConfig {
    return {
      ...this.config,
      lastSyncTime: this.lastSyncTime,
      autoSyncIntervalSec: this.autoSyncIntervalSec,
      isAutoSyncEnabled: this.isAutoSyncEnabled,
      activeTarget: this.activeTarget,
    };
  }

  public getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  public getActiveTarget(): StorageTarget {
    return this.activeTarget;
  }

  public setActiveTarget(target: StorageTarget): void {
    this.activeTarget = target;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gaw_active_storage_target', target);
    }
    this.broadcastUpdate();
    this.notify();
  }

  public setAutoSyncInterval(seconds: number): void {
    this.autoSyncIntervalSec = seconds;
    this.isAutoSyncEnabled = seconds > 0;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gaw_dropbox_auto_sync_interval', seconds.toString());
      localStorage.setItem('gaw_dropbox_auto_sync_enabled', this.isAutoSyncEnabled.toString());
    }
    this.startAutoSync();
    this.notify();
  }

  public setAutoSyncEnabled(enabled: boolean): void {
    this.isAutoSyncEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gaw_dropbox_auto_sync_enabled', enabled.toString());
    }
    this.startAutoSync();
    this.notify();
  }

  private startAutoSync(): void {
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
    if (!this.isAutoSyncEnabled || this.autoSyncIntervalSec <= 0) return;

    this.autoSyncTimer = setInterval(async () => {
      // Act independently: runs whenever Dropbox is connected and enabled
      if (this.config.connected && this.config.accessToken) {
        try {
          await this.checkAndReconcileDropbox();
        } catch (err) {
          console.error('Dropbox auto-sync background error:', err);
        }
      }
    }, this.autoSyncIntervalSec * 1000);
  }

  public getCurrentRemoteFile(): DropboxFileItem | null {
    return this.currentRemoteFile;
  }

  public async setAccessToken(token: string): Promise<boolean> {
    this.config.accessToken = token.trim();
    return this.validateToken();
  }

  public setClientId(clientId: string): void {
    this.config.clientId = clientId.trim();
    this.saveConfig();
  }

  public disconnect(): void {
    this.config.accessToken = '';
    this.config.connected = false;
    this.config.accountEmail = undefined;
    this.config.accountName = undefined;
    this.currentRemoteFile = null;
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
    this.saveConfig();
  }

  public async validateToken(): Promise<boolean> {
    if (!this.config.accessToken) {
      this.config.connected = false;
      this.saveConfig();
      return false;
    }

    try {
      const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
      });

      if (!res.ok) {
        if (this.config.refreshToken) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return this.validateToken();
          }
        }
        if (res.status === 401 || res.status === 400) {
          this.config.connected = false;
          this.saveConfig();
          return false;
        }
      }

      const data = await res.json();
      this.config.connected = true;
      this.config.accountEmail = data.email;
      this.config.accountName = data.name?.display_name || data.email;
      this.saveConfig();
      return true;
    } catch (err) {
      // Network failure / offline - retain existing token and connection
      return !!this.config.accessToken;
    }
  }

  // --- OAuth PKCE Generator ---
  public static async generatePKCE(): Promise<{ verifier: string; challenge: string }> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const verifier = Array.from(array, (b) => ('0' + b.toString(16)).slice(-2)).join('');

    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return { verifier, challenge };
  }

  public async initiateOAuthFlow(clientId: string, redirectUri: string): Promise<void> {
    const { verifier, challenge } = await DropboxSyncEngine.generatePKCE();
    sessionStorage.setItem('dropbox_code_verifier', verifier);
    sessionStorage.setItem('dropbox_client_id', clientId);
    sessionStorage.setItem('dropbox_redirect_uri', redirectUri);
    localStorage.setItem('dropbox_code_verifier', verifier);
    localStorage.setItem('dropbox_client_id', clientId);
    localStorage.setItem('dropbox_redirect_uri', redirectUri);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri,
      token_access_type: 'offline',
    });

    const authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
    const popup = window.open(authUrl, 'dropbox_oauth', 'width=600,height=700');
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = authUrl;
    }
  }

  public async exchangeCode(code: string, redirectUri?: string): Promise<boolean> {
    const trimmedCode = code.trim();
    if (DropboxSyncEngine.processedCodes.has(trimmedCode)) {
      return true;
    }
    if (DropboxSyncEngine.activeExchanges.has(trimmedCode)) {
      return DropboxSyncEngine.activeExchanges.get(trimmedCode)!;
    }

    const exchangePromise = (async () => {
      const verifier =
        sessionStorage.getItem('dropbox_code_verifier') ||
        localStorage.getItem('dropbox_code_verifier');
      const clientId =
        sessionStorage.getItem('dropbox_client_id') ||
        localStorage.getItem('dropbox_client_id') ||
        this.config.clientId;
      const finalRedirectUri =
        sessionStorage.getItem('dropbox_redirect_uri') ||
        localStorage.getItem('dropbox_redirect_uri') ||
        redirectUri ||
        `${window.location.origin}/`;

      if (!verifier || !clientId) throw new Error('Missing PKCE verifier or client ID');

      const params = new URLSearchParams({
        code: trimmedCode,
        grant_type: 'authorization_code',
        client_id: clientId.trim(),
        code_verifier: verifier.trim(),
        redirect_uri: finalRedirectUri,
      });

      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('Dropbox token exchange error:', err);
        throw new Error(`Dropbox token exchange failed: ${err}`);
      }

      const data = await res.json();
      this.config.accessToken = data.access_token;
      if (data.refresh_token) this.config.refreshToken = data.refresh_token;
      this.config.clientId = clientId;
      this.config.connected = true;

      sessionStorage.removeItem('dropbox_code_verifier');
      localStorage.removeItem('dropbox_code_verifier');
      this.saveConfig();

      await this.validateToken();

      this.setActiveTarget('dropbox');
      FileStorageEngine.getInstance().setActiveTarget('dropbox');
      DropboxSyncEngine.processedCodes.add(trimmedCode);
      this.broadcastUpdate();
      this.notify();
      return true;
    })();

    DropboxSyncEngine.activeExchanges.set(trimmedCode, exchangePromise);
    try {
      return await exchangePromise;
    } finally {
      DropboxSyncEngine.activeExchanges.delete(trimmedCode);
    }
  }

  public async refreshAccessToken(): Promise<boolean> {
    if (!this.config.refreshToken || !this.config.clientId) return false;
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
      });
      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.config.accessToken = data.access_token;
      this.saveConfig();
      return true;
    } catch {
      return false;
    }
  }

  // --- List SQLite Files in Dropbox ---
  public async listDatabaseFiles(folderPath: string = ''): Promise<DropboxFileItem[]> {
    if (!this.config.accessToken) throw new Error('Dropbox not connected');

    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: folderPath,
        recursive: false,
        include_media_info: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list Dropbox files: ${err}`);
    }

    const data = await res.json();
    const entries: any[] = data.entries || [];

    // Filter to .db, .sqlite, .sqlite3 files or folders
    return entries
      .filter((e) => e['.tag'] === 'file' && /\.(db|sqlite|sqlite3)$/i.test(e.name))
      .map((e) => ({
        id: e.id,
        name: e.name,
        path_lower: e.path_lower,
        path_display: e.path_display,
        size: e.size,
        server_modified: e.server_modified,
        rev: e.rev,
      }));
  }

  // --- List Plugin Files (.tsx, .ts, .js) in Dropbox ---
  public async listPluginFiles(folderPath: string = ''): Promise<DropboxFileItem[]> {
    if (!this.config.accessToken) throw new Error('Dropbox not connected');

    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: folderPath,
        recursive: false,
        include_media_info: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list Dropbox plugin files: ${err}`);
    }

    const data = await res.json();
    const entries: any[] = data.entries || [];

    return entries
      .filter((e) => e['.tag'] === 'file' && /\.(tsx|ts|jsx|js)$/i.test(e.name))
      .map((e) => ({
        id: e.id,
        name: e.name,
        path_lower: e.path_lower,
        path_display: e.path_display,
        size: e.size,
        server_modified: e.server_modified,
        rev: e.rev,
      }));
  }

  // --- Download Text Content (e.g. Plugin code) from Dropbox ---
  public async downloadFileText(fileItem: DropboxFileItem): Promise<string> {
    if (!this.config.accessToken) throw new Error('Dropbox not connected');

    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: fileItem.path_display }),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download ${fileItem.name} from Dropbox`);
    }

    return await res.text();
  }

  // --- Download Database from Dropbox ---
  public async downloadFile(fileItem: DropboxFileItem): Promise<boolean> {
    if (!this.config.accessToken) throw new Error('Dropbox not connected');

    const res = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: fileItem.path_display }),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download ${fileItem.name} from Dropbox`);
    }

    const buffer = await res.arrayBuffer();
    const binary = new Uint8Array(buffer);

    const engine = SQLiteEngine.getInstance();
    engine.loadBinary(binary, fileItem.name);

    RecentFilesManager.addRecentFile({
      name: fileItem.name,
      source: 'dropbox',
      path: fileItem.path_display,
      size: fileItem.size,
    });

    this.currentRemoteFile = fileItem;
    this.lastSyncTime = new Date();
    this.setActiveTarget('dropbox');
    FileStorageEngine.getInstance().setActiveTarget('dropbox');
    return true;
  }

  // --- Upload / Save Active Database to Dropbox ---
  public async uploadActiveDatabase(targetPath?: string): Promise<DropboxFileItem> {
    if (!this.config.accessToken) throw new Error('Dropbox not connected');

    const engine = SQLiteEngine.getInstance();
    const binary = engine.exportBinary();
    const path = targetPath || this.currentRemoteFile?.path_display || `/${engine.activeDbName}`;

    // Upload with overwrite mode or rev check
    const apiArg: any = {
      path,
      mode: { '.tag': 'overwrite' },
      autorename: false,
      mute: false,
      strict_conflict: false,
    };

    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify(apiArg),
        'Content-Type': 'application/octet-stream',
      },
      body: new Blob([binary as any]),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to upload to Dropbox: ${err}`);
    }

    const data = await res.json();
    const savedItem: DropboxFileItem = {
      id: data.id,
      name: data.name,
      path_lower: data.path_lower,
      path_display: data.path_display,
      size: data.size,
      server_modified: data.server_modified,
      rev: data.rev,
    };

    this.currentRemoteFile = savedItem;
    this.lastSyncTime = new Date();
    this.lastDropboxSyncRev = savedItem.rev;
    this.lastDropboxSyncRemoteTime = savedItem.server_modified;
    this.lastDropboxSyncInternalTime = FileStorageEngine.getInstance().getInternalStateModifiedTime();
    return savedItem;
  }

  // --- Manual Save to Dropbox ---
  public async save(): Promise<DropboxFileItem> {
    const item = await this.uploadActiveDatabase();
    const storage = FileStorageEngine.getInstance();
    this.lastDropboxSyncRev = item.rev;
    this.lastDropboxSyncRemoteTime = item.server_modified;
    this.lastDropboxSyncInternalTime = storage.getInternalStateModifiedTime() || Date.now();
    if (storage.isLocalSynced()) {
      storage.markSaved();
    }
    RecentFilesManager.addRecentFile({
      name: item.name,
      source: 'dropbox',
      path: item.path_display,
      size: item.size,
    });
    this.notify();
    return item;
  }

  // --- Manual Save As... to Dropbox ---
  public async saveAs(suggestedName?: string): Promise<DropboxFileItem> {
    const engine = SQLiteEngine.getInstance();
    const defaultName = suggestedName || engine.activeDbName || 'new_database.sqlite';
    const cleanName = defaultName.endsWith('.db') || defaultName.endsWith('.sqlite') || defaultName.endsWith('.sqlite3')
      ? defaultName
      : `${defaultName}.sqlite`;

    const item = await this.uploadActiveDatabase('/' + cleanName);
    const storage = FileStorageEngine.getInstance();
    engine.activeDbName = item.name;
    this.currentRemoteFile = item;
    this.lastDropboxSyncRev = item.rev;
    this.lastDropboxSyncRemoteTime = item.server_modified;
    this.lastDropboxSyncInternalTime = storage.getInternalStateModifiedTime() || Date.now();
    storage.setFileName(item.name);
    if (storage.isLocalSynced()) {
      storage.markSaved();
    }
    RecentFilesManager.addRecentFile({
      name: item.name,
      source: 'dropbox',
      path: item.path_display,
      size: item.size,
    });
    this.notify();
    engine.notifyChange();
    return item;
  }

  // --- Auto-Sync Scheduler & 4-Way Reconciliation for Dropbox ---
  public async checkAndReconcileDropbox(): Promise<void> {
    if (!this.config.connected || !this.config.accessToken || !this.isAutoSyncEnabled || this.autoSyncIntervalSec <= 0) {
      return;
    }
    const engine = SQLiteEngine.getInstance();
    const targetPath = this.currentRemoteFile?.path_display || `/${engine.activeDbName}`;

    try {
      const res = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: targetPath,
          include_media_info: false,
          include_deleted: false,
          include_has_explicit_shared_members: false,
        }),
      });

      const internalModified = FileStorageEngine.getInstance().getInternalStateModifiedTime();
      const hasUserModifications = FileStorageEngine.getInstance().hasModifications();
      const internalHasChanged =
        hasUserModifications &&
        internalModified !== null &&
        (this.lastDropboxSyncInternalTime === null || internalModified > this.lastDropboxSyncInternalTime);

      if (!res.ok) {
        if (res.status === 409 && internalHasChanged) {
          // File does not exist remotely, upload it
          await this.save();
        }
        return;
      }

      const meta = await res.json();
      const remoteRev = meta.rev;
      const remoteHasChanged = this.lastDropboxSyncRev !== null && remoteRev !== this.lastDropboxSyncRev;

      // Rule 1: Neither has changed -> do nothing
      if (!internalHasChanged && !remoteHasChanged) {
        return;
      }

      // Rule 2: Internal state changed, remote unchanged -> overwrite remote file
      if (internalHasChanged && !remoteHasChanged) {
        await this.save();
        return;
      }

      // Rule 3: Remote changed, internal unchanged -> bring internal into line with remote
      if (!internalHasChanged && remoteHasChanged) {
        await this.downloadFile(meta);
        this.lastDropboxSyncRev = meta.rev;
        this.lastDropboxSyncRemoteTime = meta.server_modified;
        this.lastDropboxSyncInternalTime = null;
        FileStorageEngine.getInstance().setInternalStateModifiedTime(null);
        FileStorageEngine.getInstance().setUserModified(false);
        FileStorageEngine.getInstance().markSaved();
        return;
      }

      // Rule 4: Both changed -> attempt to reconcile internal with remote
      if (internalHasChanged && remoteHasChanged) {
        try {
          const downloadRes = await fetch('https://content.dropboxapi.com/2/files/download', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.config.accessToken}`,
              'Dropbox-API-Arg': JSON.stringify({ path: targetPath }),
            },
          });
          if (downloadRes.ok) {
            const buf = await downloadRes.arrayBuffer();
            const remoteBinary = new Uint8Array(buf);
            const engine = SQLiteEngine.getInstance();
            const result = engine.attemptReconcile(remoteBinary);

            if (result.success) {
              const savedItem = await this.uploadActiveDatabase(targetPath);
              this.lastDropboxSyncRev = savedItem.rev;
              this.lastDropboxSyncRemoteTime = savedItem.server_modified;
              this.lastDropboxSyncInternalTime = FileStorageEngine.getInstance().getInternalStateModifiedTime();
              FileStorageEngine.getInstance().setUserModified(false);
              FileStorageEngine.getInstance().markSaved();
              this.notify();
              return;
            }
          }
        } catch (reconcileErr) {
          console.warn('Dropbox auto-sync reconciliation attempt error:', reconcileErr);
        }

        console.warn('Dropbox auto-sync conflict: both local and remote changed and could not be automatically reconciled');
        const storage = FileStorageEngine.getInstance();
        storage.markDirty(true);
      }
    } catch (err) {
      console.error('Dropbox auto-sync check error:', err);
    }
  }
}
