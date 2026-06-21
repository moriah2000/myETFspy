import { Stack } from 'expo-router';
import { TransactionStoreProvider } from './hooks/usePortfolioTransactions';

// STABILIZATION MODE: the entire app is wrapped in a single
// TransactionStoreProvider so every screen reads/writes the SAME in-memory
// transaction state and migration runs exactly once, app-wide. This is what
// closes the multi-instance race that caused transaction data to
// intermittently collapse (see usePortfolioTransactions.tsx for detail).
export default function RootLayout() {
  return (
    <TransactionStoreProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="etf/[ticker]" />
      </Stack>
    </TransactionStoreProvider>
  );
}