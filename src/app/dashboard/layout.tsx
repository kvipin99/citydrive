'use client';

import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import SidebarNav from '@/components/sidebar-nav';
import DashboardHeader from '@/components/dashboard-header';
import { Car } from 'lucide-react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

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

  // If no user after loading, we show nothing while redirect happens
  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="bg-sidebar">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 p-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Car className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-foreground group-data-[collapsible=icon]:hidden">Citydrive</span>
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
