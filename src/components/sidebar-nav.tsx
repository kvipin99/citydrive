
"use client";

import { usePathname } from 'next/navigation';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  UserSquare,
  Car,
  Receipt,
  Book,
  DatabaseBackup,
  Settings,
  Tags,
  CreditCard,
  Wallet,
  CalendarCheck,
} from 'lucide-react';
import { useFirestore, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/students', icon: Users, label: 'Students' },
  { href: '/dashboard/attendance', icon: CalendarCheck, label: 'Attendance' },
  { href: '/dashboard/payments', icon: CreditCard, label: 'Payments' },
  { href: '/dashboard/expenses', icon: Wallet, label: 'Expenses' },
  { href: '/dashboard/instructors', icon: UserSquare, label: 'Instructors', adminOnly: true },
  { href: '/dashboard/vehicles', icon: Car, label: 'Vehicles', adminOnly: true },
  { href: '/dashboard/courses', icon: Tags, label: 'Courses', adminOnly: true },
  { href: '/dashboard/accounting', icon: Receipt, label: 'Accounting', adminOnly: true },
  { href: '/dashboard/reports', icon: Book, label: 'Reports' },
  { href: '/dashboard/backup', icon: DatabaseBackup, label: 'Backup', adminOnly: true },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  return (
    <div className="flex h-full flex-col justify-between p-2">
      <SidebarMenu>
        {navItems.map((item) => {
          // Hide adminOnly items from Branch Managers
          if (item.adminOnly && !isAdmin) return null;
          
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <a href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  );
}
