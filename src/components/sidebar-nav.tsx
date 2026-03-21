
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
  FileVideo,
  GraduationCap,
  ClipboardCheck,
  Layers,
  Search,
  History,
} from 'lucide-react';
import { useFirestore, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/students', icon: Users, label: 'Students', staffOnly: true },
  { href: '/dashboard/test-search', icon: Search, label: 'Test Search', staffOnly: true },
  { href: '/dashboard/payments', icon: CreditCard, label: 'Student Receipts', staffOnly: true },
  { href: '/dashboard/other-receipts', icon: Layers, label: 'Other Receipts', staffOnly: true },
  { href: '/dashboard/profile', icon: GraduationCap, label: 'My Profile', studentOnly: true },
  { href: '/dashboard/attendance', icon: CalendarCheck, label: 'Attendance' },
  { href: '/dashboard/expenses', icon: Wallet, label: 'Expenses', staffOnly: true },
  { href: '/dashboard/instructors', icon: UserSquare, label: 'Instructors', adminOnly: true },
  { href: '/dashboard/vehicles', icon: Car, label: 'Vehicles', adminOnly: true },
  { href: '/dashboard/courses', icon: Tags, label: 'Course Catalog', adminOnly: true },
  { href: '/dashboard/accounting', icon: Receipt, label: 'Accounting', staffOnly: true },
  { href: '/dashboard/reports', icon: Book, label: 'Reports', staffOnly: true },
  { href: '/dashboard/usage', icon: History, label: 'User Usage', masterOnly: true },
  { href: '/dashboard/quizzes', icon: ClipboardCheck, label: 'Quizzes' },
  { href: '/dashboard/resources', icon: FileVideo, label: 'Resources' },
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
  const isMaster = user?.email === 'master@citydriving.in';
  const isAdmin = profile?.role === 'Admin' || isMaster;
  const isBranchManager = profile?.role === 'BranchManager';
  const isStudent = profile?.role === 'Student';
  const isInstructor = profile?.role === 'Instructor';
  const isStaff = isAdmin || isBranchManager || isInstructor;

  return (
    <div className="flex h-full flex-col justify-between p-2">
      <SidebarMenu>
        {navItems.map((item) => {
          // 1. Check basic role flags
          if (item.adminOnly && !isAdmin) return null;
          if (item.staffOnly && !isStaff) return null;
          if (item.studentOnly && !isStudent) return null;
          if (item.masterOnly && !isMaster) return null;
          
          // 2. Special restriction for Instructor role
          if (isInstructor && !isAdmin) {
            const allowedForInstructor = ['/dashboard', '/dashboard/attendance', '/dashboard/quizzes', '/dashboard/resources', '/dashboard/settings'];
            if (!allowedForInstructor.includes(item.href)) {
              return null;
            }
          }
          
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
