/**
 * Official Documentation:
 * - Window.postMessage API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - Window.sessionStorage (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
 * - Document.prerendering & Speculation Rules (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Document/prerendering
 * - Base64 Encoding & Decoding (MDN): https://developer.mozilla.org/en-US/docs/Glossary/Base64
 * - sql.js (SQLite WebAssembly): https://sql.js.org/
 */
import { SQLiteEngine } from './sqliteEngine';
import { FileStorageEngine } from './fileStorage';
import { RecentFilesManager } from './recentFiles';
import {
  ConflictDetails,
  H2ActiveFile,
  H2BridgeState,
  H2ConnectResponse,
  H2FileChangedEvent,
  H2FolderChangedEvent,
  H2ObserveFileResponse,
  H2ObserveFolderResponse,
  H2Provider,
  H2ProviderFilter,
  H2ReadResponse,
  H2ReasonCode,
  H2SaveResponse,
  H2StatResponse,
} from '../types/storage';

const H2_SESSION_STORAGE_KEY = 'h2_bridge_session_id';
const H2_AUTO_SAVE_STORAGE_KEY = 'gaw_h2_auto_save_enabled';
const H2_PROTOCOL = 'H2_CLOUD_BRIDGE';
const H2_PROTOCOL_VERSION = '1.6';
const AUTO_SAVE_DEBOUNCE_MS = 2500;
const DEFAULT_MAX_PAYLOAD_BYTES = 33554432; // 32 MB raw byte limit enforced by v1.6

/**
 * Returns true while Chrome is speculatively prerendering this document in the background.
 * Under Clockie H2 Bridge v1.6, the extension defers H2_BRIDGE_READY and queues early
 * H2_CONNECT_REQ messages until `prerenderingchange` fires upon real tab activation.
 */
function isDocumentPrerendering(): boolean {
  return typeof document !== 'undefined' && Boolean((document as any).prerendering);
}

/**
 * Resolves immediately for normal tabs, or waits once for `prerenderingchange` on prerendered tabs
 * so short boot connection timeouts do not fire prematurely before tab activation.
 */
function waitForPrerenderActivation(): Promise<void> {
  if (!isDocumentPrerendering()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    document.addEventListener('prerenderingchange', () => resolve(), { once: true });
  });
}

export function formatProviderLabel(provider?: H2Provider | string | null): string {
  switch (provider) {
    case 'pcloud':
      return 'pCloud';
    case 'gdrive':
      return 'Google Drive';
    case 'dropbox':
      return 'Dropbox';
    case 'local':
      return 'Local Drive';
    default:
      return provider ? String(provider) : 'Clockie H2';
  }
}

/**
 * Converts a Uint8Array (e.g. exported SQLite database bytes) to a Base64 string in safe chunks
 * to avoid call-stack overflow on multi-megabyte files.
 */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string received over the Clockie H2 bridge back into a Uint8Array.
 */
export function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64 || '');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export interface H2BridgeError extends Error {
  reasonCode?: H2ReasonCode | null;
  currentRevision?: string | null;
  exists?: boolean;
  modifiedMs?: number;
  sizeBytes?: number;
  maxPayloadBytes?: number;
}

/**
 * Low-level transport client implementing the Clockie H2 Extension Bridge Protocol v1.6.
 * Uses strictly window.postMessage + per-tab window.sessionStorage (zero URL parameters),
 * with prerender-safe activation and single-flight SESSION_EXPIRED auto-recovery in direct mode.
 */
export class H2BridgeClient {
  private clientName: string;
  private storageKey: string;
  public sessionId: string | null = null;
  public sessionInfo: H2ConnectResponse | null = null;
  private reconnectPromise: Promise<H2ConnectResponse> | null = null;
  private pending = new Map<string, { resolve: (d: any) => void; reject: (e: H2BridgeError) => void }>();
  private fileListeners = new Set<(event: H2FileChangedEvent) => void>();
  private folderListeners = new Set<(event: H2FolderChangedEvent) => void>();
  public onReady: ((data: any) => void) | null = null;
  public onSessionRecovered: ((res: H2ConnectResponse) => void) | null = null;
  public onSessionExpired: ((err: H2BridgeError) => void) | null = null;
  private onMsg: (event: MessageEvent) => void;

