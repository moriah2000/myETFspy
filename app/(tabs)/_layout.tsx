import { Stack } from 'expo-router';
import { PortfolioDataProvider } from './hooks/usePortfolioData';
import { TransactionStoreProvider } from './hooks/usePortfolioTransactions';

export default function RootLayout() {
  return (
    <TransactionStoreProvider>
      <PortfolioDataProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="etf/[ticker]" />
        </Stack>
      </PortfolioDataProvider>
    </TransactionStoreProvider>
  );
}