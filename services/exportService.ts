// services/exportService.ts
//
// READ-ONLY export service. Never writes to any portfolio store.
// Writes lastBackupDate to AsyncStorage after successful export.
// Logging prefix: [EXPORT]

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FS = require('expo-file-system/legacy') as any;

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import { BACKUP_SCHEMA_VERSION } from '../app/constants/backupSchema';
import { LAST_BACKUP_KEY } from '../hooks/useBackupStatus';

const STORAGE_KEYS = {
  TRANSACTIONS: 'portfolio_transactions',
  WATCHLIST: 'watchlist_items',
  CHART_MODE: 'chart_mode_preference',
  ONBOARDING: 'onboarding_complete',
} as const;

export type ExportPayload = {
  schemaVersion: number;
  exportTimestamp: string;
  transactions: unknown[];
  watchlist: unknown[];
  preferences: {
    chartModePreference: string | null;
    onboardingComplete: string | null;
  };
};

export type ExportResult =
  | { ok: true; filename: string }
  | { ok: false; error: string };

function log(event: string, data?: unknown) {
  console.log(`[EXPORT] ${event}`, data ?? '');
}

function todayFileSafe(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseSafely(raw: string | null, label: string): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      log(`WARNING: ${label} was not an array — exporting as []`);
      return [];
    }
    return parsed;
  } catch {
    log(`WARNING: ${label} failed to parse — exporting as []`);
    return [];
  }
}

function validatePayload(payload: ExportPayload): string | null {
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) return `Invalid schema version: ${payload.schemaVersion}`;
  if (!payload.exportTimestamp) return 'Missing export timestamp';
  if (!Array.isArray(payload.transactions)) return 'transactions field is not an array';
  if (!Array.isArray(payload.watchlist)) return 'watchlist field is not an array';
  if (!payload.preferences || typeof payload.preferences !== 'object') return 'preferences field is missing or invalid';
  return null;
}

export async function exportPortfolio(): Promise<ExportResult> {
  log('Export started');
  try {
    const [transactionsRaw, watchlistRaw, chartMode, onboarding] =
      await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TRANSACTIONS),
        AsyncStorage.getItem(STORAGE_KEYS.WATCHLIST),
        AsyncStorage.getItem(STORAGE_KEYS.CHART_MODE),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING),
      ]);

    log('Storage read complete', { hasTransactions: !!transactionsRaw, hasWatchlist: !!watchlistRaw });

    const transactions = parseSafely(transactionsRaw, 'transactions');
    const watchlist = parseSafely(watchlistRaw, 'watchlist');

    const payload: ExportPayload = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportTimestamp: new Date().toISOString(),
      transactions,
      watchlist,
      preferences: {
        chartModePreference: chartMode,
        onboardingComplete: onboarding,
      },
    };

    const validationError = validatePayload(payload);
    if (validationError) {
      log('Validation failed', { error: validationError });
      return { ok: false, error: `Validation failed: ${validationError}` };
    }

    log('Validation passed', { transactionCount: transactions.length, watchlistCount: watchlist.length });

    const filename = `myETFspy-backup-${todayFileSafe()}.json`;
    const cacheDir: string = FS.cacheDirectory ?? FS.documentDirectory ?? '';
    const fileUri = `${cacheDir}${filename}`;
    const json = JSON.stringify(payload, null, 2);

    await FS.writeAsStringAsync(fileUri, json, {
      encoding: FS.EncodingType?.UTF8 ?? 'utf8',
    });

    log('File written', { fileUri, sizeBytes: json.length });

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      log('Sharing not available');
      return { ok: false, error: 'Sharing is not available on this device.' };
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: 'Save your myETFspy backup',
      UTI: 'public.json',
    });

    // Record backup timestamp for Backup Status display
    try {
      await AsyncStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
      log('Backup date recorded');
    } catch {
      log('WARNING: Failed to record backup date');
    }

    log('Export complete', { filename });
    return { ok: true, filename };

  } catch (err) {
    const error = String(err);
    log('Export FAILED', { error });
    return { ok: false, error };
  }
}
