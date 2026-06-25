import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  RefreshControl, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';

const FILTER_TABS = ['All', 'ETF', 'Stock', 'Crypto'];

type Notification = {
  id: string;
  ticker: string;
  assetType: 'ETF' | 'STOCK' | 'CRYPTO';
  alertType: string;
  message: string;
  time: string;
  read: boolean;
};

const ASSET_TYPE_COLOR: Record<string, string> = {
  ETF: '#338DFF',
  STOCK: '#00C896',
  CRYPTO: '#FF9F43',
};

const ALERT_TYPE_ICONS: Record<string, string> = {
  'Price Change': 'trending-up-outline',
  'Holdings Change': 'layers-outline',
  'Dividend Change': 'cash-outline',
  'Yield Change': 'analytics-outline',
  'Earnings Release': 'bar-chart-outline',
  'Volume Spike': 'pulse-outline',
  'New All-Time High': 'trophy-outline',
  'Large Whale Movement': 'fish-outline',
};

// Generate a simulated notification message per alert type
function generateMessage(ticker: string, alertType: string): string {
  const messages: Record<string, string[]> = {
    'Price Change': [
      `${ticker} moved more than 2% today.`,
      `${ticker} is up significantly in today's session.`,
      `${ticker} price crossed a key level.`,
    ],
    'Holdings Change': [
      `${ticker} updated its top holdings.`,
      `${ticker} rebalanced sector exposure.`,
      `${ticker} added new positions this quarter.`,
    ],
    'Dividend Change': [
      `${ticker} declared its latest distribution.`,
      `${ticker} dividend amount has been updated.`,
      `${ticker} ex-dividend date is approaching.`,
    ],
    'Yield Change': [
      `${ticker} yield shifted by more than 0.1%.`,
      `${ticker} trailing yield has been updated.`,
    ],
    'Earnings Release': [
      `${ticker} earnings report is now available.`,
      `${ticker} beat analyst estimates this quarter.`,
    ],
    'Volume Spike': [
      `${ticker} is seeing unusual trading volume.`,
      `${ticker} volume is 3x above average today.`,
    ],
    'New All-Time High': [
      `${ticker} just hit a new all-time high!`,
    ],
    'Large Whale Movement': [
      `Large wallet moved significant ${ticker} holdings.`,
      `On-chain data shows unusual ${ticker} activity.`,
    ],
  };
  const opts = messages[alertType] || [`${ticker} alert triggered.`];
  return opts[Math.floor(Math.random() * opts.length)];
}

