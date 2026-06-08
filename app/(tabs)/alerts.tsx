import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';

const ALL_ALERTS = [
  { id: 1, ticker: 'SCHD', type: 'Holdings Change', message: 'SCHD increased exposure to Health Care sector.', time: 'May 20, 2024 · 9:30 AM', color: '#338DFF' },
  { id: 2, ticker: 'QQQI', type: 'Dividend Change', message: 'Distribution decreased from $0.45 to $0.42.', time: 'May 18, 2024 · 6:15 PM', color: '#FF9F43' },
  { id: 3, ticker: 'VTI', type: 'Holdings Change', message: 'VTI added 2 new holdings.', time: 'May 18, 2024 · 11:20 AM', color: '#338DFF' },
  { id: 4, ticker: 'JEPI', type: 'Yield Change', message: 'Yield changed from 8.31% to 8.19%.', time: 'May 17, 2024 · 6:45 AM', color: '#FF5A5F' },
];

const FILTER_TABS = ['All', 'Holdings', 'Dividends', 'Price', 'Yield'];

export default function AlertsScreen() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setActiveFilter('All');
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const filtered = activeFilter === 'All'
    ? ALL_ALERTS
    : ALL_ALERTS.filter((a) =>
        a.type.toLowerCase().includes(activeFilter.toLowerCase())
      );

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#338DFF"
          colors={['#338DFF']}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
        <TouchableOpacity style={styles.settingsBtn}>
          <Text style={styles.settingsText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
          {FILTER_TABS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Alert List */}
      <View style={styles.list}>
        {filtered.map((alert) => (
          <View key={alert.id} style={styles.alertRow}>
            <View style={styles.alertLeft}>
              <View style={[styles.alertDot, { backgroundColor: alert.color }]} />
            </View>
            <View style={styles.alertContent}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertTicker}>{alert.ticker}</Text>
                <Text style={styles.alertType}>{alert.type}</Text>
              </View>
              <Text style={styles.alertMessage}>{alert.message}</Text>
              <Text style={styles.alertTime}>{alert.time}</Text>
            </View>
          </View>
        ))}
        {filtered.length === 0 && (
          <Text style={styles.emptyText}>No alerts for this filter.</Text>
        )}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#141A26', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  settingsText: { fontSize: 16 },
  filterScroll: { marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  filterTabActive: { borderColor: '#338DFF', borderBottomWidth: 2 },
  filterTabText: { fontSize: 12, color: '#4A6080', fontWeight: '500' },
  filterTabTextActive: { color: '#338DFF', fontWeight: '700' },
  list: { gap: 8 },
  alertRow: { backgroundColor: '#141A26', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  alertLeft: { paddingTop: 4 },
  alertDot: { width: 10, height: 10, borderRadius: 5 },
  alertContent: { flex: 1 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  alertTicker: { fontSize: 13, color: '#338DFF', fontWeight: '600' },
  alertType: { fontSize: 12, color: '#4A6080' },
  alertMessage: { fontSize: 13, color: '#C8D8F0', lineHeight: 20, marginBottom: 6 },
  alertTime: { fontSize: 11, color: '#3A5070' },
  emptyText: { fontSize: 13, color: '#4A6080', textAlign: 'center', paddingVertical: 20 },
});