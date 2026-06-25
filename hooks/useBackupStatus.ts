// hooks/useBackupStatus.ts
//
// Reads lastBackupDate from AsyncStorage and returns a human-readable string.
// Read-only. Never writes.
// Logging prefix: [BACKUP]

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export const LAST_BACKUP_KEY = 'lastBackupDate';

export type BackupStatus = {
  label: string;       // Human-readable e.g. "3 days ago"
  rawDate: string | null; // ISO string or null if never
  hasBackup: boolean;
  refresh: () => Promise<void>;
};

function log(event: string, data?: unknown) {
  console.log(`[BACKUP] ${event}`, data ?? '');
}

function formatBackupDate(iso: string | null): string {
  if (!iso) return 'Never';

  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'Never';

  const now = Date.now();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) return 'Just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function useBackupStatus(): BackupStatus {
  const [rawDate, setRawDate] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const val = await AsyncStorage.getItem(LAST_BACKUP_KEY);
      setRawDate(val);
      log('Loaded', { rawDate: val });
    } catch (err) {
      log('Failed to read', { err: String(err) });
      setRawDate(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    label: loaded ? formatBackupDate(rawDate) : '…',
    rawDate,
    hasBackup: !!rawDate,
    refresh,
  };
}
