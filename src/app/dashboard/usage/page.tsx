"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { Clock, RefreshCw, Calendar as CalendarIcon, MapPin, History, Users, Activity } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { DateSegmentedInput } from "@/components/ui/date-segmented-input";

const toUI = (iso: string) => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
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

  const usersQuery = useMemoFirebase(() => {
    if (!db || !isMaster) return null;
    return collection(db, "users");
  }, [db, isMaster]);

  const { data: usageLogs, isLoading: isLogsLoading } = useCollection(usageQuery);
  const { data: portalUsers, isLoading: isUsersLoading } = useCollection(usersQuery);

  const aggregatedUsage = useMemo(() => {
    if (!portalUsers) return [];

    const stats: Record<string, { 
      userId: string, 
      userName: string, 
      branch: string, 
      role: string, 
      heartbeats: number,
      lastActive: Date | null
    }> = {};

    portalUsers.forEach(u => {
      if (u.role === 'Student') return;

      stats[u.id] = {
        userId: u.id,
        userName: u.name || u.email || "Unknown",
        branch: u.branch || "HeadOffice",
        role: u.role || "User",
        heartbeats: 0,
        lastActive: u.updatedAt?.seconds ? new Date(u.updatedAt.seconds * 1000) : null
      };
    });

    if (usageLogs) {
      usageLogs.forEach(log => {
        if (stats[log.userId]) {
          stats[log.userId].heartbeats++;
          const ts = log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : null;
          if (ts && (!stats[log.userId].lastActive || ts > stats[log.userId].lastActive)) {
            stats[log.userId].lastActive = ts;
          }
        }
      });
    }

    return Object.values(stats).sort((a, b) => b.heartbeats - a.heartbeats);
  }, [usageLogs, portalUsers]);

  const totalHeartbeats = useMemo(() => {
    return (usageLogs || []).length;
  }, [usageLogs]);

  const formatUsageTime = (heartbeats: number) => {
    const totalMinutes = heartbeats * 10;
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

  const isLoading = isLogsLoading || isUsersLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="grid gap-1"><h2 className="text-2xl font-bold tracking-tight">System Usage Analysis</h2><p className="text-muted-foreground text-sm">Monitor staff and manager activity duration.</p></div>
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-primary/10"><div className="flex items-center gap-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">From</Label><DateSegmentedInput value={dateRange.from} onChange={(v) => setDateRange({...dateRange, from: v})} /></div><div className="flex items-center gap-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">To</Label><DateSegmentedInput value={dateRange.to} onChange={(v) => setDateRange({...dateRange, to: v})} /></div><Button variant="ghost" size="sm" className="h-9 text-[10px] font-bold text-primary" onClick={() => setDateRange({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })}>Today</Button></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20 shadow-sm"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-black uppercase text-primary flex items-center gap-2"><Activity className="h-4 w-4" /> Total System Usage</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-3xl font-black text-primary">{formatUsageTime(totalHeartbeats)}</div><p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Combined time for all users</p></CardContent></Card>
        <Card className="bg-muted/30 border-muted-foreground/10 shadow-sm"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Registered Staff</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-3xl font-black">{aggregatedUsage.length}</div><p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Active & Inactive Identities</p></CardContent></Card>
        <Card className="bg-muted/30 border-muted-foreground/10 shadow-sm"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Reporting Period</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-sm font-black uppercase">{dateRange.from === dateRange.to ? toUI(dateRange.from) : `${toUI(dateRange.from)} - ${toUI(dateRange.to)}`}</div><p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Selected filter range</p></CardContent></Card>
      </div>
      <Card><CardHeader className="pb-3 border-b"><div className="flex items-center justify-between"><CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Detailed User Breakdown</CardTitle><Badge variant="outline" className="font-bold">{aggregatedUsage.length} Staff Identities</Badge></div><CardDescription>Individual time tracking based on 10-minute heartbeat frequency.</CardDescription></CardHeader><CardContent className="p-0">{isLoading ? (<div className="flex justify-center py-20"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>) : aggregatedUsage.length === 0 ? (<div className="text-center py-20 text-muted-foreground italic">No activity logs found for the selected period.</div>) : (<Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="pl-6">User / Identity</TableHead><TableHead>Branch</TableHead><TableHead>Role</TableHead><TableHead>Last Active</TableHead><TableHead className="text-right pr-6">Est. Usage Time</TableHead></TableRow></TableHeader><TableBody>{aggregatedUsage.map((u) => (<TableRow key={u.userId} className="hover:bg-muted/20"><TableCell className="pl-6"><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{u.userName.charAt(0)}</div><span className="font-bold text-sm">{u.userName}</span></div></TableCell><TableCell><Badge variant="outline" className="text-[10px] uppercase font-bold flex w-fit items-center gap-1"><MapPin className="h-3 w-3" /> {u.branch}</Badge></TableCell><TableCell><span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">{u.role}</span></TableCell><TableCell className="text-xs text-muted-foreground font-medium">{u.lastActive ? format(u.lastActive, 'dd/MM HH:mm') : 'N/A'}</TableCell><TableCell className="text-right pr-6"><Badge variant="secondary" className={`font-black text-xs px-3 py-1 border-primary/10 ${u.heartbeats > 0 ? 'bg-primary/5 text-primary' : 'bg-muted text-muted-foreground opacity-50'}`}>{formatUsageTime(u.heartbeats)}</Badge></TableCell></TableRow>))}</TableBody></Table>)}</CardContent></Card>
    </div>
  );
}