// Simulate timestamps spread over last 7 days
function generateTime(index: number): string {
  const now = new Date();
  const minsAgo = index * 47 + Math.floor(Math.random() * 30);
  const d = new Date(now.getTime() - minsAgo * 60 * 1000);
  const diffHours = Math.floor(minsAgo / 60);
  if (diffHours < 1) return `${minsAgo}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  const days = Math.floor(diffHours / 24);
  return `${days}d ago`;
}

const NOTIFICATIONS_KEY = 'alert_notifications';

async function buildNotifications(): Promise<Notification[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const alertKeys = allKeys.filter(k =>
      k.startsWith('alerts_etf_') ||
      k.startsWith('alerts_stock_') ||
      k.startsWith('alerts_crypto_')
    );
    if (alertKeys.length === 0) return [];

    const pairs = await AsyncStorage.multiGet(alertKeys);
    const notifications: Notification[] = [];
    let index = 0;

    for (const [key, value] of pairs) {
      if (!value) continue;
      const alertMap: Record<string, boolean> = JSON.parse(value);
      const ticker = key
        .replace('alerts_etf_', '')
        .replace('alerts_stock_', '')
        .replace('alerts_crypto_', '');
      const assetType: 'ETF' | 'STOCK' | 'CRYPTO' =
        key.startsWith('alerts_etf_') ? 'ETF' :
        key.startsWith('alerts_stock_') ? 'STOCK' : 'CRYPTO';

      for (const [alertType, enabled] of Object.entries(alertMap)) {
        if (!enabled) continue;
        notifications.push({
          id: `${ticker}_${alertType}_${index}`,
          ticker,
          assetType,
          alertType,
          message: generateMessage(ticker, alertType),
          time: generateTime(index),
          read: index > 2, // first 3 are unread
        });
        index++;
      }
    }

    return notifications.sort((a, b) => {
      // Sort by recency (index-based for now)
      const aNum = parseInt(a.id.split('_').pop() || '0');
      const bNum = parseInt(b.id.split('_').pop() || '0');
      return aNum - bNum;
    });
  } catch {
    return [];
  }
}

export default function AlertsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const notifs = await buildNotifications();
    setNotifications(notifs);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  const filtered = activeFilter === 'All'
    ? notifications
    : notifications.filter(n => n.assetType === activeFilter);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>Alerts</Text>
          {unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={s.markAllBtn}>
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            tintColor="#338DFF"
            colors={['#338DFF']}
          />
        }
      >
        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll}>
          <View style={s.filterRow}>
            {FILTER_TABS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[s.filterTab, activeFilter === f && s.filterTabActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[s.filterTabText, activeFilter === f && s.filterTabTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Empty state */}
        {filtered.length === 0 && (
          <View style={s.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={44} color="#2A3A54" />
            <Text style={s.emptyTitle}>No notifications</Text>
            <Text style={s.emptyText}>
              Enable alerts on any asset's detail screen to receive notifications here.
            </Text>
          </View>
        )}

        {/* Notification list */}
        <View style={s.list}>
          {filtered.map((notif) => {
            const accentColor = ASSET_TYPE_COLOR[notif.assetType];
            return (
              <TouchableOpacity
                key={notif.id}
                style={[s.notifRow, !notif.read && s.notifRowUnread]}
                activeOpacity={0.75}
                onPress={() => setNotifications(prev =>
                  prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
                )}
              >
                {/* Unread dot */}
                {!notif.read && <View style={[s.unreadDot, { backgroundColor: accentColor }]} />}

                {/* Icon */}
                <View style={[s.notifIcon, { backgroundColor: accentColor + '22' }]}>
                  <Ionicons
                    name={(ALERT_TYPE_ICONS[notif.alertType] ?? 'notifications-outline') as any}
                    size={18}
                    color={accentColor}
                  />
                </View>

                {/* Content */}
                <View style={s.notifContent}>
                  <View style={s.notifHeader}>
                    <Text style={s.notifTicker}>{notif.ticker}</Text>
                    <View style={[s.typeBadge, { backgroundColor: accentColor + '22' }]}>
                      <Text style={[s.typeBadgeText, { color: accentColor }]}>{notif.assetType}</Text>
                    </View>
                    <Text style={s.notifTime}>{notif.time}</Text>
                  </View>
                  <Text style={s.notifType}>{notif.alertType}</Text>
                  <Text style={s.notifMessage}>{notif.message}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {filtered.length > 0 && (
          <Text style={s.footerNote}>
            Pull to refresh · Tap to mark as read · Enable alerts from asset detail screens
          </Text>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#E8EEF8' },
  unreadBadge: { backgroundColor: '#338DFF', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  unreadBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  markAllBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#141A26', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  markAllText: { fontSize: 12, color: '#4A6080' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  filterScroll: { marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#141A26', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  filterTabActive: { backgroundColor: '#338DFF22', borderColor: '#338DFF' },
  filterTabText: { fontSize: 12, color: '#4A6080', fontWeight: '500' },
  filterTabTextActive: { color: '#338DFF', fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 16, color: '#E8EEF8', fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#4A6080', textAlign: 'center', lineHeight: 20 },
  list: { gap: 10 },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#141A26', borderRadius: 14, padding: 14, gap: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', position: 'relative' },
  notifRowUnread: { borderColor: 'rgba(51,141,255,0.2)', backgroundColor: '#141E30' },
  unreadDot: { position: 'absolute', top: 14, right: 14, width: 7, height: 7, borderRadius: 4 },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifContent: { flex: 1 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  notifTicker: { fontSize: 14, fontWeight: '700', color: '#E8EEF8' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  typeBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  notifTime: { fontSize: 11, color: '#3A5070', marginLeft: 'auto' },
  notifType: { fontSize: 11, color: '#4A6A9A', letterSpacing: 0.5, marginBottom: 4 },
  notifMessage: { fontSize: 13, color: '#C8D8F0', lineHeight: 19 },
  footerNote: { fontSize: 10, color: '#2A3A54', textAlign: 'center', marginTop: 16, lineHeight: 16 },
});
