
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Search, Calendar, GraduationCap, Car, Filter, RefreshCw, ArrowRight, User } from "lucide-react";
import { format, addDays, isValid, parseISO } from "date-fns";
import Link from "next/link";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

export default function TestSearchPage() {
  const db = useFirestore();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const [testType, setTestType] = useState<"learners" | "driving">("driving");
  const [selectedBranch, setSelectedBranch] = useState<string>("All");
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  // Sync branch for non-admins
  useEffect(() => {
    if (profile && !isAdmin) {
      setSelectedBranch(profile.branch || "Branch 1");
    }
  }, [profile, isAdmin]);

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    return collection(db, 'students');
  }, [db, user, profile]);

  const { data: students, isLoading: isStudentsLoading } = useCollection(studentsQuery);

  const isWithinRange = (dateStr: any) => {
    if (!dateStr) return false;
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(d)) return false;
    const dStr = format(d, 'yyyy-MM-dd');
    return dStr >= dateRange.from && dStr <= dateRange.to;
  };

  const isFromBranch = (record: any, branchName: string) => {
    if (branchName === "All") return true;
    if (record.branch === branchName) return true;
    const branchNum = branchName.match(/\d+/)?.[0];
    if (branchNum && record.id?.startsWith(`B${branchNum}`)) return true;
    return false;
  };

  const filteredResults = useMemo(() => {
    if (!students) return [];
    
    return students.filter(s => {
      // 1. Branch Filter
      if (!isFromBranch(s, selectedBranch)) return false;

      // 2. Date Filter based on Tab
      const targetDate = testType === "learners" ? s.learnersDate : s.testDate;
      return isWithinRange(targetDate);
    }).sort((a, b) => {
      const dateA = testType === "learners" ? (a.learnersDate || '') : (a.testDate || '');
      const dateB = testType === "learners" ? (b.learnersDate || '') : (b.testDate || '');
      return dateA.localeCompare(dateB);
    });
  }, [students, selectedBranch, dateRange, testType]);

  const handleTomorrow = () => {
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    setDateRange({ from: tomorrow, to: tomorrow });
  };

  const isLoading = isProfileLoading || isStudentsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">License Test Search</h2>
          <p className="text-muted-foreground text-sm">Find students with upcoming Learners or Driving tests.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleTomorrow} className="border-primary/20 text-primary hover:bg-primary/5">
            <Calendar className="mr-2 h-4 w-4" />
            Tests Tomorrow
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1 shadow-sm border-primary/10 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Date Range</Label>
              <div className="space-y-2">
                <div className="grid gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">From</span>
                  <Input 
                    type="date" 
                    className="h-9 text-xs" 
                    value={dateRange.from} 
                    onChange={(e) => setDateRange({...dateRange, from: e.target.value})} 
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">To</span>
                  <Input 
                    type="date" 
                    className="h-9 text-xs" 
                    value={dateRange.to} 
                    onChange={(e) => setDateRange({...dateRange, to: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase text-[10px] tracking-widest text-muted-foreground">Branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!isAdmin}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Branches</SelectItem>
                  {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-3">
          <Tabs value={testType} onValueChange={(v) => setTestType(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/50 border mb-6">
              <TabsTrigger value="learners" className="gap-2">
                <GraduationCap className="h-4 w-4" /> Learners Test
              </TabsTrigger>
              <TabsTrigger value="driving" className="gap-2">
                <Car className="h-4 w-4" /> Driving Test
              </TabsTrigger>
            </TabsList>

            <Card className="border-primary/10 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {testType === 'learners' ? 'Learners License Candidates' : 'Permanent License Candidates'}
                    </CardTitle>
                    <CardDescription>
                      Showing {filteredResults.length} records for {selectedBranch === 'All' ? 'all branches' : selectedBranch}.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-background">
                    {dateRange.from === dateRange.to ? dateRange.from : `${dateRange.from} to ${dateRange.to}`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground">Searching candidates...</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        <TableHead className="pl-6">Student ID & Name</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Test Date</TableHead>
                        <TableHead className="text-right pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                            <div className="flex flex-col items-center gap-2 opacity-40">
                              <Search className="h-10 w-10" />
                              <p>No candidates found for this selection.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredResults.map((s) => (
                          <TableRow key={s.id} className="hover:bg-muted/5 group">
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                  {s.name?.charAt(0) || 'S'}
                                </div>
                                <div className="grid gap-0.5">
                                  <span className="font-bold text-sm leading-none">{s.name}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase font-mono">{s.id}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium text-muted-foreground">
                              {s.phone}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] uppercase font-bold">{s.branch}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={testType === 'learners' ? 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-50' : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50'}>
                                {testType === 'learners' ? s.learnersDate : s.testDate}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <Button variant="ghost" size="sm" asChild className="group-hover:text-primary group-hover:bg-primary/5">
                                <Link href="/dashboard/students">
                                  Profile <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
