
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { Clock, Filter, RefreshCw, Calendar as CalendarIcon, User, MapPin, History } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";

// Helper to format ISO (YYYY-MM-DD) to Display (DD/MM/YYYY)
const toUI = (iso: string) => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
};

// Helper to parse Display (DD/MM/YYYY) to ISO (YYYY-MM-DD)
const fromUI = (ui: string) => {
  if (!ui || !ui.includes('/')) return ui;
  const parts = ui.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    if (y.length === 4) return `${y}-${m}-${d}`;
  }
  return ui;
};

export default function UserUsagePage() {
  const db = useFirestore();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isMaster = user?.email === 'master@citydriving.in';

  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const usageQuery = useMemoFirebase(() => {
    if (!db || !isMaster) return null;
    return query(
      collection(db, "usageLogs"),
      where("date", ">=", dateRange.from),
      where("date", "<=", dateRange.to)
    );
  }, [db, isMaster, dateRange.from, dateRange.to]);

  const { data: usageLogs, isLoading } = useCollection(usageQuery);

  const aggregatedUsage = useMemo(() => {
    if (!usageLogs) return [];

    const stats: Record<string, { 
      userId: string, 
      userName: string, 
      branch: string, 
      role: string, 
      heartbeats: number,
      lastActive: Date | null
    }> = {};

    usageLogs.forEach(log => {
      const key = log.userId;
      if (!stats[key]) {
        stats[key] = {
          userId: log.userId,
          userName: log.userName,
          branch: log.branch,
          role: log.role,
          heartbeats: 0,
          lastActive: null
        };
      }
      stats[key].heartbeats++;
      
      const ts = log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : null;
      if (ts && (!stats[key].lastActive || ts > stats[key].lastActive)) {
        stats[key].lastActive = ts;
      }
    });

    return Object.values(stats).sort((a, b) => b.heartbeats - a.heartbeats);
  }, [usageLogs]);

  const formatUsageTime = (heartbeats: number) => {
    const totalMinutes = heartbeats * 10; // 10 minutes per heartbeat
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <History className="h-16 w-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-bold">Unauthorized Access</h2>
        <p className="text-muted-foreground">This report is restricted to the Master system account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">System Usage Analysis</h2>
          <p className="text-muted-foreground text-sm">Monitor staff and manager activity duration.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-primary/10">
          <div className="flex items-center gap-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">From</Label>
            <Input 
              placeholder="DD/MM/YYYY" 
              className="h-9 w-[130px] text-xs bg-background" 
              value={toUI(dateRange.from)} 
              onChange={(e) => setDateRange({...dateRange, from: fromUI(e.target.value)})} 
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground">To</Label>
            <Input 
              placeholder="DD/MM/YYYY" 
              className="h-9 w-[130px] text-xs bg-background" 
              value={toUI(dateRange.to)} 
              onChange={(e) => setDateRange({...dateRange, to: fromUI(e.target.value)})} 
            />
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 text-[10px] font-bold text-primary"
            onClick={() => setDateRange({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })}
          >
            Today
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              User Activity Report
            </CardTitle>
            <Badge variant="outline" className="font-bold">
              {aggregatedUsage.length} Users Active
            </Badge>
          </div>
          <CardDescription>
            Estimated usage time calculated from 10-minute heartbeat logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : aggregatedUsage.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground italic">
              No activity logs found for the selected period.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6">User / Identity</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right pr-6">Est. Usage Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregatedUsage.map((u) => (
                  <TableRow key={u.userId} className="hover:bg-muted/20">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {u.userName.charAt(0)}
                        </div>
                        <span className="font-bold text-sm">{u.userName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold flex w-fit items-center gap-1">
                        <MapPin className="h-3 w-3" /> {u.branch}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {u.lastActive ? format(u.lastActive, 'dd/MM HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge variant="secondary" className="font-black text-xs px-3 py-1 bg-primary/5 text-primary border-primary/10">
                        {formatUsageTime(u.heartbeats)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
