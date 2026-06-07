import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const POPULAR_ETFS = [
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF' },
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { ticker: 'VXUS', name: 'Vanguard Total International ETF' },
  { ticker: 'VOO', name: 'Vanguard S&P 500 ETF' },
  { ticker: 'QQQM', name: 'Invesco NASDAQ 100 ETF' },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { ticker: 'JEPI', name: 'JPMorgan Equity Premium Income ETF' },
  { ticker: 'JEPQ', name: 'JPMorgan NASDAQ Equity Premium ETF' },
  { ticker: 'QQQI', name: 'NEOS NASDAQ 100 ETF' },
];

export default function SetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [holdings, setHoldings] = useState<{[key: string]: {qty: string, cost: string}}>({});

  const filtered = POPULAR_ETFS.filter(etf =>
    etf.ticker.toLowerCase().includes(search.toLowerCase()) ||
    etf.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggleETF(ticker: string) {
    if (selected.includes(ticker)) {
      setSelected(selected.filter(t => t !== ticker));
    } else {
      setSelected([...selected, ticker]);
    }
  }

  function updateHolding(ticker: string, field: 'qty' | 'cost', value: string) {
    setHoldings(prev => ({
      ...prev,
      [ticker]: { ...prev[ticker], [field]: value }
    }));
  }

  async function handleFinish() {
    try {
      // Save selected ETF tickers
      await AsyncStorage.setItem('userETFs', JSON.stringify(selected));
      // Save holdings (qty + cost basis)
      await AsyncStorage.setItem('userHoldings', JSON.stringify(holdings));
    } catch (e) {
      console.error('Failed to save ETF data', e);
    }
    router.replace('/(tabs)');
  }

  if (step === 1) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Which ETFs would{'\n'}you like to track?</Text>
        <Text style={styles.subtitle}>Search and select ETFs you want to monitor.</Text>

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

        <Text style={styles.sectionLabel}>Popular ETFs</Text>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.etfGrid}>
            {filtered.map((etf) => (
              <TouchableOpacity
                key={etf.ticker}
                style={[styles.etfChip, selected.includes(etf.ticker) && styles.etfChipSelected]}
                onPress={() => toggleETF(etf.ticker)}
              >
                <Text style={[styles.etfChipText, selected.includes(etf.ticker) && styles.etfChipTextSelected]}>
                  {selected.includes(etf.ticker) ? '✓ ' : ''}{etf.ticker}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {selected.length > 0 && (
            <View style={styles.selectedList}>
              {selected.map((ticker) => (
                <View key={ticker} style={styles.selectedRow}>
                  <Text style={styles.selectedTicker}>{ticker}</Text>
                  <TouchableOpacity onPress={() => toggleETF(ticker)}>
                    <Text style={styles.removeText}>X</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.button, selected.length === 0 && styles.buttonDisabled]}
          onPress={() => selected.length > 0 && setStep(2)}
        >
          <Text style={styles.buttonText}>Continue ({selected.length})</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => setStep(1)}>
        <Text style={styles.backText}>{'<'}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Tell us what you{'\n'}currently own</Text>
      <Text style={styles.subtitle}>This helps us personalize your insights and alerts.</Text>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {selected.map((ticker, i) => (
          <View key={ticker} style={styles.holdingInputRow}>
            <View style={styles.holdingIcon}>
              <Text style={styles.holdingTicker}>{ticker}</Text>
            </View>
            <View style={styles.holdingInputs}>
              <TextInput
                style={styles.input}
                placeholder="Qty"
                placeholderTextColor="#3A5070"
                keyboardType="numeric"
                value={holdings[ticker]?.qty ?? ''}
                onChangeText={(v) => updateHolding(ticker, 'qty', v)}
              />
              <TextInput
                style={styles.input}
                placeholder="Avg Cost (Optional)"
                placeholderTextColor="#3A5070"
                keyboardType="numeric"
                value={holdings[ticker]?.cost ?? ''}
                onChangeText={(v) => updateHolding(ticker, 'cost', v)}
              />
            </View>
            <TouchableOpacity onPress={() => setSelected(selected.filter(t => t !== ticker))}>
              <Text style={styles.removeText}>X</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addMoreButton} onPress={() => setStep(1)}>
          <Text style={styles.addMoreText}>+ Add Another ETF</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity style={styles.button} onPress={handleFinish}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19', padding: 16 },
  back: { marginTop: 60, marginBottom: 16, width: 36 },
  backText: { fontSize: 28, color: '#338DFF' },
  title: { fontSize: 28, fontWeight: '700', color: '#E8EEF8', lineHeight: 38, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#4A6080', marginBottom: 20, lineHeight: 22 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 10, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, height: 44, color: '#E8EEF8', fontSize: 14 },
  sectionLabel: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 12 },
  list: { flex: 1 },
  etfGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  etfChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: '#141A26', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  etfChipSelected: { backgroundColor: 'rgba(51,141,255,0.15)', borderColor: '#338DFF' },
  etfChipText: { fontSize: 13, color: '#4A6080', fontWeight: '500' },
  etfChipTextSelected: { color: '#338DFF' },
  selectedList: { marginTop: 8 },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 10, padding: 12, marginBottom: 6 },
  selectedTicker: { fontSize: 14, color: '#338DFF', fontWeight: '600' },
  removeText: { fontSize: 16, color: '#FF5A5F' },
  button: { backgroundColor: '#338DFF', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12, marginBottom: 16 },
  buttonDisabled: { backgroundColor: '#2A3A54' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  holdingInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#141A26', borderRadius: 12, padding: 12, marginBottom: 10 },
  holdingIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#0D1830', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)' },
  holdingTicker: { fontSize: 10, color: '#338DFF', fontWeight: '600' },
  holdingInputs: { flex: 1, gap: 8, marginHorizontal: 10 },
  input: { backgroundColor: '#0B0F19', borderRadius: 8, padding: 10, color: '#E8EEF8', fontSize: 13, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  addMoreButton: { padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.2)', borderRadius: 10, marginTop: 4 },
  addMoreText: { color: '#338DFF', fontSize: 14, fontWeight: '500' },
});