import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getETFPrice } from '../services/api';

const INITIAL_WATCHLIST = [
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF', yield: '3.65%' },
  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF', yield: '0.64%' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', yield: '1.52%' },
  { ticker: 'JEPI', name: 'JPMorgan Equity Premium Income ETF', yield: '6.19%' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', yield: '1.28%' },
];

const SEARCHABLE_ETFS = [
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF', yield: '3.65%' },
  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF', yield: '0.64%' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', yield: '1.52%' },
  { ticker: 'JEPI', name: 'JPMorgan Equity Premium Income ETF', yield: '6.19%' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', yield: '1.28%' },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', yield: '1.32%' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', yield: '0.58%' },
  { ticker: 'VXUS', name: 'Vanguard Total International ETF', yield: '3.10%' },
  { ticker: 'BND', name: 'Vanguard Total Bond Market ETF', yield: '3.80%' },
  { ticker: 'DGRO', name: 'iShares Core Dividend Growth ETF', yield: '2.20%' },
  { ticker: 'VYM', name: 'Vanguard High Dividend Yield ETF', yield: '3.20%' },
  { ticker: 'JEPQ', name: 'JPMorgan NASDAQ Equity Premium ETF', yield: '9.50%' },
  { ticker: 'QQQI', name: 'NEOS NASDAQ 100 ETF', yield: '11.20%' },
  { ticker: 'IVV', name: 'iShares Core S&P 500 ETF', yield: '1.30%' },
  { ticker: 'AGG', name: 'iShares Core US Aggregate Bond ETF', yield: '3.50%' },
  { ticker: 'VGT', name: 'Vanguard Information Technology ETF', yield: '0.65%' },
  { ticker: 'ARKK', name: 'ARK Innovation ETF', yield: '0.00%' },
  { ticker: 'GLD', name: 'SPDR Gold Shares', yield: '0.00%' },
  { ticker: 'XLE', name: 'Energy Select Sector SPDR Fund', yield: '3.80%' },
  { ticker: 'VNQ', name: 'Vanguard Real Estate ETF', yield: '4.10%' },
];

export default function WatchlistScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [watchlist, setWatchlist] = useState(INITIAL_WATCHLIST);
  const [prices, setPrices] = useState<{[key: string]: any}>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  useEffect(() => {
    loadPrices(watchlist.map(e => e.ticker));
  }, [watchlist]);

  async function loadPrices(tickers: string[]) {
    setLoading(true);
    try {
      const results = await Promise.all(tickers.map(t => getETFPrice(t)));
      const priceMap: {[key: string]: any} = {};
      tickers.forEach((t, i) => { priceMap[t] = results[i]; });
      setPrices(prev => ({ ...prev, ...priceMap }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function addETF(etf: typeof SEARCHABLE_ETFS[0]) {
    if (!watchlist.find(e => e.ticker === etf.ticker)) {
      setWatchlist([...watchlist, etf]);
    }
    setShowModal(false);
    setModalSearch('');
  }

  function removeETF(ticker: string) {
    setWatchlist(watchlist.filter(e => e.ticker !== ticker));
  }

  function goToETF(ticker: string) {
    router.push({pathname: '/etf/[ticker]', params: {ticker: ticker}});
  }

  const filtered = watchlist.filter(etf =>
    etf.ticker.toLowerCase().includes(search.toLowerCase()) ||
    etf.name.toLowerCase().includes(search.toLowerCase())
  );

  const modalResults = SEARCHABLE_ETFS.filter(etf =>
    etf.ticker.toLowerCase().includes(modalSearch.toLowerCase()) ||
    etf.name.toLowerCase().includes(modalSearch.toLowerCase())
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Watchlist</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Filter watchlist..."
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

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#338DFF" size="large" />
            <Text style={styles.loadingText}>Loading prices...</Text>
          </View>
        ) : (
          filtered.map((etf) => {
            const price = prices[etf.ticker];
            const change = price?.changesPercentage ?? 0;
            const isPositive = change >= 0;
            return (
              <TouchableOpacity
                key={etf.ticker}
                style={styles.etfRow}
                onPress={() => goToETF(etf.ticker)}>
                <View style={styles.etfIcon}>
                  <Text style={styles.etfTicker}>{etf.ticker}</Text>
                </View>
                <View style={styles.etfInfo}>
                  <Text style={styles.etfName} numberOfLines={1}>{etf.name}</Text>
                  <Text style={styles.etfYield}>Yield {etf.yield}</Text>
                </View>
                <View style={styles.etfRight}>
                  <Text style={[styles.etfChange, { color: isPositive ? '#00C896' : '#FF5A5F' }]}>
                    {isPositive ? '+' : ''}{change.toFixed(2)}%
                  </Text>
                  <Text style={styles.etfPrice}>
                    ${price?.price?.toFixed(2) ?? '—'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeETF(etf.ticker)} style={styles.removeBtn}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add ETF Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add ETF</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search ETFs..."
                placeholderTextColor="#3A5070"
                value={modalSearch}
                onChangeText={setModalSearch}
                autoFocus
              />
            </View>

            <ScrollView>
              {modalResults.map((etf) => {
                const alreadyAdded = watchlist.some(e => e.ticker === etf.ticker);
                return (
                  <TouchableOpacity
                    key={etf.ticker}
                    style={styles.modalRow}
                    onPress={() => !alreadyAdded && addETF(etf)}
                    disabled={alreadyAdded}>
                    <View style={styles.etfIcon}>
                      <Text style={styles.etfTicker}>{etf.ticker}</Text>
                    </View>
                    <View style={styles.etfInfo}>
                      <Text style={styles.etfName} numberOfLines={1}>{etf.name}</Text>
                      <Text style={styles.etfYield}>Yield {etf.yield}</Text>
                    </View>
                    <Text style={[styles.addText, alreadyAdded && styles.addedText]}>
                      {alreadyAdded ? '✓ Added' : '+ Add'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#0B0F19' },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 60, marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  addButton: { backgroundColor: '#338DFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 10, paddingHorizontal: 12, marginBottom: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, height: 44, color: '#E8EEF8', fontSize: 14 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#141A26', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  filterTabActive: { backgroundColor: '#338DFF', borderColor: '#338DFF' },
  filterTabText: { fontSize: 12, color: '#4A6080', fontWeight: '500' },
  filterTabTextActive: { color: '#FFFFFF' },
  loadingContainer: { alignItems: 'center', paddingTop: 60, gap: 12 },
  loadingText: { color: '#4A6080', fontSize: 14 },
  etfRow: { backgroundColor: '#141A26', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  etfIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#0D1830', borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  etfTicker: { fontSize: 10, color: '#338DFF', fontWeight: '600' },
  etfInfo: { flex: 1 },
  etfName: { fontSize: 13, color: '#C8D8F0', fontWeight: '500', marginBottom: 4 },
  etfYield: { fontSize: 11, color: '#4A6080' },
  etfRight: { alignItems: 'flex-end' },
  etfChange: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  etfPrice: { fontSize: 13, color: '#E8EEF8', fontWeight: '500' },
  removeBtn: { padding: 4 },
  removeText: { fontSize: 14, color: '#FF5A5F' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#141A26', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  modalClose: { fontSize: 18, color: '#4A6080' },
  modalRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 8, backgroundColor: '#0B0F19', gap: 12 },
  addText: { fontSize: 13, color: '#338DFF', fontWeight: '600' },
  addedText: { color: '#4A6080' },
});