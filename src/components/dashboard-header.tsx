"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { LogOut, User, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import { doc } from "firebase/firestore";
import Link from "next/link";

export default function DashboardHeader() {
  const avatarPlaceholder = PlaceHolderImages.find(p => p.id === 'user-avatar-1');
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const getPageTitle = () => {
    switch (pathname) {
      case '/dashboard':
        return 'Dashboard';
      case '/dashboard/students':
        return 'Students';
      case '/dashboard/instructors':
        return 'Instructors';
      case '/dashboard/vehicles':
        return 'Vehicles';
      case '/dashboard/accounting':
        return 'Accounting';
      case '/dashboard/expenses':
        return 'Expenses';
      case '/dashboard/payments':
        return 'Fee Collection';
      case '/dashboard/courses':
        return 'Course Catalog';
      case '/dashboard/reports':
        return 'Reports';
      case '/dashboard/backup':
        return 'Backup';
      case '/dashboard/settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <SidebarTrigger className="md:hidden" />

      <div className="flex w-full items-center justify-between">
        <h1 className="text-xl font-semibold">{getPageTitle()}</h1>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10 border border-primary/20">
                  <AvatarImage 
                    src={profile?.avatarUrl} 
                    alt="User Avatar" 
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">
                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none">
                    {user?.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {profile?.role === 'Admin' ? 'Administrator' : 
                     profile?.role === 'BranchManager' ? 'Branch Manager' : 'Staff User'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/dashboard/settings?tab=profile" className="flex items-center w-full">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/dashboard/settings?tab=general" className="flex items-center w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
