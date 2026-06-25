// app/(tabs)/settings.tsx
// DATA & BACKUP section: Export and Import now active. Health + Last Backup coming in Features 3 & 4.

import { useRouter } from 'expo-router';
import { useBackupStatus } from '../../hooks/useBackupStatus';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function SettingsScreen() {
  const router = useRouter();
  const backupStatus = useBackupStatus();
  useFocusEffect(
  useCallback(() => {
    backupStatus.refresh();
  }, [backupStatus.refresh])
);
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <View style={styles.card}>
        {['Profile', 'Subscription', 'Security'].map((item, i) => (
          <TouchableOpacity key={item} style={[styles.menuRow, i < 2 && styles.menuRowBorder]}>
            <Text style={styles.menuText}>{item}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>PREFERENCES</Text>
      <View style={styles.card}>
        {['Notifications', 'Alert Settings', 'Appearance'].map((item, i) => (
          <TouchableOpacity key={item} style={[styles.menuRow, i < 2 && styles.menuRowBorder]}>
            <Text style={styles.menuText}>{item}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── DATA & BACKUP ─────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>DATA & BACKUP</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.menuRow, styles.menuRowBorder]}
          onPress={() => router.push('/settings/export')}>
          <Text style={styles.menuText}>Export Portfolio</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.menuRow, styles.menuRowBorder]}
          onPress={() => router.push('/settings/import')}>
          <Text style={styles.menuText}>Import Portfolio</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.menuRow, styles.menuRowBorder]}
          onPress={() => router.push('/settings/health')}>
          <Text style={styles.menuText}>Portfolio Health</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuRow}
          disabled>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuText, styles.menuTextDisabled]}>Last Backup</Text>
            <Text style={[styles.lastBackupValue, backupStatus.hasBackup && styles.lastBackupValueActive]}>
              {backupStatus.label}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
      {/* ─────────────────────────────────────────────────────────── */}

      <Text style={styles.sectionTitle}>SUPPORT</Text>
      <View style={styles.card}>
        {['Help Center', 'Contact Us', 'About'].map((item, i) => (
          <TouchableOpacity key={item} style={[styles.menuRow, i < 2 && styles.menuRowBorder]}>
            <Text style={styles.menuText}>{item}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.premiumCard}>
        <Text style={styles.premiumTitle}>Upgrade to Premium 👑</Text>
        <Text style={styles.premiumSub}>Unlimited ETF Tracking · Advanced Alerts · Detailed Analytics</Text>
        <TouchableOpacity style={styles.premiumButton}>
          <Text style={styles.premiumButtonText}>Start Free Trial</Text>
        </TouchableOpacity>
        <Text style={styles.premiumPrice}>$9.99 / month</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19', padding: 16 },
  header: { marginTop: 60, marginBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  sectionTitle: { fontSize: 11, color: '#4A6A9A', letterSpacing: 1.5, marginBottom: 10 },
  card: { backgroundColor: '#141A26', borderRadius: 14, marginBottom: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  menuRowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  menuText: { fontSize: 14, color: '#C8D8F0' },
  menuTextDisabled: { color: '#4A6A9A' },
  menuArrow: { fontSize: 18, color: '#4A6080' },
  lastBackupValue: { fontSize: 12, color: '#4A6080', marginTop: 2 },
  lastBackupValueActive: { color: '#00C896' },
  premiumCard: { backgroundColor: '#0D1830', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(51,141,255,0.3)', alignItems: 'center' },
  premiumTitle: { fontSize: 18, fontWeight: '700', color: '#E8EEF8', marginBottom: 8 },
  premiumSub: { fontSize: 12, color: '#4A6080', textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  premiumButton: { backgroundColor: '#338DFF', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10, marginBottom: 8, width: '100%', alignItems: 'center' },
  premiumButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  premiumPrice: { fontSize: 12, color: '#4A6080' },
  logoutButton: { padding: 16, alignItems: 'center', marginBottom: 32 },
  logoutText: { fontSize: 15, color: '#FF5A5F', fontWeight: '500' },
});
