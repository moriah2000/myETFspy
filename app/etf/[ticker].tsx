import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getETFDividends, getETFPrice } from '../services/api';

const TABS = ['Overview', 'Holdings', 'Dividends', 'Alerts'];

const HOLDINGS = [
  { ticker: 'MSFT', name: 'Microsoft Corp.', weight: '4.20%' },
  { ticker: 'AAPL', name: 'Apple Inc.', weight: '4.18%' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', weight: '4.17%' },
  { ticker: 'AVGO', name: 'Broadcom Inc.', weight: '4.06%' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', weight: '3.74%' },
  { ticker: 'META', name: 'Meta Platforms Inc.', weight: '2.80%' },
  { ticker: 'GOOGL', name: 'Alphabet Inc. Class A', weight: '2.45%' },
  { ticker: 'LLY', name: 'Eli Lilly and Co.', weight: '2.27%' },
];

const ETF_NAMES: {[key: string]: string} = {
  SCHD: 'Schwab US Dividend Equity ETF',
  VTI: 'Vanguard Total Stock Market ETF',
  QQQM: 'Invesco NASDAQ 100 ETF',
  JEPI: 'JPMorgan Equity Premium Income ETF',
  SPY: 'SPDR S&P 500 ETF Trust',
  VOO: 'Vanguard S&P 500 ETF',
  VXUS: 'Vanguard Total International ETF',
};

export default function ETFDetailScreen() {
  const { ticker } = useLocalSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Overview');
  const [price, setPrice] = useState<any>(null);
  const [dividends, setDividends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [priceData, dividendsData] = await Promise.all([
          getETFPrice(ticker as string),
          getETFDividends(ticker as string),
        ]);
        setPrice(priceData);
        setDividends(dividendsData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [ticker]);

  const etfName = ETF_NAMES[ticker as string] ?? (ticker + ' ETF');

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTicker}>{ticker}</Text>
        <TouchableOpacity style={styles.starButton}>
          <Text style={styles.starText}>☆</Text>
        </TouchableOpacity>
      </View>

      {/* Price Hero */}
      <View style={styles.priceHero}>
        <Text style={styles.etfName}>{etfName}</Text>
        {loading ? (
          <ActivityIndicator color="#338DFF" size="small" style={{ marginVertical: 10 }} />
        ) : (
          <>
            <Text style={styles.price}>${price?.price?.toFixed(2) ?? '—'}</Text>
            <Text style={[styles.change, { color: (price?.change ?? 0) >= 0 ? '#00C896' : '#FF5A5F' }]}>
              {(price?.change ?? 0) >= 0 ? '+' : ''}{price?.change?.toFixed(2) ?? '—'} ({price?.changesPercentage?.toFixed(2) ?? '—'}%) Today
            </Text>
          </>
        )}
      </View>

      {/* Sub Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>

        {/* OVERVIEW TAB */}
        {activeTab === 'Overview' && (
          <View>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Dividend Yield</Text>
                <Text style={styles.statValue}>3.65%</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Expense Ratio</Text>
                <Text style={styles.statValue}>0.06%</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>AUM</Text>
                <Text style={styles.statValue}>$56.34B</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Inception Date</Text>
                <Text style={styles.statValue}>10/20/2011</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>52W High</Text>
                <Text style={styles.statValue}>${price?.yearHigh?.toFixed(2) ?? '—'}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>52W Low</Text>
                <Text style={styles.statValue}>${price?.yearLow?.toFixed(2) ?? '—'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* HOLDINGS TAB */}
        {activeTab === 'Holdings' && (
          <View>
            <Text style={styles.sectionLabel}>Top Holdings as of 05/15/2024</Text>
            {HOLDINGS.map((item) => (
              <View key={item.ticker} style={styles.holdingRow}>
                <View style={styles.holdingIcon}>
                  <Text style={styles.holdingTicker}>{item.ticker}</Text>
                </View>
                <Text style={styles.holdingName}>{item.name}</Text>
                <Text style={styles.holdingWeight}>{item.weight}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.viewAllButton}>
              <Text style={styles.viewAllText}>View All Holdings</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DIVIDENDS TAB */}
        {activeTab === 'Dividends' && (
          <View>
            <View style={styles.divHero}>
              <View style={styles.divStat}>
                <Text style={styles.divStatLabel}>Dividend Yield</Text>
                <Text style={styles.divStatValue}>3.65%</Text>
              </View>
              <View style={styles.divDivider} />
              <View style={styles.divStat}>
                <Text style={styles.divStatLabel}>Distribution</Text>
                <Text style={styles.divStatValue}>Quarterly</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Upcoming Dividend</Text>
            <View style={styles.upcomingCard}>
              <View style={styles.upcomingRow}>
                <Text style={styles.upcomingLabel}>Ex-Dividend Date</Text>
                <Text style={styles.upcomingValue}>May 24, 2024</Text>
              </View>
              <View style={styles.upcomingRow}>
                <Text style={styles.upcomingLabel}>Pay Date</Text>
                <Text style={styles.upcomingValue}>May 28, 2024</Text>
              </View>
              <View style={styles.upcomingRow}>
                <Text style={styles.upcomingLabel}>Amount</Text>
                <Text style={[styles.upcomingValue, { color: '#00C896' }]}>$0.1930</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Dividend History</Text>
            {loading ? (
              <ActivityIndicator color="#338DFF" />
            ) : dividends.length === 0 ? (
              <Text style={{ color: '#4A6080', fontSize: 13 }}>No dividend data available.</Text>
            ) : (
              dividends.map((d: any, i: number) => (
                <View key={i} style={[styles.upcomingCard, { marginBottom: 8 }]}>
                  <View style={styles.upcomingRow}>
                    <Text style={styles.upcomingLabel}>{d.date}</Text>
                    <Text style={[styles.upcomingValue, { color: '#00C896' }]}>${d.amount}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ALERTS TAB */}
        {activeTab === 'Alerts' && (
          <View>
            <Text style={styles.sectionLabel}>Set alerts for {ticker}</Text>
            {['Holdings Change', 'Dividend Change', 'Price Change', 'Yield Change'].map((alert) => (
              <View key={alert} style={styles.alertRow}>
                <Text style={styles.alertText}>{alert}</Text>
                <View style={styles.alertToggle}>
                  <Text style={styles.alertToggleText}>Off</Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: '#338DFF', lineHeight: 32 },
  headerTicker: { fontSize: 18, fontWeight: '700', color: '#E8EEF8' },
  starButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  starText: { fontSize: 22, color: '#FF9F43' },
  priceHero: { paddingHorizontal: 16, paddingBottom: 16 },
  etfName: { fontSize: 13, color: '#4A6080', marginBottom: 6 },
  price: { fontSize: 36, fontWeight: '700', color: '#E8EEF8', marginBottom: 4 },
  change: { fontSize: 14, fontWeight: '500' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16 },
  tab: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 8 },
  tabActive: { borderBottomColor: '#338DFF' },
  tabText: { fontSize: 13, color: '#4A6080', fontWeight: '500' },
  tabTextActive: { color: '#338DFF' },
  content: { flex: 1, padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  statCard: { width: '47.5%', backgroundColor: '#141A26', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  statLabel: { fontSize: 10, color: '#3A5070', letterSpacing: 0.8, marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: '500', color: '#E8EEF8' },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 12, marginTop: 4 },
  holdingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 10, padding: 12, marginBottom: 8, gap: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  holdingIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#0D1830', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)' },
  holdingTicker: { fontSize: 9, color: '#338DFF', fontWeight: '600' },
  holdingName: { flex: 1, fontSize: 13, color: '#C8D8F0' },
  holdingWeight: { fontSize: 13, color: '#E8EEF8', fontWeight: '500' },
  viewAllButton: { backgroundColor: 'rgba(51,141,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8, borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)' },
  viewAllText: { color: '#338DFF', fontSize: 14, fontWeight: '500' },
  divHero: { flexDirection: 'row', backgroundColor: '#141A26', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: 'rgba(0,200,150,0.2)' },
  divStat: { flex: 1, alignItems: 'center' },
  divDivider: { width: 0.5, backgroundColor: 'rgba(255,255,255,0.06)' },
  divStatLabel: { fontSize: 10, color: '#3A5070', letterSpacing: 0.8, marginBottom: 6 },
  divStatValue: { fontSize: 20, fontWeight: '600', color: '#00C896' },
  upcomingCard: { backgroundColor: '#141A26', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 16 },
  upcomingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  upcomingLabel: { fontSize: 13, color: '#4A6080' },
  upcomingValue: { fontSize: 13, color: '#E8EEF8', fontWeight: '500' },
  alertRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  alertText: { fontSize: 14, color: '#C8D8F0' },
  alertToggle: { backgroundColor: '#2A3A54', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  alertToggleText: { fontSize: 12, color: '#4A6080', fontWeight: '500' },
});