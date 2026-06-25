// services/importService.ts
//
// READ + VALIDATE import service. Never writes directly to AsyncStorage.
// All writes go through TransactionStoreProvider.importTransactions().
// Logging prefix: [IMPORT]

import { Transaction } from '../app/hooks/useTransactionEngine';
import { BACKUP_SCHEMA_VERSION } from '../app/constants/backupSchema';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportPreview = {
  backupDate: string;
  schemaVersion: number;
  transactionCount: number;
  watchlistCount: number;
  alertCount: number;
  transactions: Transaction[];
  watchlist: unknown[];
  preferences: Record<string, unknown>;
};

export type ValidationResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; error: string; details?: string[] };

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(event: string, data?: unknown) {
  console.log(`[IMPORT] ${event}`, data ?? '');
}

// ─── Date validation ──────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(d: unknown): boolean {
  if (typeof d !== 'string') return false;
  if (!DATE_RE.test(d)) return false;
  return !isNaN(Date.parse(d));
}

// ─── Transaction validation ───────────────────────────────────────────────────

function validateTransactions(raw: unknown[]): { valid: Transaction[]; errors: string[] } {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const valid: Transaction[] = [];

  for (let i = 0; i < raw.length; i++) {
    const t = raw[i] as any;
    const prefix = `Transaction[${i}]`;

    if (!t || typeof t !== 'object') {
      errors.push(`${prefix}: not an object`);
      continue;
    }
    if (!t.transactionId || typeof t.transactionId !== 'string' || t.transactionId.trim() === '') {
      errors.push(`${prefix}: empty or missing transactionId`);
      continue;
    }
    if (seenIds.has(t.transactionId)) {
      errors.push(`${prefix}: duplicate transactionId "${t.transactionId}"`);
      continue;
    }
    seenIds.add(t.transactionId);
    if (!t.ticker || typeof t.ticker !== 'string' || t.ticker.trim() === '') {
      errors.push(`${prefix} (${t.transactionId}): empty or missing ticker`);
      continue;
    }
    if (typeof t.quantity !== 'number' || !isFinite(t.quantity)) {
      errors.push(`${prefix} (${t.transactionId}): quantity is not finite (got ${t.quantity})`);
      continue;
    }
    if (typeof t.pricePerShare !== 'number' || !isFinite(t.pricePerShare)) {
      errors.push(`${prefix} (${t.transactionId}): pricePerShare is not finite (got ${t.pricePerShare})`);
      continue;
    }
    if (!t.transactionType || typeof t.transactionType !== 'string') {
      errors.push(`${prefix} (${t.transactionId}): missing transactionType`);
      continue;
    }
    if (!isValidDate(t.date)) {
      errors.push(`${prefix} (${t.transactionId}): malformed date "${t.date}" (expected YYYY-MM-DD)`);
      continue;
    }
    valid.push(t as Transaction);
  }

  return { valid, errors };
}

// ─── Main validation ──────────────────────────────────────────────────────────

export function validateImportPayload(raw: unknown): ValidationResult {
  log('Validation started');

  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'File is not a valid JSON object' };
  }

  const payload = raw as any;

  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version: ${payload.schemaVersion}. Expected version ${BACKUP_SCHEMA_VERSION}.`,
    };
  }
  if (!payload.exportTimestamp || typeof payload.exportTimestamp !== 'string') {
    return { ok: false, error: 'Missing or invalid exportTimestamp' };
  }
  if (!Array.isArray(payload.transactions)) {
    return { ok: false, error: 'transactions field is missing or not an array' };
  }
  if (!Array.isArray(payload.watchlist)) {
    return { ok: false, error: 'watchlist field is missing or not an array' };
  }

  const { valid, errors } = validateTransactions(payload.transactions);

  if (errors.length > 0) {
    log('Validation failed', { errors });
    return { ok: false, error: `${errors.length} transaction(s) failed validation.`, details: errors };
  }

  let backupDate = 'Unknown';
  try {
    const d = new Date(payload.exportTimestamp);
    backupDate = d.toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    backupDate = payload.exportTimestamp;
  }

  const preview: ImportPreview = {
    backupDate,
    schemaVersion: payload.schemaVersion,
    transactionCount: valid.length,
    watchlistCount: payload.watchlist.length,
    alertCount: Array.isArray(payload.alerts) ? payload.alerts.length : 0,
    transactions: valid,
    watchlist: payload.watchlist,
    preferences: payload.preferences ?? {},
  };

  log('Validation passed', {
    transactionCount: preview.transactionCount,
    watchlistCount: preview.watchlistCount,
  });

  return { ok: true, preview };
}
