// components/TransactionRow.tsx
// Shared transaction row UI — used by both the global Transaction History
// screen and the asset-specific "last 3 transactions" section.
// Expandable on tap, with edit/delete actions.

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator, LayoutAnimation, Platform,
  StyleSheet, Text, TouchableOpacity, UIManager, View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type TransactionRowData = {
  transactionId: string;
  ticker: string;
  transactionType: 'BUY' | 'SELL' | 'DIVIDEND' | 'DRIP' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  quantity: number;
  pricePerShare: number;
  fees: number;
  date: string;
  notes: string;
};

type Props = {
  transaction: TransactionRowData;
  showTicker?: boolean; // hide ticker label when already filtered to one asset
  onEdit?: (transaction: TransactionRowData) => void;
  onDelete?: (transactionId: string) => Promise<void>;
};

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  BUY: { color: '#00C896', bg: '#00C89618', icon: 'arrow-down-circle-outline' },
  SELL: { color: '#FF5A5F', bg: '#FF5A5F18', icon: 'arrow-up-circle-outline' },
  DIVIDEND: { color: '#A78BFA', bg: '#A78BFA18', icon: 'cash-outline' },
  DRIP: { color: '#A78BFA', bg: '#A78BFA18', icon: 'repeat-outline' },
  TRANSFER_IN: { color: '#338DFF', bg: '#338DFF18', icon: 'log-in-outline' },
  TRANSFER_OUT: { color: '#FF9F43', bg: '#FF9F4318', icon: 'log-out-outline' },
};

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function TransactionRow({ transaction, showTicker = true, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const config = TYPE_CONFIG[transaction.transactionType] ?? TYPE_CONFIG.BUY;
  const total = transaction.quantity * transaction.pricePerShare;

  function toggleExpand() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(transaction.transactionId);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <TouchableOpacity style={styles.row} onPress={toggleExpand} activeOpacity={0.7}>
      <View style={styles.mainRow}>
        <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={18} color={config.color} />
        </View>

        <View style={styles.mid}>
          <View style={styles.topLine}>
            {showTicker && <Text style={styles.ticker}>{transaction.ticker}</Text>}
            <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.typeBadgeText, { color: config.color }]}>{transaction.transactionType}</Text>
            </View>
          </View>
          <Text style={styles.detail}>
            {transaction.quantity.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares @ ${transaction.pricePerShare.toFixed(2)}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={styles.date}>{formatDate(transaction.date)}</Text>
          <Text style={styles.total}>${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedSection}>
          {transaction.fees > 0 && (
            <View style={styles.expandedRow}>
              <Text style={styles.expandedLabel}>Fees</Text>
              <Text style={styles.expandedValue}>${transaction.fees.toFixed(2)}</Text>
            </View>
          )}
          {transaction.notes ? (
            <View style={styles.expandedRow}>
              <Text style={styles.expandedLabel}>Notes</Text>
              <Text style={styles.expandedValue}>{transaction.notes}</Text>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            {onEdit && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(transaction)}>
                <Ionicons name="create-outline" size={15} color="#338DFF" />
                <Text style={[styles.actionText, { color: '#338DFF' }]}>Edit</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleDelete} disabled={deleting}>
                {deleting ? (
                  <ActivityIndicator size="small" color="#FF5A5F" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={15} color="#FF5A5F" />
                    <Text style={[styles.actionText, { color: '#FF5A5F' }]}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#141A26',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  ticker: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  typeBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  detail: { fontSize: 12, color: '#4A6080' },
  right: { alignItems: 'flex-end' },
  date: { fontSize: 11, color: '#4A6080', marginBottom: 2 },
  total: { fontSize: 13, fontWeight: '600', color: '#C8D8F0', fontVariant: ['tabular-nums'] },
  expandedSection: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    paddingTop: 10,
    gap: 8,
  },
  expandedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  expandedLabel: { fontSize: 11, color: '#4A6080' },
  expandedValue: { fontSize: 12, color: '#C8D8F0', flex: 1, textAlign: 'right' },
  actionRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  actionText: { fontSize: 12, fontWeight: '600' },
});
