'use client';

import { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SafeAreaProvider>
      {children}
    </SafeAreaProvider>
  );
} 