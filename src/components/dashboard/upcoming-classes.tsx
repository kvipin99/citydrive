
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { format, isSameDay } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <Card className="shadow-sm overflow-hidden border-primary/10">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Today's Driving Schedule
        </CardTitle>
        <CardDescription>{format(new Date(), 'EEEE, MMMM do, yyyy')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {isLoading ? (
            [1, 2, 3].map(i => <div key={i} className="h-16 w-full animate-pulse bg-muted rounded-xl" />)
          ) : todaysClasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-2xl">
                <Calendar className="h-12 w-12 mb-3 opacity-10" />
                <p className="font-medium">No sessions scheduled for today.</p>
                <p className="text-xs">Bookings will appear here in real-time.</p>
            </div>
          ) : (
            todaysClasses.map((c) => (
              <div key={c.id} className="flex items-center space-x-4 p-3 rounded-xl border bg-card hover:shadow-md transition-all group">
                <Avatar className="h-10 w-10 border-2 border-primary/10 group-hover:border-primary/30 transition-colors">
                  <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                    {c.studentName?.charAt(0) || 'S'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-sm">{c.studentName}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                    Instr: <span className="text-foreground font-semibold">{c.instructorName}</span>
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <Badge variant="outline" className="font-mono text-[10px] bg-background">
                    {format(new Date(c.startTime), 'p')}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground font-medium">to {format(new Date(c.endTime), 'p')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
