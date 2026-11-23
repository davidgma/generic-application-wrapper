/**
 * Official Documentation:
 * - KeyboardEvent.code (MDN): https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
 * - UI Events KeyboardEvent Key Values (MDN): https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
 * - Window.localStorage (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
 */

export type ShortcutCategory = 'File' | 'Edit' | 'Bridge' | 'View' | 'Help' | 'IDE';

export type ShortcutActionId =
  | 'file.new.component'
  | 'file.new.query'
  | 'file.new.table'
  | 'file.new.view'
  | 'file.new.report'
  | 'file.newTab'
  | 'file.closeTab'
  | 'file.closeAllTabs'
  | 'file.undoCloseTab'
  | 'file.open'
  | 'file.openDrive.pcloud'
  | 'file.openDrive.gdrive'
  | 'file.openDrive.dropbox'
  | 'file.openDrive.local'
  | 'file.save'
  | 'file.saveAs'
  | 'file.saveAll'
  | 'edit.cut'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.selectAll'
  | 'edit.invertSelection'
  | 'edit.preferences'
  | 'bridge.interactionsLog'
  | 'view.refresh'
  | 'view.shortcuts.system'
  | 'view.shortcuts.custom'
  | 'help.about'
  | 'ide.commandPalette'
  | 'ide.toggleSidebar'
  | 'ide.toggleMode'
  | 'ide.toggleView'
  | 'ide.formatDocument'
  | 'ide.runQuery'
  | 'ide.toggleComment';

export interface ShortcutDefinition {
  id: ShortcutActionId;
  label: string;
  category: ShortcutCategory;
  /** Canonical binding strings, e.g. ["Alt+N C"], ["Ctrl+S", "Alt+S"], ["Alt+T C", "Alt+T W"] */
  defaultBindings: string[];
  description: string;
  /** Native clipboard/text commands can be listed in System Shortcuts while optionally kept native */
  customizable: boolean;
}

export type CustomShortcutOverrides = Partial<Record<ShortcutActionId, string[]>>;

export const CUSTOM_SHORTCUTS_STORAGE_KEY = 'gaw_ide_custom_shortcuts_v1';

/**
 * Standardized Gawkyy IDE shortcut catalog aligned across Clockie H2, Monaco IDE, and Gawkyy.
 * Two-step chords are written as space-separated steps (e.g. "Alt+N C" means press Alt+N, release, then C).
 */
