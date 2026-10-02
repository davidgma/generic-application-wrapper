import { SQLiteEngine } from './sqliteEngine';
import { DropboxConfig, StorageTarget } from '../types/storage';
import { FileStorageEngine } from './fileStorage';

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
  private lastSyncTime: Date | null = null;
  private autoSyncIntervalSec: number = 60;
  private isAutoSyncEnabled: boolean = true;
  private activeTarget: StorageTarget =
    typeof window !== 'undefined'
      ? ((localStorage.getItem('gaw_active_storage_target') as StorageTarget) || 'local')
      : 'local';
  private autoSyncTimer: any = null;
  private listeners: Set<(config: DropboxConfig) => void> = new Set();

  private constructor() {
    this.loadPersistedConfig();
    this.startAutoSync();
  }

  public static getInstance(): DropboxSyncEngine {
    if (!DropboxSyncEngine.instance) {
      DropboxSyncEngine.instance = new DropboxSyncEngine();
    }
    return DropboxSyncEngine.instance;
  }

  private loadPersistedConfig(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem('gaw_dropbox_config');
      if (stored) {
        this.config = JSON.parse(stored);
        if (this.config.accessToken) {
          this.validateToken();
        }
      }
      const savedInterval = localStorage.getItem('gaw_dropbox_auto_sync_interval');
      if (savedInterval) {
        this.autoSyncIntervalSec = parseInt(savedInterval, 10);
      }
      const savedAuto = localStorage.getItem('gaw_dropbox_auto_sync_enabled');
      if (savedAuto !== null) {
        this.isAutoSyncEnabled = savedAuto === 'true';
      }
      const savedTarget = localStorage.getItem('gaw_active_storage_target');
      if (savedTarget === 'local' || savedTarget === 'dropbox') {
        this.activeTarget = savedTarget;
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
      // Only auto-sync to Dropbox if Dropbox is the active sync target and is connected
      if (this.activeTarget === 'dropbox' && this.config.connected && this.config.accessToken) {
        try {
          await this.uploadActiveDatabase();
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
        this.config.connected = false;
        this.saveConfig();
        return false;
      }

      const data = await res.json();
      this.config.connected = true;
      this.config.accountEmail = data.email;
      this.config.accountName = data.name?.display_name || data.email;
      this.saveConfig();
      return true;
    } catch (err) {
      this.config.connected = false;
      this.saveConfig();
      return false;
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
    const verifier = sessionStorage.getItem('dropbox_code_verifier') || localStorage.getItem('dropbox_code_verifier');
    const clientId = sessionStorage.getItem('dropbox_client_id') || localStorage.getItem('dropbox_client_id') || this.config.clientId;
    const finalRedirectUri =
      redirectUri ||
      sessionStorage.getItem('dropbox_redirect_uri') ||
      localStorage.getItem('dropbox_redirect_uri') ||
      `${window.location.origin}/auth/callback`;

    if (!verifier || !clientId) throw new Error('Missing PKCE verifier or client ID');

    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId,
      code_verifier: verifier,
      redirect_uri: finalRedirectUri,
    });

    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Dropbox token exchange failed: ${err}`);
    }

    const data = await res.json();
    this.config.accessToken = data.access_token;
    if (data.refresh_token) this.config.refreshToken = data.refresh_token;
    this.config.clientId = clientId;

    sessionStorage.removeItem('dropbox_code_verifier');
    localStorage.removeItem('dropbox_code_verifier');

    return this.validateToken();
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
    this.setActiveTarget('dropbox');
    FileStorageEngine.getInstance().setActiveTarget('dropbox');
    return savedItem;
  }
}
