import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const DEFAULT_WATCHLIST = [
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF', yield: '3.65%' },
  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF', yield: '0.64%' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', yield: '1.52%' },
  { ticker: 'JEPI', name: 'JPMorgan Equity Premium Income ETF', yield: '6.19%' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', yield: '1.28%' },
];

export default function WatchlistScreen() {
  const [search, setSearch] = useState('');
  const [watchlist] = useState(DEFAULT_WATCHLIST);

  const filtered = watchlist.filter(etf =>
    etf.ticker.toLowerCase().includes(search.toLowerCase()) ||
    etf.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Watchlist</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search ETFs..."
          placeholderTextColor="#3A5070"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {['All ETFs', 'Dividend', 'Growth', 'Bond'].map((f, i) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, i === 0 && styles.filterTabActive]}>
            <Text style={[styles.filterTabText, i === 0 && styles.filterTabTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.map((etf) => (
        <TouchableOpacity key={etf.ticker} style={styles.etfRow}>
          <View style={styles.etfIcon}>
            <Text style={styles.etfTicker}>{etf.ticker}</Text>
          </View>
          <View style={styles.etfInfo}>
            <Text style={styles.etfName} numberOfLines={1}>{etf.name}</Text>
            <Text style={styles.etfYield}>Yield {etf.yield}</Text>
          </View>
          <View style={styles.etfRight}>
            <Text style={styles.etfChange}>+1.32%</Text>
            <Text style={styles.etfPrice}>$78.93</Text>
          </View>
        </TouchableOpacity>
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
  addButton: {
    backgroundColor: '#338DFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141A26',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#E8EEF8',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 14,
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
  etfRow: {
    backgroundColor: '#141A26',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  etfIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0D1830',
    borderWidth: 0.5,
    borderColor: 'rgba(51,141,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  etfTicker: {
    fontSize: 10,
    color: '#338DFF',
    fontWeight: '600',
  },
  etfInfo: {
    flex: 1,
  },
  etfName: {
    fontSize: 13,
    color: '#C8D8F0',
    fontWeight: '500',
    marginBottom: 4,
  },
  etfYield: {
    fontSize: 11,
    color: '#4A6080',
  },
  etfRight: {
    alignItems: 'flex-end',
  },
  etfChange: {
    fontSize: 13,
    color: '#00C896',
    fontWeight: '500',
    marginBottom: 2,
  },
  etfPrice: {
    fontSize: 13,
    color: '#E8EEF8',
    fontWeight: '500',
  },
});