export const SYSTEM_SHORTCUTS: ShortcutDefinition[] = [
  // --- File ---
  {
    id: 'file.new.component',
    label: 'File: New Component',
    category: 'File',
    defaultBindings: ['Alt+N C'],
    description: 'Create a new TSX component in the workspace.',
    customizable: true,
  },
  {
    id: 'file.new.query',
    label: 'File: New Query',
    category: 'File',
    defaultBindings: ['Alt+N Q'],
    description: 'Create and save a new SQL query in the workspace.',
    customizable: true,
  },
  {
    id: 'file.new.table',
    label: 'File: New Table',
    category: 'File',
    defaultBindings: ['Alt+N T'],
    description: 'Open a pro-forma CREATE TABLE script in the editor.',
    customizable: true,
  },
  {
    id: 'file.new.view',
    label: 'File: New View',
    category: 'File',
    defaultBindings: ['Alt+N V'],
    description: 'Open a pro-forma CREATE VIEW script in the editor.',
    customizable: true,
  },
  {
    id: 'file.new.report',
    label: 'File: New Report',
    category: 'File',
    defaultBindings: ['Alt+N R'],
    description: 'Launch the Visual Report Builder to create a new report.',
    customizable: true,
  },
  {
    id: 'file.newTab',
    label: 'File: New Tab',
    category: 'File',
    defaultBindings: ['Alt+T N'],
    description: 'Open a fresh SQL scratchpad tab in the IDE.',
    customizable: true,
  },
  {
    id: 'file.closeTab',
    label: 'File: Close Tab',
    category: 'File',
    defaultBindings: ['Alt+T C', 'Alt+T W'],
    description: 'Close the active IDE tab (can be restored with Undo Close Tab).',
    customizable: true,
  },
  {
    id: 'file.closeAllTabs',
    label: 'File: Close All Tabs',
    category: 'File',
    defaultBindings: ['Alt+T A', 'Alt+T Q'],
    description: 'Close all open IDE tabs (restorable via Undo Close Tab).',
    customizable: true,
  },
  {
    id: 'file.undoCloseTab',
    label: 'File: Undo Close Tab',
    category: 'File',
    defaultBindings: ['Alt+T U'],
    description: 'Reopen the most recently closed IDE tab.',
    customizable: true,
  },
  {
    id: 'file.open',
    label: 'File: Open',
    category: 'File',
    defaultBindings: ['Alt+O O'],
    description: 'Open the File & Workspace Manager to load or manage databases.',
    customizable: true,
  },
  {
    id: 'file.openDrive.pcloud',
    label: 'File: Open Drive — pCloud',
    category: 'File',
    defaultBindings: ['Alt+O P'],
    description: 'Open Clockie H2 Drives focused on pCloud.',
    customizable: true,
  },
  {
    id: 'file.openDrive.gdrive',
    label: 'File: Open Drive — Google Drive',
    category: 'File',
    defaultBindings: ['Alt+O G'],
    description: 'Open Clockie H2 Drives focused on Google Drive.',
    customizable: true,
  },
  {
    id: 'file.openDrive.dropbox',
    label: 'File: Open Drive — Dropbox',
    category: 'File',
    defaultBindings: ['Alt+O D'],
    description: 'Open Clockie H2 Drives focused on Dropbox.',
    customizable: true,
  },
  {
    id: 'file.openDrive.local',
    label: 'File: Open Drive — Local',
    category: 'File',
    defaultBindings: ['Alt+O L'],
    description: 'Open Clockie H2 Drives focused on Local Drive.',
    customizable: true,
  },
  {
    id: 'file.save',
    label: 'File: Save',
    category: 'File',
    defaultBindings: ['Ctrl+S', 'Alt+S'],
    description: 'Save the active IDE tab to SQLite.',
    customizable: true,
  },
  {
    id: 'file.saveAs',
    label: 'File: Save As…',
    category: 'File',
    defaultBindings: ['Alt+Shift+S', 'Ctrl+Shift+S'],
    description: 'Rename or save the active item under a new name.',
    customizable: true,
  },
  {
    id: 'file.saveAll',
    label: 'File: Save All',
    category: 'File',
    defaultBindings: ['Alt+A'],
    description: 'Save all modified IDE tabs to SQLite.',
    customizable: true,
  },

  // --- Edit ---
  {
    id: 'edit.cut',
    label: 'Edit: Cut',
    category: 'Edit',
    defaultBindings: ['Ctrl+X'],
    description: 'Cut the selected text to the clipboard.',
    customizable: false,
  },
  {
    id: 'edit.copy',
    label: 'Edit: Copy',
    category: 'Edit',
    defaultBindings: ['Ctrl+C'],
    description: 'Copy the selected text to the clipboard.',
    customizable: false,
  },
  {
    id: 'edit.paste',
    label: 'Edit: Paste',
    category: 'Edit',
    defaultBindings: ['Ctrl+V'],
    description: 'Paste text from the clipboard at the cursor.',
    customizable: false,
  },
  {
    id: 'edit.undo',
    label: 'Edit: Undo',
    category: 'Edit',
    defaultBindings: ['Ctrl+Z'],
    description: 'Undo the last edit or restore a recently deleted query.',
    customizable: false,
  },
  {
    id: 'edit.redo',
    label: 'Edit: Redo',
    category: 'Edit',
    defaultBindings: ['Ctrl+Y'],
    description: 'Redo the last undone edit in the code editor.',
    customizable: false,
  },
  {
    id: 'edit.selectAll',
    label: 'Edit: Select All',
    category: 'Edit',
    defaultBindings: ['Ctrl+A'],
    description: 'Select all text in the active editor.',
    customizable: false,
  },
  {
    id: 'edit.invertSelection',
    label: 'Edit: Invert Selection',
    category: 'Edit',
    defaultBindings: ['Alt+E I'],
    description: 'Select the complementary text outside the current editor selection.',
    customizable: true,
  },
  {
    id: 'edit.preferences',
    label: 'Edit: Preferences',
    category: 'Edit',
    defaultBindings: ['Alt+E P'],
    description: 'Open Settings & Workspace Preferences.',
    customizable: true,
  },

  // --- Bridge ---
  {
    id: 'bridge.interactionsLog',
    label: 'Bridge: Show Interactions Log',
    category: 'Bridge',
    defaultBindings: ['Alt+B I'],
    description: 'Inspect live Clockie H2 Bridge v1.6 requests, responses, and push events.',
    customizable: true,
  },

  // --- View ---
  {
    id: 'view.refresh',
    label: 'View: Refresh',
    category: 'View',
    defaultBindings: ['Alt+V R'],
    description: 'Refresh workspace schema, clear compiled plugin cache, and verify Clockie H2 sync.',
    customizable: true,
  },
  {
    id: 'view.shortcuts.system',
    label: 'View: System Shortcuts',
    category: 'View',
    defaultBindings: ['Alt+V S'],
    description: 'Open the searchable System Shortcuts reference.',
    customizable: true,
  },
  {
    id: 'view.shortcuts.custom',
    label: 'View: Custom Shortcuts',
    category: 'View',
    defaultBindings: ['Alt+V C'],
    description: 'Customize keyboard shortcuts and chords for IDE Mode.',
    customizable: true,
  },

  // --- Help ---
  {
    id: 'help.about',
    label: 'Help: About',
    category: 'Help',
    defaultBindings: ['Alt+H A'],
    description: 'Show version and platform details for Gawkyy IDE Studio.',
    customizable: true,
  },

  // --- IDE-specific ---
  {
    id: 'ide.commandPalette',
    label: 'IDE: Command Palette',
    category: 'IDE',
    defaultBindings: ['Ctrl+Shift+P', 'F1'],
    description: 'Open the quick command and workspace object launcher.',
    customizable: true,
  },
  {
    id: 'ide.toggleSidebar',
    label: 'IDE: Toggle Primary Side Bar',
    category: 'IDE',
    defaultBindings: ['Ctrl+B', 'Ctrl+Shift+D'],
    description: 'Show or hide the left Explorer/Search sidebar.',
    customizable: true,
  },
  {
    id: 'ide.toggleMode',
    label: 'IDE: Switch to App Mode',
    category: 'IDE',
    defaultBindings: ['Ctrl+Shift+F'],
    description: 'Auto-save dirty IDE tabs and switch to App Mode.',
    customizable: true,
  },
  {
    id: 'ide.toggleView',
    label: 'IDE: Toggle Code / Live View',
    category: 'IDE',
    defaultBindings: ['Ctrl+Shift+K'],
    description: 'Switch active tab between source code and live preview / results.',
    customizable: true,
  },
  {
    id: 'ide.formatDocument',
    label: 'IDE: Format Document (Prettier)',
    category: 'IDE',
    defaultBindings: ['Shift+Alt+F'],
    description: 'Format the active TSX, SQL, or JSON tab with Prettier.',
    customizable: true,
  },
  {
    id: 'ide.runQuery',
    label: 'IDE: Run Query / Test Component',
    category: 'IDE',
    defaultBindings: ['Ctrl+Enter'],
    description: 'Execute the active SQL script or compile/preview the active component.',
    customizable: true,
  },
  {
    id: 'ide.toggleComment',
    label: 'IDE: Toggle Line Comment',
    category: 'IDE',
    defaultBindings: ['Ctrl+/'],
    description: 'Comment or uncomment the selected lines in the editor.',
    customizable: true,
  },
];

