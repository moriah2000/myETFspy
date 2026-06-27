// app/analytics/allocation.tsx
//
// Allocation screen — Asset, Sector, Geographic

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { AllocationSlice, usePortfolioAnalytics } from '../../hooks/usePortfolioAnalytics';

const SLICE_COLORS = [
  '#338DFF', '#00C896', '#FF9F43', '#FF5A5F', '#A855F7',
  '#06B6D4', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6',
  '#EC4899', '#6366F1',
];

function formatCurrency(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function AllocationSection({
  title, slices, emptyMessage,
}: {
  title: string;
  slices: AllocationSlice[];
  emptyMessage: string;
}) {
  if (slices.length === 0) {
    return (
      <View style={styles.emptySection}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.card}>
        {slices.map((slice, i) => (
          <View key={slice.label}
            style={[styles.sliceRow, i < slices.length - 1 && styles.rowBorder]}>
            <View style={[styles.colorDot, { backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }]} />
            <Text style={styles.sliceLabel}>{slice.label}</Text>
            <View style={styles.sliceRight}>
              <Text style={styles.sliceWeight}>{slice.weight.toFixed(1)}%</Text>
              <Text style={styles.sliceValue}>{formatCurrency(slice.value)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Bar chart */}
      <View style={styles.barContainer}>
        {slices.map((slice, i) => (
          <View
            key={slice.label}
            style={[
              styles.barSegment,
              {
                flex: slice.weight,
                backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length],
              },
            ]}
          />
        ))}
      </View>
    </>
  );
}

export default function AllocationScreen() {
  const router = useRouter();
  const { assetAllocation, sectorAllocation, geographicAllocation, loading, error } =
    usePortfolioAnalytics();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#C8D8F0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Allocation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#338DFF" />
            <Text style={styles.loadingText}>Analysing portfolio…</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#FF5A5F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && (
          <>
            <AllocationSection
              title="ASSET ALLOCATION"
              slices={assetAllocation}
              emptyMessage="No positions found."
            />
            <AllocationSection
              title="SECTOR ALLOCATION"
              slices={sectorAllocation}
              emptyMessage="No sector data available."
            />
            <AllocationSection
              title="GEOGRAPHIC ALLOCATION"
              slices={geographicAllocation}
              emptyMessage="No geographic data available."
            />
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
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  loadingText: { fontSize: 14, color: '#4A6A9A' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,90,95,0.1)', borderRadius: 10, padding: 12,
    marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(255,90,95,0.3)',
  },
  errorText: { fontSize: 13, color: '#FF5A5F', flex: 1 },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10 },
  card: {
    backgroundColor: '#141A26', borderRadius: 14, marginBottom: 10,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  sliceRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  sliceLabel: { flex: 1, fontSize: 14, color: '#C8D8F0' },
  sliceRight: { alignItems: 'flex-end' },
  sliceWeight: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  sliceValue: { fontSize: 12, color: '#4A6A9A', marginTop: 2 },
  barContainer: {
    flexDirection: 'row', height: 8, borderRadius: 4,
    overflow: 'hidden', marginBottom: 24,
  },
  barSegment: { height: 8 },
  emptySection: {
    backgroundColor: '#141A26', borderRadius: 14, padding: 20,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: { fontSize: 13, color: '#4A6A9A' },
});
