
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { format, isSameDay } from "date-fns";
import { Calendar } from "lucide-react";

export default function UpcomingClasses() {
  const db = useFirestore();
  const { user } = useUser();

  const classesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'classes');
  }, [db, user]);

  const { data: classes, isLoading } = useCollection(classesQuery);

  const todaysClasses = useMemo(() => {
    const today = new Date();
    return classes?.filter(c => {
        const start = c.startTime ? new Date(c.startTime) : null;
        return start && isSameDay(start, today);
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) || [];
  }, [classes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Classes</CardTitle>
        <CardDescription>Scheduled for {format(new Date(), 'EEEE, MMM do')}.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-12 w-full animate-pulse bg-muted rounded-lg" />)
          ) : todaysClasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mb-2 opacity-20" />
                <p>No classes scheduled for today.</p>
            </div>
          ) : (
            todaysClasses.map((c, index) => (
              <div key={index} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Avatar>
                  <AvatarFallback>{c.studentName?.charAt(0) || 'S'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{c.studentName}</p>
                  <p className="text-sm text-muted-foreground">Instructor: {c.instructorName}</p>
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  {format(new Date(c.startTime), 'p')} - {format(new Date(c.endTime), 'p')}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