  constructor(clientName: string = 'Gawkyy', storageKey: string = H2_SESSION_STORAGE_KEY) {
    this.clientName = clientName;
    this.storageKey = storageKey;
    this.onMsg = (event: MessageEvent) => {
      if (typeof window === 'undefined' || event.source !== window) return;
      const d = event.data;
      if (!d || d.protocol !== H2_PROTOCOL || !d.__h2FromExtension) return;

      if (d.type === 'H2_BRIDGE_READY') {
        if (typeof this.onReady === 'function') this.onReady(d);
        return;
      }

      if (d.type === 'H2_FILE_CHANGED_EVENT') {
        if (this.sessionId && d.sessionId && d.sessionId !== this.sessionId) return;
        this.fileListeners.forEach((fn) => {
          try {
            fn(d as H2FileChangedEvent);
          } catch (err) {
            console.error('H2 file change listener error:', err);
          }
        });
        return;
      }

      if (d.type === 'H2_FOLDER_CHANGED_EVENT') {
        if (this.sessionId && d.sessionId && d.sessionId !== this.sessionId) return;
        this.folderListeners.forEach((fn) => {
          try {
            fn(d as H2FolderChangedEvent);
          } catch (err) {
            console.error('H2 folder change listener error:', err);
          }
        });
        return;
      }

      const entry = this.pending.get(d.requestId);
      if (entry) {
        if (this.sessionId && d.sessionId && d.sessionId !== this.sessionId) return;
        this.pending.delete(d.requestId);
        if (d.success) {
          if (d.sessionId) {
            this.sessionId = d.sessionId;
            try {
              window.sessionStorage.setItem(this.storageKey, d.sessionId);
            } catch {
              // ignore storage restrictions
            }
          }
          entry.resolve(d);
        } else {
          const err: H2BridgeError = new Error(d.error || 'Clockie H2 bridge request failed');
          err.reasonCode = d.reasonCode || null;
          if (d.currentRevision !== undefined) err.currentRevision = d.currentRevision;
          if (d.exists !== undefined) err.exists = d.exists;
          if (d.modifiedMs !== undefined) err.modifiedMs = d.modifiedMs;
          if (d.sizeBytes !== undefined) err.sizeBytes = d.sizeBytes;
          if (d.maxPayloadBytes !== undefined) err.maxPayloadBytes = d.maxPayloadBytes;
          entry.reject(err);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.onMsg);
    }
  }

  /**
   * Connects to Clockie H2 Bridge v1.6 by updating clientName and delegating to single-flight reconnect().
   */
  public async connect(clientName: string = 'Gawkyy', timeoutMs: number = 2500): Promise<H2ConnectResponse> {
    this.clientName = clientName;
    return this.reconnect(timeoutMs);
  }

  /**
   * Single-flight v1.6 handshake (H2_CONNECT_REQ).
   * Waits for prerender activation if needed, reads and clears any prior sessionId from sessionStorage,
   * and negotiates a fresh v1.6 session.
   */
  public async reconnect(timeoutMs: number = 15000): Promise<H2ConnectResponse> {
    if (this.reconnectPromise) return this.reconnectPromise;

    this.reconnectPromise = (async () => {
      await waitForPrerenderActivation();

      let previousSessionId: string | null = this.sessionId;
      try {
        if (!previousSessionId) {
          previousSessionId = window.sessionStorage.getItem(this.storageKey);
        }
        window.sessionStorage.removeItem(this.storageKey);
      } catch {
        // ignore storage restrictions
      }
      this.sessionId = null;

      const res = await this.sendOnce<H2ConnectResponse>(
        'H2_CONNECT_REQ',
        {
          clientName: this.clientName,
          previousSessionId: previousSessionId || undefined,
          supportedVersions: [H2_PROTOCOL_VERSION],
        },
        timeoutMs
      );
      this.sessionInfo = res;
      return res;
    })().finally(() => {
      this.reconnectPromise = null;
    });

    return this.reconnectPromise;
  }

  public onFileChanged(handler: (event: H2FileChangedEvent) => void): () => void {
    this.fileListeners.add(handler);
    return () => this.fileListeners.delete(handler);
  }

  public onFolderChanged(handler: (event: H2FolderChangedEvent) => void): () => void {
    this.folderListeners.add(handler);
    return () => this.folderListeners.delete(handler);
  }

  private post(type: string, payload: Record<string, any> = {}, explicitReqId?: string): string {
    const requestId = explicitReqId || `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const envelope: Record<string, any> = {
      protocol: H2_PROTOCOL,
      protocolVersion: H2_PROTOCOL_VERSION,
      requestId,
      type,
      ...payload,
    };
    if (type !== 'H2_CONNECT_REQ' && this.sessionId) {
      envelope.sessionId = this.sessionId;
    }
    window.postMessage(envelope, window.location.origin);
    return requestId;
  }

  private sendOnce<T = any>(type: string, payload: Record<string, any> = {}, timeoutMs: number = 60000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window not available for Clockie H2 bridge'));
        return;
      }
      const requestId = this.post(type, payload);
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        const err: H2BridgeError = new Error(`${type} timed out`);
        err.reasonCode = 'TIMEOUT';
        reject(err);
      }, timeoutMs);

      this.pending.set(requestId, {
        resolve: (d) => {
          clearTimeout(timer);
          resolve(d as T);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });
  }

  /**
   * Sends a Clockie H2 v1.6 request with transparent single-flight SESSION_EXPIRED recovery.
   * In direct mode, if Clockie H2 responds with reasonCode === "SESSION_EXPIRED", the client
   * automatically reconnects once and replays the request.
   */
  public async request<T = any>(type: string, payload: Record<string, any> = {}, timeoutMs: number = 60000): Promise<T> {
    try {
      return await this.sendOnce<T>(type, payload, timeoutMs);
    } catch (err: any) {
      if (
        err &&
        err.reasonCode === 'SESSION_EXPIRED' &&
        type !== 'H2_CONNECT_REQ' &&
        type !== 'H2_DISCONNECT_REQ'
      ) {
        if (!this.sessionInfo || this.sessionInfo.sessionMode === 'direct') {
          const recovered = await this.reconnect(15000);
          if (typeof this.onSessionRecovered === 'function') {
            try {
              this.onSessionRecovered(recovered);
            } catch (hookErr) {
              console.error('H2BridgeClient onSessionRecovered hook error:', hookErr);
            }
          }
          return await this.sendOnce<T>(type, payload, timeoutMs);
        }

        // Launched-mode sessions are scoped to their original launch and require explicit user reconnect
        this.sessionId = null;
        try {
          window.sessionStorage.removeItem(this.storageKey);
        } catch {
          // ignore
        }
        if (typeof this.onSessionExpired === 'function') {
          try {
            this.onSessionExpired(err);
          } catch (hookErr) {
            console.error('H2BridgeClient onSessionExpired hook error:', hookErr);
          }
        }
      }
      throw err;
    }
  }

  public requestTree(opts: { provider?: H2ProviderFilter; driveRoot?: boolean; basePath?: string; baseFolderId?: string; maxDepth?: number } = {}) {
    return this.request('H2_WORKSPACE_TREE_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      basePath: opts.basePath,
      baseFolderId: opts.baseFolderId,
      maxDepth: opts.maxDepth,
    });
  }

  public switchDriveRoot(provider: H2Provider, maxDepth: number = 1) {
    return this.requestTree({ provider, driveRoot: true, maxDepth });
  }

  public listFolder(opts: { provider?: H2ProviderFilter; driveRoot?: boolean; basePath?: string; baseFolderId?: string; maxDepth?: number } = {}) {
    return this.request('H2_LIST_FOLDER_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      basePath: opts.basePath,
      baseFolderId: opts.baseFolderId,
      maxDepth: opts.maxDepth ?? 1,
    });
  }

  public statFile(opts: { provider: H2Provider; driveRoot?: boolean; relativePath: string; fileId?: string }): Promise<H2StatResponse> {
    return this.request<H2StatResponse>('H2_STAT_FILE_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      fileId: opts.fileId,
    });
  }

  public readFile(opts: { provider: H2Provider; driveRoot?: boolean; relativePath: string; fileId?: string; encoding?: 'utf-8' | 'base64' }): Promise<H2ReadResponse> {
    return this.request<H2ReadResponse>('H2_READ_FILE_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      fileId: opts.fileId,
      encoding: opts.encoding ?? 'utf-8',
    });
  }

  public async readBinaryFile(opts: { provider: H2Provider; driveRoot?: boolean; relativePath: string; fileId?: string }): Promise<H2ReadResponse & { bytes: Uint8Array }> {
    const res = await this.readFile({ ...opts, encoding: 'base64' });
    return {
      ...res,
      bytes: base64ToUint8(res.content || ''),
    };
  }

  public saveFile(opts: {
    provider: H2Provider;
    driveRoot?: boolean;
    relativePath: string;
    fileId?: string;
    mimeType?: string;
    contentType?: 'text' | 'binary';
    encoding?: 'utf-8' | 'base64';
    content: string;
    expectedRevision?: string;
  }): Promise<H2SaveResponse> {
    return this.request<H2SaveResponse>('H2_SAVE_FILE_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      fileId: opts.fileId,
      mimeType: opts.mimeType,
      contentType: opts.contentType ?? 'text',
      encoding: opts.encoding ?? 'utf-8',
      content: opts.content,
      expectedRevision: opts.expectedRevision,
    });
  }

  public saveBinaryFile(opts: {
    provider: H2Provider;
    driveRoot?: boolean;
    relativePath: string;
    fileId?: string;
    mimeType?: string;
    bytes: Uint8Array;
    expectedRevision?: string;
  }): Promise<H2SaveResponse> {
    return this.saveFile({
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      fileId: opts.fileId,
      mimeType: opts.mimeType ?? 'application/vnd.sqlite3',
      contentType: 'binary',
      encoding: 'base64',
      content: uint8ToBase64(opts.bytes),
      expectedRevision: opts.expectedRevision,
    });
  }

  public observeFile(opts: {
    provider: H2Provider;
    driveRoot?: boolean;
    relativePath: string;
    fileId?: string;
    pollIntervalMs?: number;
    debounceMs?: number;
  }): Promise<H2ObserveFileResponse> {
    return this.request<H2ObserveFileResponse>('H2_OBSERVE_FILE_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      fileId: opts.fileId,
      pollIntervalMs: opts.pollIntervalMs,
      debounceMs: opts.debounceMs,
    });
  }

  public observeFolder(opts: {
    provider: H2Provider;
    driveRoot?: boolean;
    relativePath?: string;
    folderId?: string;
    recursive?: boolean;
    pollIntervalMs?: number;
    debounceMs?: number;
  }): Promise<H2ObserveFolderResponse> {
    return this.request<H2ObserveFolderResponse>('H2_OBSERVE_FOLDER_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath ?? '',
      folderId: opts.folderId,
      recursive: opts.recursive ?? false,
      pollIntervalMs: opts.pollIntervalMs,
      debounceMs: opts.debounceMs,
    });
  }

  public unobserve(observationIdOrOptions?: string | { observationId?: string; all?: boolean }) {
    const payload =
      typeof observationIdOrOptions === 'string'
        ? { observationId: observationIdOrOptions }
        : observationIdOrOptions || { all: true };
    return this.request('H2_UNOBSERVE_REQ', payload, 10000);
  }

  public createFolder(opts: {
    provider: H2Provider;
    driveRoot?: boolean;
    relativePath?: string;
    parentRelativePath?: string;
    parentFolderId?: string;
    folderName?: string;
  }) {
    return this.request('H2_CREATE_FOLDER_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      parentRelativePath: opts.parentRelativePath,
      parentFolderId: opts.parentFolderId,
      folderName: opts.folderName,
    });
  }

  public deleteFile(opts: { provider: H2Provider; driveRoot?: boolean; relativePath: string; fileId?: string; permanent?: boolean }) {
    return this.request('H2_DELETE_FILE_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      fileId: opts.fileId,
      permanent: opts.permanent ?? false,
    });
  }

  public deleteFolder(opts: { provider: H2Provider; driveRoot?: boolean; relativePath: string; folderId?: string; permanent?: boolean }) {
    return this.request('H2_DELETE_FOLDER_REQ', {
      provider: opts.provider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      folderId: opts.folderId,
      permanent: opts.permanent ?? false,
    });
  }

  public deleteItem(opts: {
    provider: H2Provider;
    itemType?: 'file' | 'folder';
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
    folderId?: string;
    permanent?: boolean;
  }) {
    if (opts.itemType === 'folder') {
      return this.deleteFolder({
        provider: opts.provider,
        driveRoot: opts.driveRoot,
        relativePath: opts.relativePath,
        folderId: opts.folderId,
        permanent: opts.permanent,
      });
    }
    return this.deleteFile({
      provider: opts.provider,
      driveRoot: opts.driveRoot,
      relativePath: opts.relativePath,
      fileId: opts.fileId,
      permanent: opts.permanent,
    });
  }

  public moveFile(opts: {
    provider: H2Provider;
    targetProvider?: H2Provider;
    driveRoot?: boolean;
    relativePath: string;
    fileId?: string;
    targetRelativePath?: string;
    targetParentPath?: string;
    newName?: string;
    overwrite?: boolean;
  }) {
    return this.request('H2_MOVE_FILE_REQ', {
      provider: opts.provider,
      targetProvider: opts.targetProvider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      fileId: opts.fileId,
      targetRelativePath: opts.targetRelativePath,
      targetParentPath: opts.targetParentPath,
      newName: opts.newName,
      overwrite: opts.overwrite ?? false,
    });
  }

  public moveFolder(opts: {
    provider: H2Provider;
    targetProvider?: H2Provider;
    driveRoot?: boolean;
    relativePath: string;
    folderId?: string;
    targetRelativePath?: string;
    targetParentPath?: string;
    newName?: string;
    overwrite?: boolean;
  }) {
    return this.request('H2_MOVE_FOLDER_REQ', {
      provider: opts.provider,
      targetProvider: opts.targetProvider,
      driveRoot: opts.driveRoot ?? false,
      relativePath: opts.relativePath,
      folderId: opts.folderId,
      targetRelativePath: opts.targetRelativePath,
      targetParentPath: opts.targetParentPath,
      newName: opts.newName,
      overwrite: opts.overwrite ?? false,
    });
  }

  public async disconnect(): Promise<void> {
    try {
      window.sessionStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
    if (this.sessionId) {
      await this.sendOnce('H2_DISCONNECT_REQ', {}, 4000).catch(() => {});
      this.sessionId = null;
    }
    this.sessionInfo = null;
  }

  public destroy(): void {
    this.fileListeners.clear();
    this.folderListeners.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.onMsg);
    }
  }
}

export type H2ToastLevel = 'success' | 'info' | 'warning' | 'error';

/**
 * High-level singleton orchestrating Clockie H2 v1.6 connectivity, prerender-safe activation,
 * MV3 SESSION_EXPIRED auto-recovery, live SQLite database observation, clash-free expectedRevision
 * saves, reconciliation, and debounced auto-save.
 */
export class H2BridgeEngine {
  private static instance: H2BridgeEngine | null = null;
  private client: H2BridgeClient;
  private state: H2BridgeState;
  private listeners = new Set<(state: H2BridgeState) => void>();
  private conflictCallback: ((conflict: ConflictDetails) => void) | null = null;
  private notifyCallback: ((level: H2ToastLevel, message: string) => void) | null = null;
  private reloadCallback: ((file: H2ActiveFile) => void) | null = null;

  private lastSyncedInternalTime: number | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  // Serializes database file operations so saves, reloads, and reconciliations never overlap
  private opQueue: Promise<any> = Promise.resolve();
  private connectPromise: Promise<boolean> | null = null;
  private prerenderRetryScheduled = false;

  private constructor() {
    this.client = new H2BridgeClient('Gawkyy');
    this.state = {
      status: 'disconnected',
      sessionId: null,
      sessionMode: null,
      accessMode: 'readwrite',
      launchedScope: null,
      drives: {},
      capabilities: {},
      activeFile: null,
      autoSaveEnabled: this.loadAutoSavePref(),
      lastSyncTime: null,
      error: null,
      reasonCode: null,
    };

    // Listen for extension readiness if Clockie H2 emits H2_BRIDGE_READY after page boot
    this.client.onReady = () => {
      if (this.state.status === 'disconnected' || this.state.status === 'unavailable') {
        this.connect(3000).catch(() => {});
      }
    };

    // Keep engine state and active file observation synchronized after automatic v1.6 SESSION_EXPIRED recovery
    this.client.onSessionRecovered = (res) => {
      const active = this.state.activeFile;
      this.updateState({
        status: 'connected',
        sessionId: res.sessionId,
        sessionMode: res.sessionMode || 'direct',
        accessMode: res.accessMode || 'readwrite',
        launchedScope: res.launchedScope || null,
        drives: res.drives || {},
        capabilities: res.capabilities || {},
        activeFile: active ? { ...active, observationId: null, watchQuality: null } : null,
        error: null,
        reasonCode: null,
      });
      this.emitNotify('info', 'Clockie H2 session recovered automatically.');
      if (active) {
        this.reattachActiveFileObservation(active.revision).catch(() => {});
      }
    };

    // Handle SESSION_EXPIRED when auto-recovery is not applicable (e.g. launched mode)
    this.client.onSessionExpired = (err) => {
      const active = this.state.activeFile;
      this.updateState({
        status: 'disconnected',
        sessionId: null,
        activeFile: active ? { ...active, observationId: null, watchQuality: null } : null,
        error: err?.message || 'Clockie H2 session expired. Click Reconnect to establish a new session.',
        reasonCode: 'SESSION_EXPIRED',
      });
      this.emitNotify('warning', 'Clockie H2 session expired. Click Reconnect in Clockie H2 Drives to resume.');
    };

    // Listen for live file change pushes for the currently opened SQLite database
    this.client.onFileChanged((event) => {
      this.handleIncomingFileChanged(event);
    });

    // Register remote sync state with FileStorageEngine so beforeunload and metadata stay accurate
    FileStorageEngine.getInstance().registerRemoteSyncChecker((internalModifiedTime) => ({
      hasRemote: this.state.activeFile !== null,
      isSynced: this.isSyncedWithInternal(internalModifiedTime),
      provider: this.state.activeFile?.provider ?? null,
      relativePath: this.state.activeFile?.relativePath ?? null,
      watchQuality: this.state.activeFile?.watchQuality ?? null,
      connected: this.state.status === 'connected',
      autoSaveEnabled: this.state.autoSaveEnabled,
    }));

    // Detach active H2 file when SQLiteEngine switches to a fresh/other database
    SQLiteEngine.getInstance().setOnDatabaseReset(() => {
      this.detachActiveFile();
    });

    // Cleanly tear down observations on page refresh or tab close
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => {
        if (this.state.activeFile?.observationId && this.client.sessionId) {
          this.client.unobserve({ all: true }).catch(() => {});
        }
      });
    }
  }

  public static getInstance(): H2BridgeEngine {
    if (!H2BridgeEngine.instance) {
      H2BridgeEngine.instance = new H2BridgeEngine();
    }
    return H2BridgeEngine.instance;
  }

  private loadAutoSavePref(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(H2_AUTO_SAVE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.opQueue.then(task, task);
    this.opQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  public getState(): H2BridgeState {
    return {
      ...this.state,
      drives: { ...this.state.drives },
      capabilities: { ...this.state.capabilities },
      activeFile: this.state.activeFile ? { ...this.state.activeFile } : null,
      launchedScope: this.state.launchedScope ? { ...this.state.launchedScope } : null,
    };
  }

  public getClient(): H2BridgeClient {
    return this.client;
  }

  public subscribe(listener: (state: H2BridgeState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public onConflict(cb: (conflict: ConflictDetails) => void): void {
    this.conflictCallback = cb;
  }

  public onNotify(cb: (level: H2ToastLevel, message: string) => void): void {
    this.notifyCallback = cb;
  }

  public onRemoteReload(cb: (file: H2ActiveFile) => void): void {
    this.reloadCallback = cb;
  }

  private emitNotify(level: H2ToastLevel, message: string): void {
    if (this.notifyCallback) {
      try {
        this.notifyCallback(level, message);
      } catch {
        // ignore
      }
    }
  }

  private updateState(patch: Partial<H2BridgeState>): void {
    this.state = { ...this.state, ...patch };
    const snapshot = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (e) {
        console.error('H2BridgeEngine listener error:', e);
      }
    });
    FileStorageEngine.getInstance().notifyExternalStatusUpdate();
  }

  public isConnected(): boolean {
    return this.state.status === 'connected' && Boolean(this.client.sessionId);
  }

  public hasActiveFile(): boolean {
    return this.state.activeFile !== null;
  }

  public isSyncedWithInternal(internalModifiedTime: number | null): boolean {
    if (!this.state.activeFile) return true;
    if (internalModifiedTime === null) return true;
    return this.lastSyncedInternalTime !== null && this.lastSyncedInternalTime >= internalModifiedTime;
  }

  /**
   * Connects to Clockie H2 Bridge v1.6 using a short default timeout so browsers without the
   * extension boot instantaneously without waiting 15 seconds.
   * Defers the timeout while Chrome is speculatively prerendering the tab (`document.prerendering`).
   */
  public async connect(timeoutMs: number = 2500): Promise<boolean> {
    if (this.isConnected()) return true;
    if (this.connectPromise) return this.connectPromise;

    this.updateState({ status: 'connecting', error: null, reasonCode: null });

    this.connectPromise = (async () => {
      try {
        await waitForPrerenderActivation();
        const res = await this.client.connect('Gawkyy', timeoutMs);
        this.updateState({
          status: 'connected',
          sessionId: res.sessionId,
          sessionMode: res.sessionMode || 'direct',
          accessMode: res.accessMode || 'readwrite',
          launchedScope: res.launchedScope || null,
          drives: res.drives || {},
          capabilities: res.capabilities || {},
          error: null,
          reasonCode: null,
        });
        // If a database file was already bound before reconnecting, re-attach its live watcher
        if (this.state.activeFile && !this.state.activeFile.observationId) {
          this.reattachActiveFileObservation(this.state.activeFile.revision).catch(() => {});
        }
        return true;
      } catch (err: any) {
        const reason: H2ReasonCode | null = err?.reasonCode || null;
        if (reason === 'PRERENDERING') {
          // Wait for tab activation rather than marking the connection permanently refused
          this.updateState({
            status: 'connecting',
            sessionId: null,
            error: null,
            reasonCode: 'PRERENDERING',
          });
          if (!this.prerenderRetryScheduled) {
            this.prerenderRetryScheduled = true;
            waitForPrerenderActivation().then(() => {
              this.prerenderRetryScheduled = false;
              this.connect(timeoutMs).catch(() => {});
            });
          }
          return false;
        }

        const isTimeout = reason === 'TIMEOUT';
        const errorMessage = isTimeout
          ? 'Clockie H2 extension not detected in this browser.'
          : reason === 'UNSUPPORTED_VERSION'
          ? 'Clockie H2 extension requires Protocol v1.6. Please update Clockie H2 to the latest version.'
          : err?.message || 'Clockie H2 connection refused.';

        this.updateState({
          status: isTimeout ? 'unavailable' : 'refused',
          sessionId: null,
          error: errorMessage,
          reasonCode: reason,
        });
        return false;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  public async reconnect(): Promise<boolean> {
    this.client.sessionId = null;
    this.updateState({ status: 'disconnected', sessionId: null });
    return this.connect(10000);
  }

  public async disconnect(): Promise<void> {
    this.clearAutoSaveTimer();
    await this.unobserveActiveFile();
    await this.client.disconnect();
    this.lastSyncedInternalTime = null;
    this.updateState({
      status: 'disconnected',
      sessionId: null,
      sessionMode: null,
      launchedScope: null,
      drives: {},
      capabilities: {},
      activeFile: null,
      error: null,
      reasonCode: null,
    });
  }

  public setAutoSaveEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(H2_AUTO_SAVE_STORAGE_KEY, String(enabled));
    } catch {
      // ignore
    }
    if (!enabled) {
      this.clearAutoSaveTimer();
    }
    this.updateState({ autoSaveEnabled: enabled });
  }

  private clearAutoSaveTimer(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Called by App.tsx whenever SQLiteEngine records a user mutation.
   * If Auto-Save on Edit is enabled and an H2 database file is open in readwrite mode,
   * schedules a debounced clash-free save.
   */
  public notifyLocalMutation(): void {
    if (!this.state.autoSaveEnabled || !this.state.activeFile || !this.isConnected()) return;
    if (this.state.accessMode === 'readonly') return;

    this.clearAutoSaveTimer();
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      const storage = FileStorageEngine.getInstance();
      if (this.state.activeFile && storage.hasModifications() && storage.getMetadata().syncStatus !== 'conflict') {
        this.saveDatabase({ silent: true }).catch((err) => {
          console.warn('Clockie H2 auto-save failed:', err);
        });
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  private async unobserveActiveFile(): Promise<void> {
    const obsId = this.state.activeFile?.observationId;
    if (obsId && this.isConnected()) {
      await this.client.unobserve(obsId).catch(() => {});
    }
  }

  public detachActiveFile(): void {
    this.clearAutoSaveTimer();
    const obsId = this.state.activeFile?.observationId;
    if (obsId && this.isConnected()) {
      this.client.unobserve(obsId).catch(() => {});
    }
    this.lastSyncedInternalTime = null;
    if (this.state.activeFile !== null) {
      this.updateState({ activeFile: null });
    }
  }

  /**
   * Starts live v1.6 file observation for the active SQLite database file.
   */
  private async startObservingActiveFile(): Promise<H2ObserveFileResponse | null> {
    const active = this.state.activeFile;
    if (!active || !this.isConnected()) return null;
    if (this.state.capabilities.observeFiles === false) return null;

    try {
      const res = await this.client.observeFile({
        provider: active.provider,
        driveRoot: active.driveRoot,
        relativePath: active.relativePath,
        fileId: active.fileId,
        debounceMs: 300,
      });

      // Ensure active file hasn't switched while the observe request was in flight
      if (
        this.state.activeFile &&
        this.state.activeFile.provider === active.provider &&
        this.state.activeFile.relativePath === active.relativePath
      ) {
        this.updateState({
          activeFile: {
            ...this.state.activeFile,
            observationId: res.observationId,
            watchQuality: res.watchQuality || null,
            // Preserve the known local revision so callers can detect if the file changed while disconnected
            revision: this.state.activeFile.revision ?? res.revision ?? null,
            modifiedMs: res.modifiedMs ?? this.state.activeFile.modifiedMs,
            sizeBytes: res.sizeBytes ?? this.state.activeFile.sizeBytes,
          },
        });
      }
      return res;
    } catch (err) {
      console.warn('Clockie H2 observeFile warning:', err);
      return null;
    }
  }

  /**
   * Re-subscribes live observation after a v1.6 SESSION_EXPIRED auto-recovery or manual reconnect,
   * and triggers a lightweight resync if the remote revision advanced while disconnected.
   */
  private async reattachActiveFileObservation(previousRevision: string | null): Promise<void> {
    const res = await this.startObservingActiveFile();
    const current = this.state.activeFile;
    if (!res || !current) return;

    if (res.exists === false) {
      FileStorageEngine.getInstance().markDirty(true);
      this.emitNotify(
        'warning',
        `${current.name} no longer exists on ${formatProviderLabel(current.provider)}.`
      );
      return;
    }

    if (previousRevision && res.revision && res.revision !== previousRevision) {
      this.handleIncomingFileChanged({
        protocol: H2_PROTOCOL,
        protocolVersion: H2_PROTOCOL_VERSION,
        type: 'H2_FILE_CHANGED_EVENT',
        observationId: res.observationId,
        eventType: 'resync_required',
        provider: current.provider,
        relativePath: current.relativePath,
        fileId: res.fileId || current.fileId,
        revision: res.revision,
        modifiedMs: res.modifiedMs,
        sizeBytes: res.sizeBytes,
        originSessionId: null,
        originClientName: null,
        timestampMs: Date.now(),
      });
    }
  }

  /**
   * Opens a SQLite database stored on any Clockie H2 drive (pCloud, Google Drive, Dropbox, Local),
   * loads it into SQLiteEngine, records its revision, and subscribes to live change events.
   */
  public openDatabase(opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    fileId?: string;
    name?: string;
  }): Promise<boolean> {
    return this.enqueue(async () => {
      if (!this.isConnected()) {
        const ok = await this.connect(6000);
        if (!ok) throw new Error('Clockie H2 extension is not connected.');
      }

      const driveRoot = opts.driveRoot ?? true;
      const res = await this.client.readBinaryFile({
        provider: opts.provider,
        driveRoot,
        relativePath: opts.relativePath,
        fileId: opts.fileId,
      });

      const fileName =
        opts.name ||
        res.name ||
        opts.relativePath.split('/').filter(Boolean).pop() ||
        'database.sqlite';

      // Detach any prior local disk handle or prior H2 observation cleanly
      await this.unobserveActiveFile();
      const storage = FileStorageEngine.getInstance();
      storage.closeFile();

      const sqlite = SQLiteEngine.getInstance();
      sqlite.loadBinary(res.bytes, fileName, { preserveExternalBinding: true });

      this.lastSyncedInternalTime = null;
      storage.setActiveTarget('h2');
      storage.markSaved();

      const nextActive: H2ActiveFile = {
        provider: opts.provider,
        relativePath: res.relativePath || opts.relativePath,
        driveRoot,
        name: fileName,
        fileId: res.fileId || opts.fileId,
        revision: res.revision ?? null,
        modifiedMs: res.modifiedMs ?? Date.now(),
        sizeBytes: res.sizeBytes ?? res.bytes.byteLength,
        observationId: null,
        watchQuality: null,
      };

      this.updateState({
        activeFile: nextActive,
        lastSyncTime: new Date(),
        error: null,
      });

      RecentFilesManager.addRecentFile({
        name: fileName,
        source: 'h2',
        provider: opts.provider,
        driveRoot,
        fileId: nextActive.fileId,
        path: nextActive.relativePath,
        size: nextActive.sizeBytes ?? res.bytes.byteLength,
      });

      await this.startObservingActiveFile();
      return true;
    });
  }

  /**
   * Saves the active in-memory SQLite database back to Clockie H2 with optimistic concurrency
   * (`expectedRevision`). On a clash, attempts automatic table/row reconciliation and opens
   * the Conflict Resolution dialog if a manual decision is required.
   */
  public saveDatabase(options?: { silent?: boolean; forceOverwrite?: boolean }): Promise<boolean> {
    return this.enqueue(async () => {
      const active = this.state.activeFile;
      if (!active) {
        throw new Error('No Clockie H2 database file is currently open. Use Save As in Clockie H2 Drives.');
      }
      if (!this.isConnected()) {
        throw new Error('Clockie H2 extension is disconnected.');
      }
      if (this.state.accessMode === 'readonly') {
        throw new Error('Clockie H2 session is read-only. Grant readwrite access in Clockie H2 to save.');
      }

      const sqlite = SQLiteEngine.getInstance();
      const storage = FileStorageEngine.getInstance();
      const bytes = sqlite.exportBinary();

      const maxBytes = this.state.capabilities.maxPayloadBytes || DEFAULT_MAX_PAYLOAD_BYTES;
      if (bytes.byteLength > maxBytes) {
        const mb = (maxBytes / (1024 * 1024)).toFixed(0);
        const msg = `Database (${(bytes.byteLength / (1024 * 1024)).toFixed(1)} MB) exceeds Clockie H2's ${mb} MB bridge limit. Use Export .db instead.`;
        this.emitNotify('error', msg);
        throw new Error(msg);
      }

      storage.setSyncStatus('saving');
      const internalModifiedAtStart = storage.getInternalStateModifiedTime();

      try {
        const res = await this.client.saveBinaryFile({
          provider: active.provider,
          driveRoot: active.driveRoot,
          relativePath: active.relativePath,
          fileId: active.fileId,
          mimeType: 'application/vnd.sqlite3',
          bytes,
          expectedRevision: options?.forceOverwrite ? undefined : active.revision || undefined,
        });

        this.lastSyncedInternalTime = internalModifiedAtStart || Date.now();
        this.updateState({
          activeFile: {
            ...active,
            fileId: res.fileId || active.fileId,
            revision: res.revision ?? active.revision,
            modifiedMs: res.modifiedMs ?? Date.now(),
            sizeBytes: res.sizeBytes ?? bytes.byteLength,
          },
          lastSyncTime: new Date(),
          error: null,
        });

        storage.markSaved();
        if (!options?.silent) {
          this.emitNotify('success', `Saved ${active.name} to ${formatProviderLabel(active.provider)}.`);
        }
        return true;
      } catch (err: any) {
        if (err?.reasonCode === 'CONFLICT') {
          return await this.handleSaveConflict(active, err, bytes);
        }
        if (err?.reasonCode === 'PAYLOAD_TOO_LARGE') {
          storage.setSyncStatus('error');
          const msg = `Database exceeds Clockie H2's 32 MB bridge payload limit. Use Export .db to save locally.`;
          this.emitNotify('error', msg);
          return false;
        }
        storage.setSyncStatus('error');
        throw err;
      }
    });
  }

  /**
   * Saves the active SQLite database to a chosen provider and path via Clockie H2,
   * binds it as the active observed file, and starts live observation.
   */
  public saveDatabaseAs(opts: {
    provider: H2Provider;
    relativePath: string;
    driveRoot?: boolean;
    overwrite?: boolean;
  }): Promise<boolean> {
    return this.enqueue(async () => {
      if (!this.isConnected()) {
        const ok = await this.connect(6000);
        if (!ok) throw new Error('Clockie H2 extension is not connected.');
      }
      if (this.state.accessMode === 'readonly') {
        throw new Error('Clockie H2 session is read-only.');
      }

      const sqlite = SQLiteEngine.getInstance();
      const storage = FileStorageEngine.getInstance();
      const bytes = sqlite.exportBinary();

      const maxBytes = this.state.capabilities.maxPayloadBytes || DEFAULT_MAX_PAYLOAD_BYTES;
      if (bytes.byteLength > maxBytes) {
        throw new Error('Database exceeds Clockie H2 32 MB bridge payload limit.');
      }

      const normalizedPath = opts.relativePath.replace(/^\/+/, '');
      const cleanPath = /\.(db|sqlite|sqlite3)$/i.test(normalizedPath)
        ? normalizedPath
        : `${normalizedPath}.sqlite`;
      const driveRoot = opts.driveRoot ?? true;

      storage.setSyncStatus('saving');

      const res = await this.client.saveBinaryFile({
        provider: opts.provider,
        driveRoot,
        relativePath: cleanPath,
        mimeType: 'application/vnd.sqlite3',
        bytes,
        expectedRevision: opts.overwrite ? undefined : 'NONE',
      });

      await this.unobserveActiveFile();
      storage.closeFile();

      const fileName = cleanPath.split('/').filter(Boolean).pop() || sqlite.activeDbName;
      sqlite.activeDbName = fileName;
      this.lastSyncedInternalTime = storage.getInternalStateModifiedTime() || Date.now();
      storage.setActiveTarget('h2');
      storage.markSaved();

      const nextActive: H2ActiveFile = {
        provider: opts.provider,
        relativePath: res.relativePath || cleanPath,
        driveRoot,
        name: fileName,
        fileId: res.fileId,
        revision: res.revision ?? null,
        modifiedMs: res.modifiedMs ?? Date.now(),
        sizeBytes: res.sizeBytes ?? bytes.byteLength,
        observationId: null,
        watchQuality: null,
      };

      this.updateState({
        activeFile: nextActive,
        lastSyncTime: new Date(),
        error: null,
      });

      RecentFilesManager.addRecentFile({
        name: fileName,
        source: 'h2',
        provider: opts.provider,
        driveRoot,
        fileId: nextActive.fileId,
        path: nextActive.relativePath,
        size: nextActive.sizeBytes ?? bytes.byteLength,
      });

      await this.startObservingActiveFile();
      sqlite.notifyChange(false);
      this.emitNotify('success', `Saved ${fileName} to ${formatProviderLabel(opts.provider)}.`);
      return true;
    });
  }

  /**
   * Attempts automatic reconciliation when a save returns CONFLICT, falling back to ConflictDialog.
   */
  private async handleSaveConflict(
    active: H2ActiveFile,
    conflictErr: H2BridgeError,
    localBytes: Uint8Array
  ): Promise<boolean> {
    const sqlite = SQLiteEngine.getInstance();
    const storage = FileStorageEngine.getInstance();

    try {
      const remoteRes = await this.client.readBinaryFile({
        provider: active.provider,
        driveRoot: active.driveRoot,
        relativePath: active.relativePath,
        fileId: active.fileId,
      });

      const reconcile = sqlite.attemptReconcile(remoteRes.bytes);
      if (reconcile.success) {
        const mergedBytes = sqlite.exportBinary();
        const saved = await this.client.saveBinaryFile({
          provider: active.provider,
          driveRoot: active.driveRoot,
          relativePath: active.relativePath,
          fileId: remoteRes.fileId || active.fileId,
          mimeType: 'application/vnd.sqlite3',
          bytes: mergedBytes,
          expectedRevision: remoteRes.revision || conflictErr.currentRevision || undefined,
        });

        this.lastSyncedInternalTime = storage.getInternalStateModifiedTime() || Date.now();
        this.updateState({
          activeFile: {
            ...active,
            fileId: saved.fileId || active.fileId,
            revision: saved.revision ?? remoteRes.revision ?? active.revision,
            modifiedMs: saved.modifiedMs ?? Date.now(),
            sizeBytes: saved.sizeBytes ?? mergedBytes.byteLength,
          },
          lastSyncTime: new Date(),
        });
        storage.markSaved();
        if (this.reloadCallback && this.state.activeFile) {
          this.reloadCallback(this.state.activeFile);
        }
        this.emitNotify('info', `Merged concurrent changes with ${formatProviderLabel(active.provider)}.`);
        return true;
      }
    } catch (reconcileErr) {
      console.warn('Clockie H2 automatic reconciliation could not merge conflict:', reconcileErr);
    }

    // Automatic merge was not possible — raise the unified Conflict Dialog
    storage.setSyncStatus('conflict');
    if (this.conflictCallback) {
      this.conflictCallback({
        source: 'h2',
        provider: active.provider,
        fileName: active.name,
        localModifiedAt: new Date(storage.getInternalStateModifiedTime() || Date.now()),
        diskModifiedAt: new Date(conflictErr.modifiedMs || Date.now()),
        localSize: localBytes.byteLength,
        diskSize: conflictErr.sizeBytes ?? active.sizeBytes ?? 0,
        remoteRevision: conflictErr.currentRevision ?? null,
      });
    }
    return false;
  }

  /**
   * Handles incoming live H2_FILE_CHANGED_EVENT push notifications from Clockie H2 v1.6.
   */
  private handleIncomingFileChanged(event: H2FileChangedEvent): void {
    const active = this.state.activeFile;
    if (!active) return;

    // Match by observationId or provider + relativePath
    const matchesObs = active.observationId && event.observationId === active.observationId;
    const matchesPath =
      event.provider === active.provider &&
      event.relativePath === active.relativePath;
    if (!matchesObs && !matchesPath) return;

    // Echo suppression: ignore changes produced by our own active session
    if (event.originSessionId && this.client.sessionId && event.originSessionId === this.client.sessionId) {
      return;
    }

    // Ignore redundant notifications for a revision we already have
    if (
      (event.eventType === 'modified' || event.eventType === 'created') &&
      event.revision &&
      active.revision &&
      event.revision === active.revision
    ) {
      return;
    }

    this.enqueue(async () => {
      const current = this.state.activeFile;
      if (!current) return;

      if (event.eventType === 'watch_error') {
        this.emitNotify(
          'warning',
          `Clockie H2 watcher warning (${formatProviderLabel(current.provider)}): ${event.error || 'Temporary interruption.'}`
        );
        return;
      }

      if (event.eventType === 'deleted') {
        await this.unobserveActiveFile();
        this.updateState({
          activeFile: {
            ...current,
            revision: null,
            observationId: null,
          },
        });
        FileStorageEngine.getInstance().markDirty(true);
        this.emitNotify(
          'warning',
          `${current.name} was deleted on ${formatProviderLabel(current.provider)}. Use Save As to keep your copy.`
        );
        return;
      }

      if (event.eventType === 'moved' || event.eventType === 'renamed') {
        const nextPath = event.newRelativePath || event.relativePath;
        const nextName = nextPath.split('/').filter(Boolean).pop() || current.name;
        await this.unobserveActiveFile();
        SQLiteEngine.getInstance().activeDbName = nextName;
        this.updateState({
          activeFile: {
            ...current,
            relativePath: nextPath,
            name: nextName,
            fileId: event.fileId || current.fileId,
            revision: event.revision ?? current.revision,
            observationId: null,
          },
        });
        await this.startObservingActiveFile();
        this.emitNotify('info', `Database moved/renamed to ${nextName} on ${formatProviderLabel(current.provider)}.`);
        return;
      }

      // Lightweight stat check on resync_required (e.g. after MV3 SW restart or sleep/wake)
      if (event.eventType === 'resync_required') {
        try {
          const stat = await this.client.statFile({
            provider: current.provider,
            driveRoot: current.driveRoot,
            relativePath: current.relativePath,
            fileId: current.fileId,
          });
          if (!stat.exists) {
            FileStorageEngine.getInstance().markDirty(true);
            this.emitNotify('warning', `${current.name} no longer exists on ${formatProviderLabel(current.provider)}.`);
            return;
          }
          if (stat.revision && current.revision && stat.revision === current.revision) {
            return;
          }
        } catch (err) {
          console.warn('Clockie H2 statFile resync failed:', err);
          return;
        }
      }

      // External modification confirmed — reload cleanly or reconcile if local edits exist
      const storage = FileStorageEngine.getInstance();
      const sqlite = SQLiteEngine.getInstance();
      const hasLocalEdits = storage.hasModifications() && !this.isSyncedWithInternal(storage.getInternalStateModifiedTime());

      try {
        const remoteRes = await this.client.readBinaryFile({
          provider: current.provider,
          driveRoot: current.driveRoot,
          relativePath: current.relativePath,
          fileId: event.fileId || current.fileId,
        });

        if (!hasLocalEdits) {
          sqlite.loadBinary(remoteRes.bytes, current.name, { preserveExternalBinding: true });
          this.lastSyncedInternalTime = null;
          storage.markSaved();

          const updated: H2ActiveFile = {
            ...current,
            fileId: remoteRes.fileId || current.fileId,
            revision: remoteRes.revision ?? event.revision ?? current.revision,
            modifiedMs: remoteRes.modifiedMs ?? event.modifiedMs ?? Date.now(),
            sizeBytes: remoteRes.sizeBytes ?? remoteRes.bytes.byteLength,
          };
          this.updateState({ activeFile: updated, lastSyncTime: new Date() });
          if (this.reloadCallback) {
            this.reloadCallback(updated);
          }
          this.emitNotify('info', `Database updated from ${formatProviderLabel(current.provider)}.`);
        } else {
          // Both local and remote changed -> try row/table reconciliation first
          const reconcile = sqlite.attemptReconcile(remoteRes.bytes);
          if (reconcile.success && this.state.accessMode === 'readwrite') {
            const mergedBytes = sqlite.exportBinary();
            const saved = await this.client.saveBinaryFile({
              provider: current.provider,
              driveRoot: current.driveRoot,
              relativePath: current.relativePath,
              fileId: remoteRes.fileId || current.fileId,
              mimeType: 'application/vnd.sqlite3',
              bytes: mergedBytes,
              expectedRevision: remoteRes.revision || undefined,
            });

            this.lastSyncedInternalTime = storage.getInternalStateModifiedTime() || Date.now();
            const updated: H2ActiveFile = {
              ...current,
              fileId: saved.fileId || current.fileId,
              revision: saved.revision ?? remoteRes.revision ?? current.revision,
              modifiedMs: saved.modifiedMs ?? Date.now(),
              sizeBytes: saved.sizeBytes ?? mergedBytes.byteLength,
            };
            this.updateState({ activeFile: updated, lastSyncTime: new Date() });
            storage.markSaved();
            if (this.reloadCallback) {
              this.reloadCallback(updated);
            }
            this.emitNotify('info', `Merged concurrent updates from ${formatProviderLabel(current.provider)}.`);
          } else {
            storage.setSyncStatus('conflict');
            const localBytes = sqlite.exportBinary();
            if (this.conflictCallback) {
              this.conflictCallback({
                source: 'h2',
                provider: current.provider,
                fileName: current.name,
                localModifiedAt: new Date(storage.getInternalStateModifiedTime() || Date.now()),
                diskModifiedAt: new Date(remoteRes.modifiedMs ?? event.modifiedMs ?? Date.now()),
                localSize: localBytes.byteLength,
                diskSize: remoteRes.sizeBytes ?? remoteRes.bytes.byteLength,
                remoteRevision: remoteRes.revision ?? event.revision ?? null,
              });
            }
          }
        }
      } catch (err: any) {
        console.warn('Clockie H2 external change reload failed:', err);
        this.emitNotify('error', `Failed to sync update from ${formatProviderLabel(current.provider)}: ${err?.message || 'Unknown error'}`);
      }
    });
  }

  // --- Conflict Resolution Actions for Clockie H2 Files ---

  public async resolveConflictKeepLocal(): Promise<boolean> {
    return this.saveDatabase({ forceOverwrite: true });
  }

  public resolveConflictReloadRemote(): Promise<boolean> {
    return this.enqueue(async () => {
      const active = this.state.activeFile;
      if (!active) return false;
      const res = await this.client.readBinaryFile({
        provider: active.provider,
        driveRoot: active.driveRoot,
        relativePath: active.relativePath,
        fileId: active.fileId,
      });

      const sqlite = SQLiteEngine.getInstance();
      const storage = FileStorageEngine.getInstance();
      sqlite.loadBinary(res.bytes, active.name, { preserveExternalBinding: true });
      this.lastSyncedInternalTime = null;
      storage.markSaved();

      const updated: H2ActiveFile = {
        ...active,
        fileId: res.fileId || active.fileId,
        revision: res.revision ?? active.revision,
        modifiedMs: res.modifiedMs ?? Date.now(),
        sizeBytes: res.sizeBytes ?? res.bytes.byteLength,
      };
      this.updateState({ activeFile: updated, lastSyncTime: new Date() });
      if (this.reloadCallback) {
        this.reloadCallback(updated);
      }
      return true;
    });
  }

  public async resolveConflictSaveCopy(): Promise<boolean> {
    const active = this.state.activeFile;
    if (!active) return false;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const copyPath = active.relativePath.replace(/(\.(db|sqlite3?))?$/i, `_copy_${stamp}.sqlite`);
    return this.saveDatabaseAs({
      provider: active.provider,
      relativePath: copyPath,
      driveRoot: active.driveRoot,
      overwrite: true,
    });
  }
}
