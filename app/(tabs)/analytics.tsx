// app/(tabs)/analytics.tsx
//
// Analytics tab — entry point for all Phase 3 analytics features.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AnalyticsItem = {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  available: boolean;
  badge?: string;
};

const ANALYTICS_ITEMS: AnalyticsItem[] = [
  {
    title: 'Dividend Intelligence',
    subtitle: 'Income, yield, calendar & forecasts',
    icon: 'cash-outline',
    route: '/analytics/dividends',
    available: true,
    badge: 'New',
  },
  {
    title: 'Asset & Sector Allocation',
    subtitle: 'ETF, Stock, Sector & Geographic breakdown',
    icon: 'pie-chart-outline',
    route: '/analytics/allocation',
    available: true,
    badge: 'New',
  },
  {
    title: 'Portfolio Insights',
    subtitle: 'Top holdings, diversification & risk',
    icon: 'bulb-outline',
    route: '/analytics/insights',
    available: true,
    badge: 'New',
  },
  {
    title: 'Growth Forecast',
    subtitle: 'Project portfolio & dividend income growth',
    icon: 'trending-up-outline',
    route: '/analytics/forecast',
    available: true,
    badge: 'New',
  },
  {
    title: 'FIRE Projection',
    subtitle: 'Financial independence calculator',
    icon: 'flame-outline',
    route: '/analytics/fire',
    available: true,
    badge: 'New',
  },

];

export default function AnalyticsTab() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>INVESTOR INTELLIGENCE</Text>

        <View style={styles.card}>
          {ANALYTICS_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.route}
              style={[styles.row, i < ANALYTICS_ITEMS.length - 1 && styles.rowBorder]}
              onPress={() => item.available && router.push(item.route as any)}
              activeOpacity={item.available ? 0.7 : 1}
              disabled={!item.available}>
              <View style={[styles.iconBox, !item.available && styles.iconBoxDisabled]}>
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.available ? '#338DFF' : '#2A3A54'}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, !item.available && styles.rowTitleDisabled]}>
                  {item.title}
                </Text>
                <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
              </View>
              <View style={styles.rowRight}>
                {item.badge && (
                  <View style={[styles.badge, item.available ? styles.badgeNew : styles.badgeSoon]}>
                    <Text style={[styles.badgeText, item.available ? styles.badgeTextNew : styles.badgeTextSoon]}>
                      {item.badge}
                    </Text>
                  </View>
                )}
                {item.available && (
                  <Ionicons name="chevron-forward" size={16} color="#4A6080" style={{ marginLeft: 6 }} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10 },
  card: {
    backgroundColor: '#141A26', borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  iconBox: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(51,141,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBoxDisabled: { backgroundColor: 'rgba(42,58,84,0.3)' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#E8EEF8', marginBottom: 2 },
  rowTitleDisabled: { color: '#4A6A9A' },
  rowSubtitle: { fontSize: 12, color: '#4A6080' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  badgeNew: { backgroundColor: 'rgba(51,141,255,0.15)' },
  badgeSoon: { backgroundColor: 'rgba(42,58,84,0.5)' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextNew: { color: '#338DFF' },
  badgeTextSoon: { color: '#4A6080' },
});
