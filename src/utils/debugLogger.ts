import { safeStorage } from './storage';

export interface DebugLogEntry {
  id: string;
  stage: string;
  startTimeMs: number; // relative to app start in ms
  endTimeMs: number;   // relative to app start in ms
  durationMs: number;  // duration in ms
  durationSecFormatted: string; // e.g. "0.2s" (nearest tenth of a second)
  details?: string;
  category: 'wasm' | 'database' | 'storage' | 'plugins' | 'app' | 'system';
  timestampISO: string;
}

type DebugListener = (logs: DebugLogEntry[], enabled: boolean) => void;

const LISTENERS = new Set<DebugListener>();
let IN_MEMORY_LOGS: DebugLogEntry[] = [];

// App start timestamp (or performance.now() at module load)
export const APP_START_TIME =
  typeof window !== 'undefined' && (window as any).__GAW_START_TIME__
    ? (window as any).__GAW_START_TIME__
    : typeof performance !== 'undefined'
    ? performance.now()
    : Date.now();

export function isDebuggingEnabled(): boolean {
  const val = safeStorage.getItem('gaw_debugging_enabled');
  if (val === null) {
    return true; // Default ON as requested
  }
  return val === 'true';
}

export function setDebuggingEnabled(enabled: boolean): void {
  safeStorage.setItem('gaw_debugging_enabled', String(enabled));
  notifyListeners();
}

function notifyListeners(): void {
  const enabled = isDebuggingEnabled();
  if (typeof window !== 'undefined') {
    (window as any).__GAW_DEBUG_LOGS__ = [...IN_MEMORY_LOGS];
    (window as any).__GAW_IS_DEBUGGING_ENABLED__ = enabled;
    (window as any).__GAW_SET_DEBUGGING_ENABLED__ = setDebuggingEnabled;
    (window as any).__GAW_CLEAR_DEBUG_LOGS__ = clearDebugLogs;
  }
  LISTENERS.forEach((fn) => {
    try {
      fn([...IN_MEMORY_LOGS], enabled);
    } catch (e) {
      console.error('Debug logger listener error:', e);
    }
  });
}

if (typeof window !== 'undefined') {
  (window as any).__GAW_DEBUG_LOGS__ = IN_MEMORY_LOGS;
  (window as any).__GAW_SET_DEBUGGING_ENABLED__ = setDebuggingEnabled;
  (window as any).__GAW_CLEAR_DEBUG_LOGS__ = clearDebugLogs;
}

export function subscribeDebugLogger(listener: DebugListener): () => void {
  LISTENERS.add(listener);
  listener([...IN_MEMORY_LOGS], isDebuggingEnabled());
  return () => LISTENERS.delete(listener);
}

export function getDebugLogs(): DebugLogEntry[] {
  return [...IN_MEMORY_LOGS];
}

export function clearDebugLogs(): void {
  IN_MEMORY_LOGS = [];
  notifyListeners();
}

/**
  * Add a log entry to the startup performance log.
  * Duration is formatted to the nearest tenth of a second (e.g., 0.1s, 0.4s, 1.2s).
  */
export function logDebugStage(
  stage: string,
  startTimeMs: number,
  endTimeMs: number,
  category: DebugLogEntry['category'] = 'system',
  details?: string
): DebugLogEntry | null {
  if (!isDebuggingEnabled()) {
    return null;
  }

  const durationMs = Math.max(0, endTimeMs - startTimeMs);
  const durationSecNum = durationMs / 1000;
  // Round to nearest tenth of a second (e.g. 0.1s, 0.0s -> if < 0.05s show 0.0s or <0.1s)
  const durationSecFormatted = durationSecNum.toFixed(1) + 's';

  const entry: DebugLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    stage,
    startTimeMs: Math.round(startTimeMs * 10) / 10,
    endTimeMs: Math.round(endTimeMs * 10) / 10,
    durationMs: Math.round(durationMs * 10) / 10,
    durationSecFormatted,
    category,
    details,
    timestampISO: new Date().toISOString(),
  };

  // Avoid duplicate logs for identical stage & start time
  const existingIdx = IN_MEMORY_LOGS.findIndex((l) => l.stage === stage && Math.abs(l.startTimeMs - entry.startTimeMs) < 2);
  if (existingIdx !== -1) {
    IN_MEMORY_LOGS[existingIdx] = entry;
  } else {
    IN_MEMORY_LOGS.push(entry);
  }

  // Also print clean formatted log in developer console
  console.log(
    `%c[GAW DEBUG] %c${stage}%c: ${durationSecFormatted} (${Math.round(durationMs)}ms)%c ${details ? '| ' + details : ''}`,
    'color: #3b82f6; font-weight: bold;',
    'color: #10b981; font-weight: bold;',
    'color: #f59e0b; font-weight: bold;',
    'color: #94a3b8;'
  );

  notifyListeners();
  return entry;
}

/**
  * Start timing a stage. Returns an end function that records duration.
  */
export function startDebugTimer(
  stage: string,
  category: DebugLogEntry['category'] = 'system'
): (details?: string) => DebugLogEntry | null {
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return (details?: string) => {
    const endMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return logDebugStage(stage, startMs, endMs, category, details);
  };
}
