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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { Search, Calendar, GraduationCap, Car, Filter, RefreshCw, ArrowRight, User, Phone, MapPin, Clock, CreditCard, Wallet, BookOpen, Fingerprint, FileText } from "lucide-react";
import { format, addDays, isValid, parseISO } from "date-fns";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

const typeLabelMap: Record<string, string> = {
  '2wlr': '2W',
  '3wlr': '3W',
  '4wlr': '4W',
  'Heavy': 'HV',
  'Other': 'OT',
  'N/A': 'N/A'
};

export default function TestSearchPage() {
  const db = useFirestore();
  const { user } = useUser();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const [testType, setTestType] = useState<"learners" | "driving" >("driving");
  const [selectedBranch, setSelectedBranch] = useState<string>("All");
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  // State for Profile View
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);

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
      if (!isFromBranch(s, selectedBranch)) return false;
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
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={s.photoUrl} alt={s.name} />
                                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                    {s.name?.charAt(0) || 'S'}
                                  </AvatarFallback>
                                </Avatar>
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
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="group-hover:text-primary group-hover:bg-primary/5"
                                onClick={() => { setSelectedStudent(s); setIsProfileSheetOpen(true); }}
                              >
                                View Profile <ArrowRight className="ml-2 h-3.5 w-3.5" />
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

      <Sheet open={isProfileSheetOpen} onOpenChange={setIsProfileSheetOpen}>
        <SheetContent className="sm:max-w-3xl overflow-y-auto">
          <SheetHeader className="pb-6">
            <SheetTitle>Student Profile Dashboard</SheetTitle>
          </SheetHeader>
          {selectedStudent && (
            <StudentProfileViewContent student={selectedStudent} db={db} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StudentProfileViewContent({ student, db }: any) {
  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !student?.userId) return null;
    // CRITICAL: Must satisfies the studentUid == auth.uid rule
    return query(collection(db, 'attendance'), where('studentUid', '==', student.userId));
  }, [db, student?.userId]);

  const { data: attendance, isLoading: isAttendanceLoading } = useCollection(attendanceQuery);

  const vehiclesQuery = useMemoFirebase(() => (db ? collection(db, 'vehicles') : null), [db]);
  const { data: vehicles } = useCollection(vehiclesQuery);

  const stats = useMemo(() => {
    if (!attendance) return { practical: 0, theory: 0, paid: 0, balance: 0, byType: {} as Record<string, number> };
    
    const vMap: Record<string, string> = {};
    vehicles?.forEach(v => { vMap[v.id] = v.type; });

    const hours = (attendance || []).reduce((acc, curr) => {
      const h = Number(curr.duration) || 0;
      if (curr.type === 'Theory') {
        acc.theory += h;
      } else {
        acc.practical += h;
        const type = curr.vehicleType || vMap[curr.vehicleId] || 'Other';
        if (type !== 'N/A') {
          acc.byType[type] = (acc.byType[type] || 0) + h;
        }
      }
      return acc;
    }, { practical: 0, theory: 0, byType: {} as Record<string, number> });

    const paid = student?.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
    const balance = Math.max(0, (student.amount || 0) - paid);

    return { ...hours, paid, balance };
  }, [attendance, student, vehicles]);

  const formatSafeDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return isValid(d) ? format(d, 'MMM dd, yyyy') : 'N/A';
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col items-center text-center gap-4 py-6 bg-primary/5 rounded-2xl border-2 border-primary/10">
        <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
          <AvatarImage src={student.photoUrl} alt={student.name} />
          <AvatarFallback className="text-2xl font-bold bg-primary text-white">{student.name?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="grid gap-1">
          <h2 className="text-2xl font-black tracking-tight">{student.name}</h2>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="font-mono font-bold">{student.id}</Badge>
            {student.registerNo && <Badge variant="outline" className="font-bold border-primary/20 text-primary">REG: {student.registerNo}</Badge>}
            <Badge variant="outline" className="uppercase font-bold text-[10px]">{student.branch}</Badge>
          </div>
          <Badge className="mx-auto mt-2" variant={student.status === 'Active' ? 'default' : 'secondary'}>{student.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatSummary label="Practical Hr" value={`${stats.practical.toFixed(1)}h`} icon={<Car className="h-3 w-3" />} color="blue" breakdown={stats.byType} />
        <StatSummary label="Theory Hr" value={`${stats.theory.toFixed(1)}h`} icon={<BookOpen className="h-3 w-3" />} color="orange" />
        <StatSummary label="Paid" value={`₹${stats.paid.toLocaleString()}`} icon={<CreditCard className="h-3 w-3" />} color="green" />
        <StatSummary label="Balance" value={`₹${stats.balance.toLocaleString()}`} icon={<Wallet className="h-3 w-3" />} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h3 className="font-bold flex items-center gap-2 text-primary border-b pb-2"><User className="h-4 w-4" /> Information</h3>
          <div className="grid gap-4 text-sm">
            <ProfileItem icon={<Clock />} label="Admission Date" value={formatSafeDate(student.registrationDate)} />
            <ProfileItem icon={<Calendar />} label="Date of Birth" value={formatSafeDate(student.dob)} />
            <ProfileItem icon={<Phone />} label="Mobile" value={student.phone} />
            <ProfileItem icon={<Fingerprint />} label="Aadhar" value={student.aadharNo} />
            <ProfileItem icon={<FileText />} label="Online App ID" value={student.onlineAppNo} />
            <ProfileItem icon={<Fingerprint />} label="Learners No" value={student.learnersNo} />
            <ProfileItem icon={<Car />} label="Driving License No" value={student.drivingNo} />
            <ProfileItem icon={<MapPin />} label="Address" value={student.address} fullWidth />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-bold flex items-center gap-2 text-primary border-b pb-2"><GraduationCap className="h-4 w-4" /> Courses</h3>
          <div className="space-y-2">
            {student.courses?.map((c: string, i: number) => (
              <div key={i} className="p-3 rounded-lg border bg-muted/20 flex justify-between items-center">
                <span className="font-medium text-sm">{c === 'Others' ? (student.specialCourseName || 'Custom Course') : c}</span>
                <Badge variant="outline">Enrolled</Badge>
              </div>
            ))}
          </div>
          {student.remarks && (
            <div className="mt-6 p-4 rounded-lg bg-orange-50 border border-orange-100">
              <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Remarks</p>
              <p className="text-xs text-orange-800 italic">{student.remarks}</p>
            </div>
          )}
        </section>
      </div>

      <Separator />

      <section className="space-y-4">
        <h3 className="font-bold flex items-center gap-2 text-primary border-b pb-2"><Calendar className="h-4 w-4" /> Attendance Log</h3>
        {isAttendanceLoading ? (
          <div className="flex justify-center py-6"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !attendance || attendance.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground italic text-sm border-2 border-dashed rounded-xl">No logs found.</p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Duration</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...attendance].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((a: any) => (
                  <TableRow key={a.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-medium">{formatSafeDate(a.date)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px] font-bold uppercase">{a.type || 'Practical'}</Badge></TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{a.startTime} - {a.endTime} {a.vehicleReg && `• ${a.vehicleReg}`}</TableCell>
                    <TableCell className="text-right font-bold text-primary text-xs">{a.duration}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <h3 className="font-bold flex items-center gap-2 text-primary border-b pb-2"><CreditCard className="h-4 w-4" /> Receipts</h3>
        {!student.payments || student.payments.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground italic text-sm border-2 border-dashed rounded-xl">No receipts issued.</p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Receipt No.</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {student.payments.map((p: any) => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs">{formatSafeDate(p.date)}</TableCell>
                    <TableCell className="text-xs font-mono font-bold">#{p.receiptNo}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">₹{p.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatSummary({ label, value, icon, color, breakdown }: any) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/5 border-primary/10 text-primary",
    green: "bg-green-50/50 border-green-100 text-green-700",
    red: "bg-red-50/50 border-red-100 text-red-700",
    blue: "bg-blue-50/50 border-blue-100 text-blue-700",
    orange: "bg-orange-50/50 border-orange-100 text-orange-700"
  };
  return (
    <Card className={colorMap[color]}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-bold uppercase flex items-center gap-2">{icon} {label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-xl font-black">{value}</div>
        {breakdown && Object.keys(breakdown).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(breakdown).map(([type, hours]: [string, any]) => (
              hours > 0 && (
                <Badge key={type} variant="outline" className="text-[8px] px-1 py-0 h-4 font-mono font-bold bg-muted/30 border-primary/10">
                  {typeLabelMap[type] || type}: {hours.toFixed(1)}h
                </Badge>
              )
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileItem({ icon, label, value, fullWidth = false }: any) {
  return (
    <div className={`grid gap-1 ${fullWidth ? 'col-span-full' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">
        <span className="text-primary/60">{icon}</span>
        {label}
      </div>
      <div className="font-bold text-foreground bg-muted/10 p-2 rounded border border-transparent">
        {value || 'N/A'}
      </div>
    </div>
  );
}