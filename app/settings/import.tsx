// app/settings/import.tsx
//
// Import Portfolio screen — Settings → Data & Backup → Import Portfolio
// Flow: Choose File → Validate → Preview → Confirm → Restore

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { usePortfolioTransactions } from '../hooks/usePortfolioTransactions';
import { ImportPreview, validateImportPayload } from '../../services/importService';

type ImportState = 'idle' | 'picking' | 'validating' | 'preview' | 'importing' | 'success' | 'error';

const WATCHLIST_KEY = 'watchlist_items';

function log(event: string, data?: unknown) {
  console.log(`[IMPORT] ${event}`, data ?? '');
}

export default function ImportScreen() {
  const router = useRouter();
  const { importTransactions } = usePortfolioTransactions();

  const [state, setState] = useState<ImportState>('idle');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState<string[]>([]);

  function reset() {
    setState('idle');
    setPreview(null);
    setErrorMessage('');
    setErrorDetails([]);
  }

  async function handlePickFile() {
    setState('picking');
    log('File picker opened');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        log('File picker cancelled');
        setState('idle');
        return;
      }

      const file = result.assets[0];
      log('File selected', { name: file.name, uri: file.uri });

      setState('validating');

      // Read file content
      const response = await fetch(file.uri);
      const text = await response.text();

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setState('error');
        setErrorMessage('File is not valid JSON. Please select a myETFspy backup file.');
        return;
      }

      const validation = validateImportPayload(parsed);

      if (!validation.ok) {
        setState('error');
        setErrorMessage(validation.error);
        setErrorDetails(validation.details ?? []);
        log('Validation failed', { error: validation.error });
        return;
      }

      setPreview(validation.preview);
      setState('preview');
      log('Preview ready', {
        transactionCount: validation.preview.transactionCount,
        watchlistCount: validation.preview.watchlistCount,
      });

    } catch (err) {
      setState('error');
      setErrorMessage(`Failed to read file: ${String(err)}`);
      log('File read error', { err: String(err) });
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;

    Alert.alert(
      'Replace Portfolio?',
      `This will permanently replace your current portfolio with ${preview.transactionCount} transaction(s) from the backup dated ${preview.backupDate}.\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace Portfolio',
          style: 'destructive',
          onPress: executeImport,
        },
      ]
    );
  }

  async function executeImport() {
    if (!preview) return;
    setState('importing');
    log('Import started', { transactionCount: preview.transactionCount });

    try {
      // 1. Restore transactions via TransactionStoreProvider (no direct AsyncStorage writes)
      await importTransactions(preview.transactions);
      log('Transactions restored', { count: preview.transactions.length });

      // 2. Restore watchlist directly (same pattern as explore.tsx)
      await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(preview.watchlist));
      log('Watchlist restored', { count: preview.watchlistCount });

      setState('success');
      log('Import complete');

    } catch (err) {
      setState('error');
      setErrorMessage(`Import failed: ${String(err)}`);
      log('Import FAILED', { err: String(err) });
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Portfolio</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* IDLE state */}
        {state === 'idle' && (
          <>
            <View style={styles.card}>
              <View style={styles.iconRow}>
                <Ionicons name="cloud-upload-outline" size={32} color="#338DFF" />
              </View>
              <Text style={styles.cardTitle}>Restore From Backup</Text>
              <Text style={styles.cardDesc}>
                Select a myETFspy backup file to restore your portfolio.
                Your current data will be replaced.
              </Text>
            </View>

            <View style={styles.warningCard}>
              <Ionicons name="warning-outline" size={18} color="#FF9F43" />
              <Text style={styles.warningText}>
                Importing will permanently replace your current portfolio and watchlist.
                Export a backup first if you want to keep your current data.
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handlePickFile} activeOpacity={0.8}>
              <Ionicons name="folder-open-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Choose Backup File</Text>
            </TouchableOpacity>
          </>
        )}

        {/* PICKING / VALIDATING state */}
        {(state === 'picking' || state === 'validating') && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#338DFF" />
            <Text style={styles.loadingText}>
              {state === 'picking' ? 'Opening file picker…' : 'Validating backup file…'}
            </Text>
          </View>
        )}

        {/* PREVIEW state */}
        {state === 'preview' && preview && (
          <>
            <Text style={styles.sectionLabel}>BACKUP DETAILS</Text>
            <View style={styles.card}>
              {[
                { label: 'Backup Date', value: preview.backupDate },
                { label: 'Schema Version', value: String(preview.schemaVersion) },
                { label: 'Transactions', value: String(preview.transactionCount) },
                { label: 'Watchlist Items', value: String(preview.watchlistCount) },
                { label: 'Alerts', value: String(preview.alertCount) },
              ].map((row, i, arr) => (
                <View key={row.label} style={[styles.previewRow, i < arr.length - 1 && styles.rowBorder]}>
                  <Text style={styles.previewLabel}>{row.label}</Text>
                  <Text style={styles.previewValue}>{row.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.warningCard}>
              <Ionicons name="warning-outline" size={18} color="#FF9F43" />
              <Text style={styles.warningText}>
                This will replace your current portfolio with the data above.
              </Text>
            </View>

            <TouchableOpacity style={styles.destructiveButton} onPress={handleConfirmImport} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Replace Portfolio</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={reset}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {/* IMPORTING state */}
        {state === 'importing' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#338DFF" />
            <Text style={styles.loadingText}>Restoring portfolio…</Text>
          </View>
        )}

        {/* SUCCESS state */}
        {state === 'success' && preview && (
          <>
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={40} color="#00C896" />
              <Text style={styles.successTitle}>Portfolio Restored</Text>
              <Text style={styles.successDesc}>
                {preview.transactionCount} transaction(s) and {preview.watchlistCount} watchlist item(s) have been restored successfully.
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ERROR state */}
        {state === 'error' && (
          <>
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={40} color="#FF5A5F" />
              <Text style={styles.errorTitle}>Import Failed</Text>
              <Text style={styles.errorDesc}>{errorMessage}</Text>
            </View>

            {errorDetails.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>DETAILS</Text>
                <View style={styles.card}>
                  {errorDetails.slice(0, 10).map((d, i) => (
                    <Text key={i} style={styles.errorDetailText}>• {d}</Text>
                  ))}
                  {errorDetails.length > 10 && (
                    <Text style={styles.errorDetailText}>…and {errorDetails.length - 10} more</Text>
                  )}
                </View>
              </>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={reset} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 16,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#141A26', borderRadius: 14, marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', padding: 16,
  },
  iconRow: { alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#E8EEF8', textAlign: 'center', marginBottom: 8 },
  cardDesc: { fontSize: 13, color: '#4A6A9A', textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10 },
  warningCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,159,67,0.1)', borderRadius: 10, padding: 12,
    marginBottom: 20, borderWidth: 0.5, borderColor: 'rgba(255,159,67,0.3)',
  },
  warningText: { flex: 1, fontSize: 13, color: '#FF9F43', lineHeight: 18 },
  primaryButton: {
    backgroundColor: '#338DFF', borderRadius: 12, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 12,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  destructiveButton: {
    backgroundColor: '#FF5A5F', borderRadius: 12, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#141A26', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#C8D8F0' },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  previewLabel: { fontSize: 14, color: '#4A6A9A' },
  previewValue: { fontSize: 14, fontWeight: '600', color: '#E8EEF8' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { fontSize: 14, color: '#4A6A9A' },
  successCard: {
    backgroundColor: 'rgba(0,200,150,0.1)', borderRadius: 14, padding: 24,
    alignItems: 'center', marginBottom: 24, borderWidth: 0.5, borderColor: 'rgba(0,200,150,0.3)',
  },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#00C896', marginTop: 12, marginBottom: 8 },
  successDesc: { fontSize: 13, color: '#4A6A9A', textAlign: 'center', lineHeight: 20 },
  errorCard: {
    backgroundColor: 'rgba(255,90,95,0.1)', borderRadius: 14, padding: 24,
    alignItems: 'center', marginBottom: 24, borderWidth: 0.5, borderColor: 'rgba(255,90,95,0.3)',
  },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#FF5A5F', marginTop: 12, marginBottom: 8 },
  errorDesc: { fontSize: 13, color: '#FF5A5F', textAlign: 'center', lineHeight: 20 },
  errorDetailText: { fontSize: 12, color: '#4A6A9A', marginBottom: 4, lineHeight: 18 },
});
