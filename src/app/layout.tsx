
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { PWAManager } from '@/components/pwa-manager';

export const metadata: Metadata = {
  title: 'Citydrive - Driving School Management',
  description: 'A comprehensive management system for driving schools.',
  icons: {
    icon: 'https://picsum.photos/seed/cds-driving-logo/32/32',
    apple: 'https://picsum.photos/seed/cds-driving-logo/180/180',
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
  themeColor: '#2baec4',
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
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
