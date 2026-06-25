// app/settings/export.tsx
//
// Export Portfolio screen — Settings → Data & Backup → Export Portfolio
// Read-only. Calls exportService.ts which never mutates any store.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { exportPortfolio } from '../../services/exportService';

type ExportState = 'idle' | 'loading' | 'success' | 'error';

export default function ExportScreen() {
  const router = useRouter();
  const [state, setState] = useState<ExportState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successFilename, setSuccessFilename] = useState('');

  async function handleExport() {
    setState('loading');
    setErrorMessage('');
    setSuccessFilename('');

    const result = await exportPortfolio();

    if (result.ok) {
      setSuccessFilename(result.filename);
      setState('success');
    } else {
      setErrorMessage(result.error);
      setState('error');
    }
  }

  function handleReset() {
    setState('idle');
    setErrorMessage('');
    setSuccessFilename('');
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export Portfolio</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>

        {/* Description card */}
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="cloud-download-outline" size={32} color="#338DFF" />
          </View>
          <Text style={styles.cardTitle}>Backup Your Portfolio</Text>
          <Text style={styles.cardDesc}>
            Creates a complete backup of your transactions, watchlist, and
            preferences. Save it to your device or share it anywhere.
          </Text>
        </View>

        {/* What's included */}
        <Text style={styles.sectionLabel}>WHAT'S INCLUDED</Text>
        <View style={styles.card}>
          {[
            { icon: 'swap-horizontal-outline', label: 'All Transactions' },
            { icon: 'eye-outline', label: 'Watchlist' },
            { icon: 'options-outline', label: 'App Preferences' },
          ].map((item, i, arr) => (
            <View
              key={item.label}
              style={[styles.includeRow, i < arr.length - 1 && styles.rowBorder]}>
              <Ionicons name={item.icon as any} size={18} color="#338DFF" />
              <Text style={styles.includeText}>{item.label}</Text>
              <Ionicons name="checkmark" size={16} color="#00C896" />
            </View>
          ))}
        </View>

        {/* Filename preview */}
        <Text style={styles.sectionLabel}>OUTPUT FILE</Text>
        <View style={styles.filenameCard}>
          <Ionicons name="document-text-outline" size={16} color="#4A6A9A" />
          <Text style={styles.filenameText}>
            {`myETFspy-backup-${todayDisplay()}.json`}
          </Text>
        </View>

        {/* State feedback */}
        {state === 'success' && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#00C896" />
            <Text style={styles.successText}>
              Export complete — {successFilename}
            </Text>
          </View>
        )}

        {state === 'error' && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#FF5A5F" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Action button */}
        {state === 'loading' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#338DFF" />
            <Text style={styles.loadingText}>Preparing export…</Text>
          </View>
        ) : state === 'success' ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
            <Text style={styles.secondaryButtonText}>Export Again</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.exportButton, state === 'error' && styles.exportButtonError]}
            onPress={handleExport}
            activeOpacity={0.8}>
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            <Text style={styles.exportButtonText}>
              {state === 'error' ? 'Retry Export' : 'Export & Share'}
            </Text>
          </TouchableOpacity>
        )}

      </View>
    </View>
  );
}

function todayDisplay(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E8EEF8',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#141A26',
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    padding: 16,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E8EEF8',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: '#4A6A9A',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 11,
    color: '#4A6A9A',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  includeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  includeText: {
    flex: 1,
    fontSize: 14,
    color: '#C8D8F0',
  },
  filenameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141A26',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filenameText: {
    fontSize: 13,
    color: '#4A6A9A',
    fontFamily: 'monospace',
  },
  exportButton: {
    backgroundColor: '#338DFF',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportButtonError: {
    backgroundColor: '#FF5A5F',
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#141A26',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C8D8F0',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#4A6A9A',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,200,150,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,200,150,0.3)',
  },
  successText: {
    fontSize: 13,
    color: '#00C896',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,90,95,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,90,95,0.3)',
  },
  errorText: {
    fontSize: 13,
    color: '#FF5A5F',
    flex: 1,
  },
});