export interface ParsedKeyStep {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string; // Uppercase normalized token: 'A'-'Z', '0'-'9', 'F1'-'F12', 'Enter', '/', ',', etc.
}

/**
 * Normalizes a KeyboardEvent's physical key (`event.code`) into a layout-independent key token.
 * Using `event.code` prevents macOS Option+<letter> Unicode characters (e.g. Option+S -> "ß")
 * from breaking Alt+ shortcuts and chords.
 */
export function keyboardEventToKeyToken(e: KeyboardEvent): string | null {
  const code = e.code || '';
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3).toUpperCase();
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5);
  }
  if (/^F([1-9]|1[0-2])$/.test(code)) {
    return code;
  }
  switch (code) {
    case 'Enter':
    case 'NumpadEnter':
      return 'Enter';
    case 'Slash':
      return '/';
    case 'Backquote':
      return '`';
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'Space':
      return 'Space';
    case 'ArrowLeft':
      return 'Left';
    case 'ArrowRight':
      return 'Right';
    case 'ArrowUp':
      return 'Up';
    case 'ArrowDown':
      return 'Down';
    case 'Escape':
      return 'Escape';
    default:
      break;
  }

  // Fallback to e.key for non-standard keyboards, ignoring lone modifier keys
  const rawKey = e.key;
  if (!rawKey || ['Control', 'Shift', 'Alt', 'Meta', 'Dead', 'Unidentified'].includes(rawKey)) {
    return null;
  }
  if (rawKey.length === 1) {
    return rawKey.toUpperCase();
  }
  return rawKey;
}

