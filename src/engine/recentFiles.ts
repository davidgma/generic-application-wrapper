/**
 * Official Documentation:
 * - Web Storage API (localStorage): https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
 */
import { RecentFileItem } from '../types/storage';

export type { RecentFileItem };

const RECENT_FILES_KEY = 'gaw_recent_files';

export class RecentFilesManager {
  public static getRecentFiles(): RecentFileItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(RECENT_FILES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Migrate legacy 'dropbox' recent file entries cleanly to Clockie H2 ('h2' + provider: 'dropbox')
      return parsed.map((item: any) => {
        if (item && item.source === 'dropbox') {
          return {
            ...item,
            source: 'h2' as const,
            provider: 'dropbox' as const,
            driveRoot: true,
          };
        }
        return item as RecentFileItem;
      });
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
        (f) =>
          f.name.toLowerCase() === item.name.toLowerCase() &&
          f.source === item.source &&
          (f.provider || '') === (item.provider || '') &&
          (f.path || '') === (item.path || '')
      );

      const updatedItem: RecentFileItem = {
        id: item.id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: item.name,
        source: item.source,
        provider: item.provider,
        driveRoot: item.driveRoot,
        fileId: item.fileId,
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
