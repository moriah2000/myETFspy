import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const done = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (done === 'true') {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding');
        }
      } catch (e) {
        console.error('Failed to check onboarding status:', e);
        router.replace('/onboarding');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>
          my<Text style={styles.logoAccent}>ETF</Text>spy
        </Text>
        <Text style={styles.tagline}>Track. Detect. Profit.</Text>
      </View>
      <Text style={styles.subtitle}>
        Real-time ETF intelligence{'\n'}in your pocket.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#E8EEF8',
    letterSpacing: -1,
  },
  logoAccent: {
    color: '#338DFF',
  },
  tagline: {
    fontSize: 16,
    color: '#338DFF',
    fontWeight: '500',
    letterSpacing: 2,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4A6080',
    textAlign: 'center',
    lineHeight: 22,
  },
});
