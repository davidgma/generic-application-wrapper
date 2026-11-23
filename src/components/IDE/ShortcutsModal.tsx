/**
 * Official Documentation:
 * - React Hooks (useState, useEffect, useMemo): https://react.dev/reference/react
 * - KeyboardEvent API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Keyboard,
  X,
  Search,
  RotateCcw,
  AlertTriangle,
  Check,
  Sliders,
  Trash2,
} from 'lucide-react';
import {
  CustomShortcutOverrides,
  SYSTEM_SHORTCUTS,
  ShortcutActionId,
  ShortcutCategory,
  detectBindingConflicts,
  getEffectiveBindings,
  keyboardEventToStepString,
  normalizeBinding,
} from './ideShortcuts';

interface ShortcutsModalProps {
  initialTab: 'system' | 'custom';
  isDark: boolean;
  overrides: CustomShortcutOverrides;
  onUpdateOverrides: (next: CustomShortcutOverrides) => void;
  onResetAll: () => void;
  onRecordingChange?: (isRecording: boolean) => void;
  onClose: () => void;
}

const CATEGORY_ORDER: ShortcutCategory[] = ['File', 'Edit', 'Bridge', 'View', 'Help', 'IDE'];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  initialTab,
  isDark,
  overrides,
  onUpdateOverrides,
  onResetAll,
  onRecordingChange,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'system' | 'custom'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | 'All'>('All');

  // Interactive key/chord recorder state for Custom Shortcuts
  const [recordingActionId, setRecordingActionId] = useState<ShortcutActionId | null>(null);
  const [recordedSteps, setRecordedSteps] = useState<string[]>([]);
  const chordFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Tell GAWIDE to pause global shortcut dispatch while the user is recording a new binding
  useEffect(() => {
    onRecordingChange?.(recordingActionId !== null);
    return () => onRecordingChange?.(false);
  }, [recordingActionId, onRecordingChange]);

  const stopRecording = () => {
    if (chordFinalizeTimerRef.current) {
      clearTimeout(chordFinalizeTimerRef.current);
      chordFinalizeTimerRef.current = null;
    }
    setRecordingActionId(null);
    setRecordedSteps([]);
  };

  // Capture physical keys while recording a single shortcut or a two-step chord
  useEffect(() => {
    if (!recordingActionId) return;

    const handleCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      if (e.key === 'Escape') {
        stopRecording();
        return;
      }

      // Pressing Enter while 1 step is already captured confirms the single-step shortcut immediately
      if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && recordedSteps.length === 1) {
        const binding = normalizeBinding(recordedSteps[0]);
        if (binding) {
          onUpdateOverrides({ ...overrides, [recordingActionId]: [binding] });
        }
        stopRecording();
        return;
      }

      const step = keyboardEventToStepString(e);
      if (!step) return;

      if (recordedSteps.length === 0) {
        // Require a modifier (Ctrl, Alt, or Function key) on the first step so plain typing isn't hijacked
        const hasModifier = step.includes('Ctrl+') || step.includes('Alt+') || /^F([1-9]|1[0-2])$/.test(step);
        if (!hasModifier) return;

        setRecordedSteps([step]);

        // Allow 1.5 seconds to press an optional second chord key; otherwise finalize as a 1-step binding
        if (chordFinalizeTimerRef.current) clearTimeout(chordFinalizeTimerRef.current);
        chordFinalizeTimerRef.current = setTimeout(() => {
          const singleBinding = normalizeBinding(step);
          if (singleBinding) {
            onUpdateOverrides({ ...overrides, [recordingActionId]: [singleBinding] });
          }
          stopRecording();
        }, 1500);
      } else {
        // Second step received -> immediately save as a two-step chord (e.g. "Alt+N C")
        if (chordFinalizeTimerRef.current) {
          clearTimeout(chordFinalizeTimerRef.current);
          chordFinalizeTimerRef.current = null;
        }
        const chordBinding = normalizeBinding(`${recordedSteps[0]} ${step}`);
        if (chordBinding) {
          onUpdateOverrides({ ...overrides, [recordingActionId]: [chordBinding] });
        }
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleCapture, true);
    return () => window.removeEventListener('keydown', handleCapture, true);
  }, [recordingActionId, recordedSteps, overrides, onUpdateOverrides]);

  useEffect(() => {
    return () => {
      if (chordFinalizeTimerRef.current) clearTimeout(chordFinalizeTimerRef.current);
    };
  }, []);

  const conflicts = useMemo(() => detectBindingConflicts(overrides), [overrides]);
  const conflictingActionSet = useMemo(() => {
    const set = new Set<ShortcutActionId>();
    conflicts.forEach((c) => c.actionIds.forEach((id) => set.add(id)));
    return set;
  }, [conflicts]);

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SYSTEM_SHORTCUTS.filter((def) => {
      if (activeTab === 'custom' && !def.customizable) return false;
      if (selectedCategory !== 'All' && def.category !== selectedCategory) return false;
      if (!q) return true;
      const effective = getEffectiveBindings(def.id, overrides).join(' ').toLowerCase();
      return (
        def.label.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q) ||
        def.category.toLowerCase().includes(q) ||
        effective.includes(q)
      );
    });
  }, [activeTab, searchQuery, selectedCategory, overrides]);

  const groupedShortcuts = useMemo(() => {
    const groups = new Map<ShortcutCategory, typeof filteredShortcuts>();
    for (const cat of CATEGORY_ORDER) {
      const items = filteredShortcuts.filter((s) => s.category === cat);
      if (items.length > 0) groups.set(cat, items);
    }
    return groups;
  }, [filteredShortcuts]);

  const customOverrideCount = Object.keys(overrides).length;

  const handleResetSingle = (id: ShortcutActionId) => {
    const next = { ...overrides };
    delete next[id];
    onUpdateOverrides(next);
  };

  const handleClearBinding = (id: ShortcutActionId) => {
    onUpdateOverrides({ ...overrides, [id]: [] });
  };

  return (
    <div
      onClick={() => {
        if (!recordingActionId) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs select-text"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl border flex flex-col overflow-hidden ${
          isDark
            ? 'bg-[#252526] border-[#454545] text-slate-200'
            : 'bg-white border-slate-300 text-slate-800'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isDark ? 'bg-[#1e1e1e] border-[#3c3c3c]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                IDE Keyboard Shortcuts
              </h3>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Standardized shortcuts and two-step chords for Gawkyy IDE Mode (App Mode uses native cut, copy, and paste only).
              </p>
            </div>
          </div>

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

        {/* Mode Tabs & Filter Bar */}
        <div
          className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 ${
            isDark ? 'border-[#3c3c3c] bg-[#252526]' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopRecording();
                setActiveTab('system');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                activeTab === 'system'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                  : isDark
                  ? 'bg-[#1e1e1e] text-slate-300 border-[#3c3c3c] hover:bg-[#333]'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>System shortcuts</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopRecording();
                setActiveTab('custom');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                activeTab === 'custom'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                  : isDark
                  ? 'bg-[#1e1e1e] text-slate-300 border-[#3c3c3c] hover:bg-[#333]'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Custom shortcuts</span>
              {customOverrideCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-bold">
                  {customOverrideCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end min-w-[220px]">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by command or key..."
                className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none ${
                  isDark
                    ? 'bg-[#1e1e1e] border-[#454545] text-white placeholder-slate-500 focus:border-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600'
                }`}
              />
            </div>

            {activeTab === 'custom' && customOverrideCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  stopRecording();
                  onResetAll();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 bg-red-600/15 hover:bg-red-600/25 text-red-400 flex items-center gap-1.5 transition cursor-pointer"
                title="Reset all customized shortcuts to system defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset all</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Row */}
        <div
          className={`px-5 py-2 border-b flex items-center gap-1.5 overflow-x-auto text-[11px] ${
            isDark ? 'border-[#3c3c3c] bg-[#1e1e1e]/60' : 'border-slate-200 bg-slate-50/70'
          }`}
        >
          {(['All', ...CATEGORY_ORDER] as Array<ShortcutCategory | 'All'>).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : isDark
                  ? 'text-slate-300 hover:bg-[#333]'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Conflict Warning Banner */}
        {conflicts.length > 0 && (
          <div className="px-5 py-2 bg-red-950/50 border-b border-red-700/50 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>
              Shortcut conflict detected on:{' '}
              <strong>{conflicts.map((c) => c.binding).join(', ')}</strong>. Reassign or reset one of the conflicting commands below.
            </span>
          </div>
        )}

        {/* Active Recording Helper Banner */}
        {recordingActionId && (
          <div className="px-5 py-2.5 bg-blue-950/60 border-b border-blue-500/50 text-blue-100 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>
                {recordedSteps.length === 0
                  ? 'Press your shortcut starting with Ctrl, Alt, or F1–F12 (Esc cancels)...'
                  : `Captured "${recordedSteps[0]}" — press a second key within 1.5s for a chord, or press Enter to save as single key.`}
              </span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-2 py-0.5 rounded bg-blue-800 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Shortcut List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {groupedShortcuts.size === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No shortcuts match your filter.
            </div>
          ) : (
            Array.from(groupedShortcuts.entries()).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <h4
                  className={`text-xs font-bold pb-1 border-b ${
                    isDark ? 'text-sky-300 border-[#3c3c3c]' : 'text-blue-700 border-slate-200'
                  }`}
                >
                  {category}
                </h4>

                <div className="divide-y divide-slate-800/30">
                  {items.map((def) => {
                    const effective = getEffectiveBindings(def.id, overrides);
                    const isOverridden = overrides[def.id] !== undefined;
                    const isRecordingThis = recordingActionId === def.id;
                    const hasConflict = conflictingActionSet.has(def.id);

                    return (
                      <div
                        key={def.id}
                        className={`py-2.5 px-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition ${
                          isRecordingThis
                            ? isDark
                              ? 'bg-blue-950/50 ring-1 ring-blue-500'
                              : 'bg-blue-50 ring-1 ring-blue-500'
                            : hasConflict
                            ? isDark
                              ? 'bg-red-950/30'
                              : 'bg-red-50'
                            : isDark
                            ? 'hover:bg-[#2a2d2e]'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {def.label}
                            </span>
                            {isOverridden && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                                Customized
                              </span>
                            )}
                            {hasConflict && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-600/20 text-red-400 border border-red-500/30">
                                Conflict
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {def.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          {/* Display bindings */}
                          {isRecordingThis ? (
                            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-blue-600 text-white animate-pulse">
                              {recordedSteps.length > 0 ? `${recordedSteps[0]} …` : 'Listening…'}
                            </span>
                          ) : effective.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {effective.map((b, idx) => (
                                <kbd
                                  key={idx}
                                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                                    hasConflict
                                      ? 'bg-red-950/60 border-red-500/60 text-red-200'
                                      : isDark
                                      ? 'bg-[#1e1e1e] border-[#454545] text-sky-300'
                                      : 'bg-slate-100 border-slate-300 text-blue-800'
                                  }`}
                                >
                                  {b}
                                </kbd>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] italic text-slate-500">Unassigned</span>
                          )}

                          {/* Custom tab controls */}
                          {activeTab === 'custom' && def.customizable && (
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isRecordingThis) {
                                    stopRecording();
                                  } else {
                                    stopRecording();
                                    setRecordingActionId(def.id);
                                    setRecordedSteps([]);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                                  isRecordingThis
                                    ? 'bg-slate-700 text-white hover:bg-slate-600'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }`}
                              >
                                {isRecordingThis ? 'Cancel' : 'Record'}
                              </button>

                              {effective.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleClearBinding(def.id)}
                                  className={`p-1 rounded transition cursor-pointer ${
                                    isDark
                                      ? 'text-slate-400 hover:text-red-400 hover:bg-slate-700'
                                      : 'text-slate-500 hover:text-red-600 hover:bg-slate-200'
                                  }`}
                                  title="Clear shortcut"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {isOverridden && (
                                <button
                                  type="button"
                                  onClick={() => handleResetSingle(def.id)}
                                  className={`p-1 rounded transition cursor-pointer ${
                                    isDark
                                      ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700'
                                      : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-200'
                                  }`}
                                  title={`Reset to default (${def.defaultBindings.join(' / ')})`}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between text-[11px] ${
            isDark ? 'bg-[#1e1e1e] border-[#3c3c3c] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              Two-step chords (e.g. <code className="font-mono">Alt+N C</code>): press and release the first combo, then press the second key within 1.5s.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
