import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { PWAManager } from '@/components/pwa-manager';

export const metadata: Metadata = {
  title: 'Citydrive - Driving School Management',
  description: 'A comprehensive management system for driving schools.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Citydrive',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <PWAManager />
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
