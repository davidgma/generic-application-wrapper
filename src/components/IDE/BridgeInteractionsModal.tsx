/**
 * Official Documentation:
 * - Window.postMessage API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - Clipboard API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
 * - React Hooks: https://react.dev/reference/react
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  X,
  Search,
  Trash2,
  Copy,
  Check,
  Pause,
  Play,
  ArrowUpRight,
  ArrowDownLeft,
  Radio,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { H2BridgeEngine, H2InteractionLogEntry } from '../../engine/h2Bridge';
import { H2BridgeState } from '../../types/storage';

interface BridgeInteractionsModalProps {
  isDark: boolean;
  onClose: () => void;
}

type DirectionFilter = 'all' | 'outgoing' | 'incoming' | 'event' | 'errors';

export const BridgeInteractionsModal: React.FC<BridgeInteractionsModalProps> = ({
  isDark,
  onClose,
}) => {
  const engine = useMemo(() => H2BridgeEngine.getInstance(), []);
  const [bridgeState, setBridgeState] = useState<H2BridgeState>(() => engine.getState());
  const [logs, setLogs] = useState<H2InteractionLogEntry[]>(() => engine.getInteractionLogs());
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<DirectionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubState = engine.subscribe((st) => setBridgeState(st));
    return () => unsubState();
  }, [engine]);

  useEffect(() => {
    if (paused) return;
    setLogs(engine.getInteractionLogs());
    const unsub = engine.subscribeInteractionLogs((entries) => {
      setLogs(entries);
    });
    return () => unsub();
  }, [engine, paused]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...logs]
      .reverse()
      .filter((entry) => {
        if (filter === 'outgoing' && entry.direction !== 'outgoing') return false;
        if (filter === 'incoming' && entry.direction !== 'incoming') return false;
        if (filter === 'event' && entry.direction !== 'event') return false;
        if (filter === 'errors' && entry.success !== false && !entry.reasonCode) return false;
        if (!q) return true;
        return (
          entry.type.toLowerCase().includes(q) ||
          entry.summary.toLowerCase().includes(q) ||
          (entry.reasonCode || '').toLowerCase().includes(q) ||
          (entry.requestId || '').toLowerCase().includes(q)
        );
      });
  }, [logs, filter, searchQuery]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(filteredLogs, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return (
      d.toTimeString().slice(0, 8) +
      '.' +
      String(d.getMilliseconds()).padStart(3, '0')
    );
  };

  const isConnected = bridgeState.status === 'connected';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs select-text"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-5xl max-h-[86vh] rounded-xl shadow-2xl border flex flex-col overflow-hidden ${
          isDark
            ? 'bg-[#252526] border-[#454545] text-slate-200'
            : 'bg-white border-slate-300 text-slate-800'
        }`}
      >
        {/* Header */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b ${
            isDark ? 'bg-[#1e1e1e] border-[#3c3c3c]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Clockie H2 Bridge Interactions Log
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    isConnected
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-red-600/15 border-red-500/40 text-red-400'
                  }`}
                >
                  {isConnected ? `Connected v1.6 (${bridgeState.sessionMode || 'direct'})` : `Offline (${bridgeState.status})`}
                </span>
              </div>
              <p className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Session: {bridgeState.sessionId || 'none'} • {logs.length} recorded messages (newest first)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => engine.reconnect().catch(() => {})}
              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Trigger a fresh Clockie H2 v1.6 handshake"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconnect</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Action Toolbar */}
        <div
          className={`px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
            isDark ? 'border-[#3c3c3c] bg-[#252526]' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'outgoing', label: 'Outgoing' },
                { id: 'incoming', label: 'Incoming' },
                { id: 'event', label: 'Push Events' },
                { id: 'errors', label: 'Errors' },
              ] as Array<{ id: DirectionFilter; label: string }>
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFilter(btn.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                  filter === btn.id
                    ? btn.id === 'errors'
                      ? 'bg-red-600 text-white'
                      : 'bg-blue-600 text-white'
                    : isDark
                    ? 'bg-[#1e1e1e] text-slate-300 hover:bg-[#333]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search type, path, reasonCode..."
                className={`pl-8 pr-3 py-1 rounded-lg text-xs border w-56 focus:outline-none ${
                  isDark
                    ? 'bg-[#1e1e1e] border-[#454545] text-white placeholder-slate-500 focus:border-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition cursor-pointer ${
                paused
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                  : isDark
                  ? 'bg-[#1e1e1e] border-[#454545] text-slate-300 hover:bg-[#333]'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title={paused ? 'Resume live updates' : 'Pause live updates'}
            >
              {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              <span>{paused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAll}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition cursor-pointer ${
                isDark
                  ? 'bg-[#1e1e1e] border-[#454545] text-slate-300 hover:bg-[#333]'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title="Copy visible log entries as JSON"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                engine.clearInteractionLogs();
                setLogs([]);
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-red-500/40 bg-red-600/15 hover:bg-red-600/25 text-red-400 flex items-center gap-1 transition cursor-pointer"
              title="Clear recorded interaction log"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Log Entries */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-14 text-center font-sans text-xs text-slate-400 space-y-1">
              <p className="font-semibold">No Clockie H2 bridge messages match this view.</p>
              <p className="text-[11px]">
                Click Reconnect or browse a drive in Clockie H2 Drives to inspect live v1.6 protocol messages.
              </p>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const isExpanded = Boolean(expandedIds[entry.id]);
              const isError = entry.success === false || Boolean(entry.reasonCode);

              return (
                <div
                  key={entry.id}
                  className={`rounded-lg border overflow-hidden transition ${
                    isError
                      ? isDark
                        ? 'bg-red-950/25 border-red-800/50'
                        : 'bg-red-50/70 border-red-200'
                      : isDark
                      ? 'bg-[#1e1e1e] border-[#333]'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(entry.id)}
                    className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      )}

                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {formatTime(entry.timestamp)}
                      </span>

                      {entry.direction === 'outgoing' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/30 flex-shrink-0">
                          <ArrowUpRight className="w-3 h-3" />
                          <span>Sent</span>
                        </span>
                      ) : entry.direction === 'event' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-600/20 text-sky-400 border border-sky-500/30 flex-shrink-0">
                          <Radio className="w-3 h-3" />
                          <span>Push</span>
                        </span>
                      ) : isError ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-600/20 text-red-400 border border-red-500/30 flex-shrink-0">
                          <ArrowDownLeft className="w-3 h-3" />
                          <span>Error</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
                          <ArrowDownLeft className="w-3 h-3" />
                          <span>Reply</span>
                        </span>
                      )}

                      <span className={`font-bold text-[11px] flex-shrink-0 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {entry.type}
                      </span>

                      {entry.reasonCode && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-600/25 text-red-300 border border-red-500/40 flex-shrink-0">
                          {entry.reasonCode}
                        </span>
                      )}

                      <span className={`truncate text-[11px] font-sans ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {entry.summary}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 text-[10px] text-slate-400">
                      {entry.durationMs !== undefined && (
                        <span>{entry.durationMs} ms</span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div
                      className={`px-4 py-2.5 border-t text-[11px] overflow-x-auto ${
                        isDark
                          ? 'bg-[#141414] border-[#2f2f2f] text-emerald-300'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
