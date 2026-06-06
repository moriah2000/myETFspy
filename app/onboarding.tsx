import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: 1,
    title: 'Track ETF Changes\nBefore the Market\nNotices',
    subtitle: 'Stay ahead with real-time alerts on holdings, dividends, and important ETF updates.',
    icon: '📊',
  },
  {
    id: 2,
    title: 'Real-Time ETF\nIntelligence',
    subtitle: 'Get notified when important changes happen so you can make smarter decisions.',
    icon: '🔔',
  },
  {
    id: 3,
    title: 'Build Your\nPortfolio',
    subtitle: 'Monitor performance, track income, and grow your wealth confidently.',
    icon: '💼',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);

  function handleNext() {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      router.replace('/setup');
    }
  }

  const slide = slides[current];

  return (
    <View style={styles.container}>

      {/* Skip */}
      <TouchableOpacity style={styles.skip} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{slide.icon}</Text>
      </View>

      {/* Text */}
      <View style={styles.textContainer}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
      </View>

      {/* Dots */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === current && styles.dotActive]}
          />
        ))}
      </View>

      {/* Button */}
      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>
          {current === slides.length - 1 ? 'Start Tracking' : 'Next'}
        </Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  skip: {
    position: 'absolute',
    top: 60,
    right: 24,
  },
  skipText: {
    color: '#4A6080',
    fontSize: 14,
    fontWeight: '500',
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#141A26',
    borderWidth: 0.5,
    borderColor: 'rgba(51,141,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  icon: {
    fontSize: 60,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 48,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E8EEF8',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#4A6080',
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 48,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A3A54',
  },
  dotActive: {
    backgroundColor: '#338DFF',
    width: 24,
  },
  button: {
    backgroundColor: '#338DFF',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});