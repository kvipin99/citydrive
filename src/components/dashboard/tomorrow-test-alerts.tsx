
"use client";

import { useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { GraduationCap, Car, ArrowRight, BellRing } from "lucide-react";
import { format, addDays } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function TomorrowTestAlerts() {
  const db = useFirestore();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';
  
  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    return collection(db, 'students');
  }, [db, user?.uid, profile?.role]);

  const { data: students, isLoading } = useCollection(studentsQuery);

  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const isFromBranch = useCallback((record: any, branchName: string) => {
    if (!branchName || branchName === "All" || branchName === "Full") return true;
    
    const normalize = (s: any) => s?.toString().toLowerCase().trim().replace(/\s+/g, '') || '';
    const rBranch = normalize(record.branch);
    const targetBranch = normalize(branchName);
    
    if (rBranch === targetBranch) return true;

    const tNum = branchName.match(/\d+/)?.[0];
    const rNum = record.branch?.match(/\d+/)?.[0];
    if (tNum && rNum && tNum === rNum) return true;

    if (tNum) {
      const rid = normalize(record.id || '');
      const bPattern = new RegExp(`(^|[^a-z0-9])b${tNum}`, 'i');
      if (bPattern.test(rid)) return true;
    }
    
    return false;
  }, []);

  const upcomingTests = useMemo(() => {
    if (!students || !profile) return [];

    const currentBranchContext = profile.branch || "Branch 1";

    return students.filter(s => {
      const isTomorrow = s.learnersDate === tomorrowStr || s.testDate === tomorrowStr;
      if (!isTomorrow) return false;

      if (isAdmin) return true;
      return isFromBranch(s, currentBranchContext);
    }).map(s => ({
      id: s.id,
      name: s.name,
      type: s.learnersDate === tomorrowStr ? 'Learners' : 'Driving',
      date: s.learnersDate === tomorrowStr ? s.learnersDate : s.testDate,
      branch: s.branch
    }));
  }, [students, profile, isAdmin, tomorrowStr, isFromBranch]);

  const learnersTests = useMemo(() => upcomingTests.filter(t => t.type === 'Learners'), [upcomingTests]);
  const drivingTests = useMemo(() => upcomingTests.filter(t => t.type === 'Driving'), [upcomingTests]);

  if (isLoading || upcomingTests.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50/20 dark:bg-orange-950/10 dark:border-orange-900/50 shadow-sm border-l-4 border-l-orange-500 overflow-hidden">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0 bg-orange-50/30">
        <div className="grid gap-1">
          <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400 font-bold uppercase tracking-tight">
            <BellRing className="h-4 w-4 animate-pulse" />
            Branch License Tests Tomorrow
          </CardTitle>
          <CardDescription className="text-[10px] sm:text-xs font-medium">
            {upcomingTests.length} student{upcomingTests.length > 1 ? 's' : ''} booked for exams on {format(addDays(new Date(), 1), 'EEEE, MMMM do')}.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild className="h-8 text-[10px] font-bold border-orange-200 text-orange-700 hover:bg-orange-100 dark:border-orange-900/50">
          <Link href="/dashboard/test-search">
            Detailed Search <ArrowRight className="ml-1.5 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          {/* LEARNERS COLUMN */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center">
                <GraduationCap className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <h4 className="text-[10px] font-black uppercase text-orange-700 tracking-widest">Learners Tests ({learnersTests.length})</h4>
            </div>
            
            <div className="grid gap-2">
              {learnersTests.length === 0 ? (
                <p className="text-[10px] italic text-muted-foreground py-2 pl-8">No learners tests scheduled.</p>
              ) : (
                learnersTests.map((s) => (
                  <TestAlertItem key={s.id} student={s} />
                ))
              )}
            </div>
          </div>

          <div className="hidden md:block absolute left-1/2 top-0 bottom-0">
            <Separator orientation="vertical" />
          </div>

          {/* DRIVING COLUMN */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                <Car className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <h4 className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Driving Tests ({drivingTests.length})</h4>
            </div>

            <div className="grid gap-2">
              {drivingTests.length === 0 ? (
                <p className="text-[10px] italic text-muted-foreground py-2 pl-8">No driving tests scheduled.</p>
              ) : (
                drivingTests.map((s) => (
                  <TestAlertItem key={s.id} student={s} />
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TestAlertItem({ student }: { student: any }) {
  return (
    <Link 
      href={`/dashboard/students?id=${student.id}`}
      className="flex items-center justify-between p-2 rounded-xl bg-background border border-orange-100/50 dark:border-orange-900/20 group hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-2.5">
        <div className="grid">
          <span className="font-bold text-xs truncate max-w-[160px] group-hover:text-primary transition-colors">{student.name}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground uppercase font-mono">{student.id}</span>
            <span className="text-[8px] font-black px-1 rounded uppercase bg-muted text-muted-foreground">
              {student.branch}
            </span>
          </div>
        </div>
      </div>
      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
