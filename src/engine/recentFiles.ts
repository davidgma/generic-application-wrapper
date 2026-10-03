export interface RecentFileItem {
  id: string;
  name: string;
  source: 'local' | 'dropbox' | 'demo';
  path?: string;
  size?: number;
  lastOpened: string; // ISO string
}

const RECENT_FILES_KEY = 'gaw_recent_files';

export class RecentFilesManager {
  public static getRecentFiles(): RecentFileItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(RECENT_FILES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }

  public static addRecentFile(
    item: Omit<RecentFileItem, 'id' | 'lastOpened'> & { id?: string; lastOpened?: string }
  ): RecentFileItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const current = RecentFilesManager.getRecentFiles();
      const existingIdx = current.findIndex(
        (f) => f.name.toLowerCase() === item.name.toLowerCase() && f.source === item.source
      );

      const updatedItem: RecentFileItem = {
        id: item.id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: item.name,
        source: item.source,
        path: item.path,
        size: item.size,
        lastOpened: item.lastOpened || new Date().toISOString(),
      };

      let list: RecentFileItem[];
      if (existingIdx >= 0) {
        current.splice(existingIdx, 1);
        list = [updatedItem, ...current];
      } else {
        list = [updatedItem, ...current].slice(0, 25);
      }

      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(list));
      return list;
    } catch {
      return [];
    }
  }

  public static removeRecentFile(id: string): RecentFileItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const current = RecentFilesManager.getRecentFiles();
      const filtered = current.filter((f) => f.id !== id);
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(filtered));
      return filtered;
    } catch {
      return [];
    }
  }

  public static clearRecentFiles(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(RECENT_FILES_KEY);
    } catch {
      // ignore
    }
  }
}
