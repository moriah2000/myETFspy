import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function DividendsScreen() {
  return (
    <ScrollView style={styles.container}>

      {/* Income Hero */}
      <View style={styles.heroCard}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>ANNUAL</Text>
            <Text style={styles.statValue}>$473</Text>
            <Text style={styles.statSub}>dividend income</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>MONTHLY</Text>
            <Text style={styles.statValue}>$39</Text>
            <Text style={styles.statSub}>avg / month</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>YIELD</Text>
            <Text style={styles.statValue}>3.4%</Text>
            <Text style={styles.statSub}>portfolio yield</Text>
          </View>
        </View>
      </View>

      {/* Upcoming Payments */}
      <Text style={styles.sectionTitle}>UPCOMING PAYMENTS</Text>
      {[
        { month: 'JUN', day: '15', ticker: 'SCHD', name: 'Schwab US Dividend ETF', amount: '+$12.50' },
        { month: 'JUN', day: '28', ticker: 'VTI', name: 'Vanguard Total Market ETF', amount: '+$8.20' },
        { month: 'JUL', day: '06', ticker: 'VXUS', name: 'Vanguard Total Intl ETF', amount: '+$6.80' },
      ].map((item) => (
        <View key={item.ticker} style={styles.paymentRow}>
          <View style={styles.dateBox}>
            <Text style={styles.dateMonth}>{item.month}</Text>
            <Text style={styles.dateDay}>{item.day}</Text>
          </View>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTicker}>{item.ticker}</Text>
            <Text style={styles.paymentName}>{item.name}</Text>
          </View>
          <Text style={styles.paymentAmount}>{item.amount}</Text>
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
  heroCard: {
    backgroundColor: '#141A26',
    borderRadius: 16,
    padding: 20,
    marginTop: 60,
    borderWidth: 0.5,
    borderColor: 'rgba(0,200,150,0.2)',
    marginBottom: 24,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 0.5,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    fontSize: 10,
    color: '#3A5070',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    color: '#00C896',
    fontWeight: '600',
    marginBottom: 2,
  },
  statSub: {
    fontSize: 10,
    color: '#4A6080',
  },
  sectionTitle: {
    fontSize: 11,
    color: '#4A6A9A',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  paymentRow: {
    backgroundColor: '#141A26',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dateBox: {
    alignItems: 'center',
    width: 36,
  },
  dateMonth: {
    fontSize: 9,
    color: '#338DFF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: 22,
    color: '#E8EEF8',
    fontWeight: '500',
    lineHeight: 26,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTicker: {
    fontSize: 13,
    color: '#338DFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentName: {
    fontSize: 11,
    color: '#4A6080',
  },
  paymentAmount: {
    fontSize: 15,
    color: '#00C896',
    fontWeight: '500',
  },
});