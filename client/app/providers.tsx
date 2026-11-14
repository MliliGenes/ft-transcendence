'use client';

import {
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/components/auth/auth-provider';
import { OAuthReturnHandler } from '@/components/auth/oauth-return-handler';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // Never share cached user data across server requests.
  if (environmentManager.isServer()) return makeQueryClient();

  // Keep the browser cache stable across renders and initial suspension.
  return (browserQueryClient ??= makeQueryClient());
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={getQueryClient()}>
        <AuthProvider>
          <OAuthReturnHandler />
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