/**
 * Converts a live KeyboardEvent into a canonical step string such as "Alt+N", "Ctrl+Shift+S", or "C".
 */
export function keyboardEventToStepString(e: KeyboardEvent): string | null {
  const token = keyboardEventToKeyToken(e);
  if (!token) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(token);
  return parts.join('+');
}

/**
 * Parses one step string (e.g. "Shift+Alt+F" or "Alt+N" or "C") into a canonical order.
 */
export function normalizeStepString(step: string): string {
  const tokens = step
    .trim()
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);

  let ctrl = false;
  let alt = false;
  let shift = false;
  let key = '';

  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (lower === 'ctrl' || lower === 'cmd' || lower === 'meta' || lower === 'control') {
      ctrl = true;
    } else if (lower === 'alt' || lower === 'option' || lower === 'opt') {
      alt = true;
    } else if (lower === 'shift') {
      shift = true;
    } else if (lower === 'enter' || lower === 'return') {
      key = 'Enter';
    } else if (lower === 'space') {
      key = 'Space';
    } else if (lower === 'esc' || lower === 'escape') {
      key = 'Escape';
    } else if (/^f([1-9]|1[0-2])$/i.test(t)) {
      key = t.toUpperCase();
    } else if (t.length === 1) {
      key = t.toUpperCase();
    } else {
      key = t.charAt(0).toUpperCase() + t.slice(1);
    }
  }

  if (!key) return '';
  const out: string[] = [];
  if (ctrl) out.push('Ctrl');
  if (alt) out.push('Alt');
  if (shift) out.push('Shift');
  out.push(key);
  return out.join('+');
}

/**
 * Normalizes a full shortcut binding (1 or 2 steps), e.g. "alt+n c" -> "Alt+N C".
 */
export function normalizeBinding(binding: string): string {
  const steps = binding
    .trim()
    .split(/\s+/)
    .map(normalizeStepString)
    .filter(Boolean);
  return steps.slice(0, 2).join(' ');
}

/**
 * Splits a normalized binding into its 1 or 2 canonical step strings.
 */
export function splitBindingSteps(binding: string): string[] {
  const norm = normalizeBinding(binding);
  return norm ? norm.split(' ') : [];
}

/**
 * Loads user-defined custom shortcut overrides from localStorage.
 */
