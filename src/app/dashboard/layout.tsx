
'use client';

import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import SidebarNav from '@/components/sidebar-nav';
import DashboardHeader from '@/components/dashboard-header';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AutoBackupTrigger } from '@/components/dashboard/auto-backup-trigger';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const logo = PlaceHolderImages.find(p => p.id === 'app-logo');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

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
        
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 p-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background overflow-hidden border">
                {logo && (
                  <Image 
                    src={logo.imageUrl} 
                    alt="Citydrive Logo" 
                    width={40} 
                    height={40} 
                    className="object-contain"
                    data-ai-hint={logo.imageHint}
                  />
                )}
              </div>
              <span className="text-lg font-bold text-primary group-data-[collapsible=icon]:hidden">Citydrive</span>
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
