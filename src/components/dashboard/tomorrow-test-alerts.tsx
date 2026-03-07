
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { GraduationCap, Car, ArrowRight, BellRing } from "lucide-react";
import { format, addDays } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TomorrowTestAlerts() {
  const db = useFirestore();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';
  
  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    return collection(db, 'students');
  }, [db, user?.uid, profile?.role]);

  const { data: students, isLoading } = useCollection(studentsQuery);

  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const upcomingTests = useMemo(() => {
    if (!students || !profile) return [];

    const currentBranch = profile.branch;

    return students.filter(s => {
      // Test Date Check
      const isTomorrow = s.learnersDate === tomorrowStr || s.testDate === tomorrowStr;
      if (!isTomorrow) return false;

      // Branch Isolation Logic
      if (isAdmin) return true;
      
      const normalize = (str: string) => str?.replace(/\s+/g, '').toLowerCase() || '';
      const sBranch = normalize(s.branch);
      const pBranch = normalize(currentBranch);
      
      if (sBranch === pBranch) return true;

      const branchNum = currentBranch?.match(/\d+/)?.[0];
      if (branchNum && s.id?.startsWith(`B${branchNum}`)) return true;

      return false;
    }).map(s => ({
      id: s.id,
      name: s.name,
      type: s.learnersDate === tomorrowStr ? 'Learners' : 'Driving',
      date: s.learnersDate === tomorrowStr ? s.learnersDate : s.testDate
    }));
  }, [students, profile, isAdmin, tomorrowStr]);

  if (isLoading || upcomingTests.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50/20 dark:bg-orange-950/10 dark:border-orange-900/50 shadow-sm border-l-4 border-l-orange-500">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
        <div className="grid gap-1">
          <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400 font-bold uppercase tracking-tight">
            <BellRing className="h-4 w-4 animate-pulse" />
            License Tests Scheduled Tomorrow
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
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {upcomingTests.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-orange-100 dark:border-orange-900/20 group hover:shadow-md transition-all">
              <div className="flex items-center gap-2.5">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${s.type === 'Learners' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                  {s.type === 'Learners' ? <GraduationCap className="h-4 w-4" /> : <Car className="h-4 w-4" />}
                </div>
                <div className="grid">
                  <span className="font-bold text-xs truncate max-w-[140px] group-hover:text-primary transition-colors">{s.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-muted-foreground uppercase font-mono">{s.id}</span>
                    <span className={`text-[8px] font-black px-1 rounded uppercase ${s.type === 'Learners' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {s.type}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