export function loadCustomShortcuts(): CustomShortcutOverrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_SHORTCUTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const cleaned: CustomShortcutOverrides = {};
    for (const def of SYSTEM_SHORTCUTS) {
      if (!def.customizable) continue;
      const val = parsed[def.id];
      if (Array.isArray(val)) {
        cleaned[def.id] = val.map((b) => normalizeBinding(String(b))).filter(Boolean);
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

/**
 * Saves custom shortcut overrides to localStorage.
 */
export function saveCustomShortcuts(overrides: CustomShortcutOverrides): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_SHORTCUTS_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Clears all custom shortcut overrides so all commands revert to system defaults.
 */
export function resetCustomShortcuts(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CUSTOM_SHORTCUTS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Returns the effective normalized bindings for a given action ID.
 */
export function getEffectiveBindings(
  actionId: ShortcutActionId,
  overrides: CustomShortcutOverrides
): string[] {
  const def = SYSTEM_SHORTCUTS.find((s) => s.id === actionId);
  if (!def) return [];
  if (def.customizable && overrides[actionId] !== undefined) {
    return overrides[actionId]!.map(normalizeBinding).filter(Boolean);
  }
  return def.defaultBindings.map(normalizeBinding).filter(Boolean);
}

/**
 * Formats an action's bindings compactly for dropdown menu labels, e.g.:
 * ["Alt+T C", "Alt+T W"] -> "Alt+T C / W"
 * ["Ctrl+S", "Alt+S"]    -> "Ctrl+S / Alt+S"
 */
export function formatBindingsForMenu(bindings: string[]): string {
  if (!bindings || bindings.length === 0) return '';
  if (bindings.length === 1) return bindings[0];

  // Collapse chords sharing the exact same prefix (e.g. "Alt+T C" and "Alt+T W" -> "Alt+T C / W")
  const parsed = bindings.map(splitBindingSteps);
  if (
    parsed.every((p) => p.length === 2) &&
    parsed.every((p) => p[0] === parsed[0][0])
  ) {
    const prefix = parsed[0][0];
    const suffixes = parsed.map((p) => p[1]).join(' / ');
    return `${prefix} ${suffixes}`;
  }
  return bindings.join(' / ');
}

export interface ShortcutConflict {
  binding: string;
  actionIds: ShortcutActionId[];
}

/**
 * Detects duplicate shortcut bindings across all effective IDE commands so the Custom Shortcuts
 * editor can display clear red conflict warnings.
 */
export function detectBindingConflicts(overrides: CustomShortcutOverrides): ShortcutConflict[] {
  const byBinding = new Map<string, ShortcutActionId[]>();
  for (const def of SYSTEM_SHORTCUTS) {
    const effective = getEffectiveBindings(def.id, overrides);
    for (const b of effective) {
      const list = byBinding.get(b) || [];
      if (!list.includes(def.id)) list.push(def.id);
      byBinding.set(b, list);
    }
  }
  const conflicts: ShortcutConflict[] = [];
  byBinding.forEach((actionIds, binding) => {
    if (actionIds.length > 1) {
      conflicts.push({ binding, actionIds });
    }
  });
  return conflicts;
}

export interface ShortcutLookupIndex {
  /** Exact 1-step bindings: stepString -> ShortcutActionId */
  singleStepMap: Map<string, ShortcutActionId>;
  /** 2-step chords: firstStep -> Map<secondStep, ShortcutActionId> */
  chordMap: Map<string, Map<string, ShortcutActionId>>;
}

/**
 * Builds fast lookup tables for single-step and two-step chord matching in the capture-phase keydown handler.
 * Native Edit shortcuts (customizable: false) are intentionally excluded so the browser & Monaco handle
 * Cut, Copy, Paste, Undo, Redo, and Select All natively without interference.
 */
export function buildShortcutLookup(overrides: CustomShortcutOverrides): ShortcutLookupIndex {
  const singleStepMap = new Map<string, ShortcutActionId>();
  const chordMap = new Map<string, Map<string, ShortcutActionId>>();

  for (const def of SYSTEM_SHORTCUTS) {
    if (!def.customizable) continue;
    const bindings = getEffectiveBindings(def.id, overrides);
    for (const b of bindings) {
      const steps = splitBindingSteps(b);
      if (steps.length === 1) {
        if (!singleStepMap.has(steps[0])) {
          singleStepMap.set(steps[0], def.id);
        }
      } else if (steps.length === 2) {
        let secondMap = chordMap.get(steps[0]);
        if (!secondMap) {
          secondMap = new Map<string, ShortcutActionId>();
          chordMap.set(steps[0], secondMap);
        }
        if (!secondMap.has(steps[1])) {
          secondMap.set(steps[1], def.id);
        }
      }
    }
  }

  return { singleStepMap, chordMap };
}
