import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ALERTS = [
  {
    id: 1,
    ticker: 'SCHD',
    type: 'Holdings Change',
    message: 'SCHD increased exposure to Health Care sector.',
    time: 'May 20, 2024 · 9:30 AM',
    color: '#338DFF',
    dot: '🔵',
  },
  {
    id: 2,
    ticker: 'QQQI',
    type: 'Dividend Change',
    message: 'Distribution decreased from $0.45 to $0.42.',
    time: 'May 18, 2024 · 6:15 PM',
    color: '#FF9F43',
    dot: '🟡',
  },
  {
    id: 3,
    ticker: 'VTI',
    type: 'Holdings Change',
    message: 'VTI added 2 new holdings.',
    time: 'May 18, 2024 · 11:20 AM',
    color: '#338DFF',
    dot: '🔵',
  },
  {
    id: 4,
    ticker: 'JEPI',
    type: 'Yield Change',
    message: 'Yield changed from 8.31% to 8.19%.',
    time: 'May 17, 2024 · 6:45 AM',
    color: '#FF5A5F',
    dot: '🔴',
  },
];

const FILTER_TABS = ['All', 'Holdings', 'Dividends', 'Price', 'Yield'];

export default function AlertsScreen() {
  return (
    <ScrollView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Text style={styles.settingsText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}>
        <View style={styles.filterRow}>
          {FILTER_TABS.map((f, i) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, i === 0 && styles.filterTabActive]}>
              <Text style={[styles.filterTabText, i === 0 && styles.filterTabTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Alert List */}
      {ALERTS.map((alert) => (
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E8EEF8',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141A26',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  settingsText: {
    fontSize: 16,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#141A26',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterTabActive: {
    backgroundColor: '#338DFF',
    borderColor: '#338DFF',
  },
  filterTabText: {
    fontSize: 12,
    color: '#4A6080',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  alertRow: {
    backgroundColor: '#141A26',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  alertLeft: {
    paddingTop: 4,
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  alertContent: {
    flex: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  alertTicker: {
    fontSize: 13,
    color: '#338DFF',
    fontWeight: '600',
  },
  alertType: {
    fontSize: 12,
    color: '#4A6080',
  },
  alertMessage: {
    fontSize: 13,
    color: '#C8D8F0',
    lineHeight: 20,
    marginBottom: 6,
  },
  alertTime: {
    fontSize: 11,
    color: '#3A5070',
  },
});