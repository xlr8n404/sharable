'use client';

import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';

export function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-center" richColors theme={theme as 'light' | 'dark'} />;
}
