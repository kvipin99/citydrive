
'use client';

import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import SidebarNav from '@/components/sidebar-nav';
import DashboardHeader from '@/components/dashboard-header';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { AutoBackupTrigger } from '@/components/dashboard/auto-backup-trigger';
import { UsageHeartbeat } from '@/components/dashboard/usage-heartbeat';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import Image from "next/image";
import placeholderData from '@/app/lib/placeholder-images.json';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  const appLogo = useMemo(() => placeholderData.placeholderImages.find(img => img.id === 'app-logo'), []);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
    
    // Track Activity
    if (user && db) {
      const userRef = doc(db, 'users', user.uid);
      updateDoc(userRef, { updatedAt: serverTimestamp() }).catch(() => {});
    }
  }, [user, isUserLoading, router, db]);

  if (isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="bg-sidebar">
        <AutoBackupTrigger />
        <UsageHeartbeat />
        
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3 p-2">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-primary/20 overflow-hidden">
                {appLogo && (
                  <Image 
                    src={appLogo.imageUrl} 
                    alt="CDS Logo" 
                    fill 
                    className="object-contain p-1" 
                    data-ai-hint={appLogo.imageHint}
                  />
                )}
              </div>
              <span className="text-lg font-black text-primary group-data-[collapsible=icon]:hidden tracking-tighter">CITYDRIVE</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarNav />
          </SidebarContent>
        </Sidebar>
      </div>
      <SidebarInset>
        <DashboardHeader />
        <main className="min-h-[calc(100vh-4rem)] bg-background p-4 lg:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
