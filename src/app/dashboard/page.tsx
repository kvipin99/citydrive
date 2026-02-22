
"use client";

import AiSummary from "@/components/dashboard/ai-summary";
import { RevenueChart, ProfitChart, ExpensesChart } from "@/components/dashboard/charts";
import StatsCards from "@/components/dashboard/stats-cards";
import VehicleValidityAlerts from "@/components/dashboard/vehicle-validity-alerts";
import UpcomingClasses from "@/components/dashboard/upcoming-classes";
import FleetStatus from "@/components/dashboard/fleet-status";
import { useDoc, useFirestore, useUser, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, Clock, CreditCard, Wallet, CalendarCheck, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);

  if (isProfileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] lg:col-span-2" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  const welcomeName = profile?.name || user?.email?.split('@')[0] || 'User';

  // --- Student View ---
  if (profile?.role === 'Student') {
    return <StudentDashboard uid={user?.uid!} welcomeName={welcomeName} />;
  }

  // --- Instructor View (Operational Only) ---
  if (profile?.role === 'Instructor') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Hello, {welcomeName}!</h2>
            <p className="text-muted-foreground text-sm">Here is your agenda and fleet status for today.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="px-3 py-1 font-bold">
              {profile?.branch || 'Operational'}
            </Badge>
            <Button asChild className="shadow-sm">
              <Link href="/dashboard/attendance">
                <CalendarCheck className="mr-2 h-4 w-4" />
                Record Attendance
                <ArrowRight className="ml-2 h-4 w-4 opacity-50" />
              </Link>
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <UpcomingClasses />
          <div className="space-y-6">
            <FleetStatus />
            <VehicleValidityAlerts />
          </div>
        </div>
      </div>
    );
  }

  // --- Management View (Admin & Branch Manager) ---
  const isAdmin = profile?.role === 'Admin';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Hello, {welcomeName}!</h2>
        <p className="text-muted-foreground text-sm">
          {isAdmin 
            ? "Here is the school's overview across all branches." 
            : `Here is the performance status for ${profile?.branch || 'your branch'}.`}
        </p>
      </div>

      <StatsCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RevenueChart />
        </div>
        <div className="lg:col-span-2">
          <ProfitChart />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
           <VehicleValidityAlerts />
        </div>
        <div className="lg:col-span-2">
          <ExpensesChart />
        </div>
      </div>
    </div>
  );
}

function StudentDashboard({ uid, welcomeName }: { uid: string, welcomeName: string }) {
  const db = useFirestore();
  
  const studentQuery = useMemoFirebase(() => 
    db ? query(collection(db, "students"), where("userId", "==", uid)) : null, [db, uid]);
  const { data: studentRecords, isLoading: isStudentLoading } = useCollection(studentQuery);
  const student = studentRecords?.[0];

  const attendanceQuery = useMemoFirebase(() => 
    db && uid ? query(collection(db, "attendance"), where("studentUid", "==", uid)) : null, [db, uid]);
  const { data: attendance } = useCollection(attendanceQuery);

  if (isStudentLoading) return <Skeleton className="h-64 w-full" />;

  const displayName = student?.name || welcomeName;
  const paidAmount = student?.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
  const balance = (student?.amount || 0) - paidAmount;
  const totalHours = attendance?.reduce((sum: number, a: any) => sum + (Number(a.duration) || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Hello, {displayName}!</h2>
        <p className="text-muted-foreground text-sm">Track your training progress and upcoming lessons.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">My Progress</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours} Hours</div>
            <p className="text-xs text-muted-foreground">Total training completed</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Fees Paid</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{paidAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Out of ₹{student?.amount?.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Balance Due</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{balance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Remaining balance</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              My Enrolled Courses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {student?.courses?.length > 0 ? (
              student.courses.map((course: string, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <span className="font-medium">{course}</span>
                  <Badge variant="outline">Enrolled</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic">No courses enrolled yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Recent Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendance && attendance.length > 0 ? (
              <div className="space-y-3">
                {attendance.slice(0, 5).map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-2 border-b last:border-0">
                    <div className="grid">
                      <span className="text-sm font-medium">{log.date}</span>
                      <span className="text-[10px] text-muted-foreground">{log.startTime} - {log.endTime}</span>
                    </div>
                    <Badge variant="secondary">{log.duration}h</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No sessions logged yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
