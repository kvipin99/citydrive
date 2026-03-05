
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { collection, doc, query, where, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, Calendar as CalendarIcon, Search, RefreshCw, Clock, Trash2, PlusCircle, UserCircle, X, Car, BookOpen, Calculator, Filter } from "lucide-react";
import { format, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const SESSION_TYPES = [
  { value: 'Practical', label: 'Practical Class', icon: Car },
  { value: 'Theory', label: 'Theory Class', icon: BookOpen },
] as const;

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

export default function AttendancePage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBranch, setSelectedBranch] = useState<string>("All");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [sessionType, setSessionType] = useState<'Practical' | 'Theory'>('Practical');
  
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  
  const isStudent = profile?.role === 'Student';
  const isStaff = profile?.role === 'Admin' || profile?.role === 'BranchManager' || profile?.role === 'Instructor';
  const isAdmin = profile?.role === 'Admin';

  // Sync branch for managers/instructors, but Admin stays at whatever they select
  useEffect(() => {
    if (profile && !isAdmin && !isStudent) {
      setSelectedBranch(profile.branch || "Branch 1");
    }
  }, [profile, isAdmin, isStudent]);

  // Fetch Vehicles
  const vehiclesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'vehicles');
  }, [db, user]);
  const { data: vehicles } = useCollection(vehiclesQuery);

  // Fetch Students for selection - Admin gets all or filtered, Managers get their branch
  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    const base = collection(db, 'students');
    if (isStudent) return query(base, where('userId', '==', user.uid));
    return base;
  }, [db, user, profile, isStudent]);

  const { data: allStudents } = useCollection(studentsQuery);

  // Fetch Attendance records - Filtered by Date at Query Level
  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    const base = collection(db, 'attendance');

    if (isStudent) {
      return query(base, where('studentUid', '==', user.uid));
    }

    if (isStaff) {
      return query(base, where('date', '==', selectedDate));
    }
    return null;
  }, [db, user, profile, isStaff, isStudent, selectedDate]);

  const { data: rawAttendance, isLoading: isAttendanceLoading } = useCollection(attendanceQuery);

  // Helper to check if a record belongs to a branch
  const isFromBranch = (record: any, branchName: string) => {
    if (branchName === "All") return true;
    if (record.branch === branchName) return true;
    const branchNum = branchName.match(/\d+/)?.[0];
    if (branchNum && record.studentId?.startsWith(`B${branchNum}`)) {
      return true;
    }
    return false;
  };

  const filteredAttendance = useMemo(() => {
    if (!rawAttendance) return [];
    if (selectedBranch === "All") return rawAttendance;
    return rawAttendance.filter(rec => isFromBranch(rec, selectedBranch));
  }, [rawAttendance, selectedBranch]);

  const statsSummary = useMemo(() => {
    return filteredAttendance.reduce((acc, curr) => {
      const hours = Number(curr.duration) || 0;
      if (curr.type === 'Theory') acc.theory += hours;
      else acc.practical += hours;
      return acc;
    }, { practical: 0, theory: 0 });
  }, [filteredAttendance]);

  const filteredSearch = useMemo(() => {
    if (!allStudents) return [];
    let result = allStudents.filter(s => s.status !== 'Completed');
    if (selectedBranch !== "All") {
      result = result.filter(s => isFromBranch(s, selectedBranch));
    }
    if (!studentSearch) return result;
    const term = studentSearch.toLowerCase();
    return result.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.id.toLowerCase().includes(term) ||
      s.phone?.includes(term)
    );
  }, [allStudents, studentSearch, selectedBranch]);

  const calculateDuration = (start: string, end: string) => {
    try {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      const startTotal = sH * 60 + sM;
      const endTotal = eH * 60 + eM;
      const diff = endTotal - startTotal;
      return Math.max(0, parseFloat((diff / 60).toFixed(1)));
    } catch (e) {
      return 0;
    }
  };

  const handleMarkAttendance = () => {
    if (!db || !user || !profile || !selectedStudent) return;

    const attendanceId = `${selectedStudent.id}_${selectedDate}_${startTime.replace(':', '')}_${sessionType.charAt(0)}`;
    const attendanceRef = doc(db, 'attendance', attendanceId);

    const duration = calculateDuration(startTime, endTime);
    const vehicle = vehicles?.find(v => v.id === selectedVehicleId);

    const record = {
      id: attendanceId,
      studentId: selectedStudent.id,
      studentUid: selectedStudent.userId, 
      studentName: selectedStudent.name,
      date: selectedDate,
      status: 'Present',
      type: sessionType,
      startTime,
      endTime,
      duration,
      vehicleId: sessionType === 'Practical' ? (selectedVehicleId || 'None') : 'Theory',
      vehicleReg: sessionType === 'Practical' ? (vehicle?.regNumber || 'None') : 'N/A',
      branch: selectedStudent.branch,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    };

    setDocumentNonBlocking(attendanceRef, record, { merge: true });
    
    toast({
      title: "Attendance Recorded",
      description: `${selectedStudent.name} ${sessionType} session saved.`
    });

    setIsDialogOpen(false);
    resetPopup();
  };

  const resetPopup = () => {
    setStudentSearch("");
    setSelectedStudent(null);
    setSelectedVehicleId("");
    setSessionType('Practical');
    setStartTime("09:00");
    setEndTime("10:00");
  };

  const handleDeleteRecord = (recordId: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'attendance', recordId));
    toast({ title: "Record Removed" });
  };

  const sortedRecords = useMemo(() => {
    return [...filteredAttendance].sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });
  }, [filteredAttendance]);

  const headerDateDisplay = useMemo(() => {
    const d = new Date(selectedDate);
    return isValid(d) ? format(d, 'EEEE, MMMM do') : '...';
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Attendance Log</h2>
          <p className="text-muted-foreground text-sm">
            {isStudent ? 'My training sessions history.' : isAdmin ? 'Global school training records.' : `Training sessions history for ${selectedBranch}.`}
          </p>
        </div>
        {!isStudent && (
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <div className="bg-muted/30 p-2 rounded-lg border flex items-center gap-3">
                <Label className="text-[10px] font-black px-2 text-primary uppercase flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Branch Filter:
                </Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="h-9 w-[140px] bg-background border-primary/20 text-xs font-bold">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Branches</SelectItem>
                    {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="bg-muted/30 p-2 rounded-lg border flex items-center gap-3">
              <Label className="text-[10px] font-black px-2 text-primary uppercase">Date:</Label>
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 w-[140px] bg-background border-primary/20 text-xs font-bold"
              />
            </div>
            
            <Button size="lg" className="shadow-lg h-11" onClick={() => setIsDialogOpen(true)}>
              <PlusCircle className="mr-2 h-5 w-5" />
              Record Session
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-blue-50/50 border-blue-100 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-blue-600 flex items-center gap-2">
              <Car className="h-3.5 w-3.5" /> Practical Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-blue-700">{statsSummary.practical.toFixed(1)} <span className="text-xs font-normal">Hours</span></div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">
              {selectedBranch === 'All' ? 'School Total' : `At ${selectedBranch}`}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50/50 border-orange-100 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-orange-600 flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5" /> Theory Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-orange-700">{statsSummary.theory.toFixed(1)} <span className="text-xs font-normal">Hours</span></div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">
              {selectedBranch === 'All' ? 'School Total' : `At ${selectedBranch}`}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10 shadow-sm hidden lg:block">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2">
              <Calculator className="h-3.5 w-3.5" /> Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-primary">{(statsSummary.practical + statsSummary.theory).toFixed(1)} <span className="text-xs font-normal">Hours</span></div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">
              {selectedBranch === 'All' ? 'All Locations' : `At ${selectedBranch}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetPopup(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[90dvh] gap-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Record Student Session</DialogTitle>
            <DialogDescription>
              {selectedBranch !== "All" ? `Recording session for ${selectedBranch}` : 'Select student and class details.'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6 px-6 py-4 pb-32">
              {!selectedStudent ? (
                <div className="grid gap-2">
                  <Label>Select Student {selectedBranch !== "All" && <Badge variant="outline" className="ml-2 text-[10px] uppercase">{selectedBranch} only</Badge>}</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search Name, ID or Phone..." 
                      className="pl-8" 
                      value={studentSearch} 
                      onChange={(e) => setStudentSearch(e.target.value)} 
                    />
                  </div>
                  <div className="border rounded-lg mt-1 divide-y bg-background shadow-sm max-h-[300px] overflow-auto">
                    {filteredSearch.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground italic text-sm">
                        No active students found {selectedBranch !== "All" ? `in ${selectedBranch}` : ''}.
                      </div>
                    ) : (
                      filteredSearch.map(s => (
                        <div 
                          key={s.id} 
                          className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center transition-colors"
                          onClick={() => setSelectedStudent(s)}
                        >
                          <div className="flex items-center gap-3">
                            <UserCircle className="h-8 w-8 text-primary/40" />
                            <div className="grid">
                              <p className="font-bold text-sm">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">{s.id} • {s.branch}</p>
                            </div>
                          </div>
                          <Badge variant="outline">Select</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                        {selectedStudent.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-primary">{selectedStudent.name}</p>
                        <p className="text-xs font-mono uppercase tracking-tight">{selectedStudent.id}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)} className="h-8 w-8 p-0 rounded-full">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    <Label>Session Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {SESSION_TYPES.map(type => {
                        const Icon = type.icon;
                        const active = sessionType === type.value;
                        return (
                          <Button 
                            key={type.value}
                            variant={active ? 'default' : 'outline'}
                            className="h-12 flex items-center gap-2 justify-center"
                            onClick={() => setSessionType(type.value as any)}
                          >
                            <Icon className="h-4 w-4" />
                            {type.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {sessionType === 'Practical' && (
                    <div className="grid gap-2 animate-in slide-in-from-top-2">
                      <Label className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-primary" />
                        Assigned Vehicle
                      </Label>
                      <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select Vehicle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="None">No Vehicle Assigned</SelectItem>
                          {vehicles?.map(v => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.regNumber} ({v.brandModel})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>From Time</Label>
                      <Input 
                        type="time" 
                        value={startTime} 
                        onChange={(e) => setStartTime(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>To Time</Label>
                      <Input 
                        type="time" 
                        value={endTime} 
                        onChange={(e) => setEndTime(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg flex justify-between items-center border">
                    <span className="text-sm font-medium">Session Duration:</span>
                    <Badge variant="secondary" className="font-bold text-sm">
                      {calculateDuration(startTime, endTime)} Hours
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
            <Button 
              onClick={handleMarkAttendance} 
              className="w-full" 
              disabled={!selectedStudent}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm & Save Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Session Log</CardTitle>
              <CardDescription>
                {isStudent ? 'Historical training record' : `Records for ${headerDateDisplay} at ${selectedBranch === 'All' ? 'All Branches' : selectedBranch}`}
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-6">
              {sortedRecords.length} Sessions Found
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isAttendanceLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  {isStudent && <TableHead className="pl-6">Date</TableHead>}
                  {!isStudent && <TableHead className="pl-6">Student</TableHead>}
                  <TableHead>Session Type</TableHead>
                  <TableHead>Vehicle / Details</TableHead>
                  <TableHead>Timing</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Branch</TableHead>
                  {!isStaff ? null : <TableHead className="text-right pr-6">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isStudent ? 6 : 8} className="text-center py-20 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <CalendarIcon className="h-10 w-10 opacity-20" />
                        <p className="italic">No sessions logged for this period.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/20">
                      {isStudent && (
                        <TableCell className="pl-6 font-medium text-xs">
                          {record.date && isValid(new Date(record.date)) ? format(new Date(record.date), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                      )}
                      {!isStudent && (
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {record.studentName?.charAt(0) || 'S'}
                            </div>
                            <div className="grid gap-0.5">
                              <span className="font-bold text-sm leading-none">{record.studentName}</span>
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">{record.studentId}</span>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className={`gap-1.5 text-[10px] uppercase font-bold ${record.type === 'Theory' ? 'text-orange-600 bg-orange-50' : 'text-blue-600 bg-blue-50'}`}>
                          {record.type === 'Theory' ? <BookOpen className="h-3 w-3" /> : <Car className="h-3 w-3" />}
                          {record.type || 'Practical'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          {record.type === 'Theory' ? 'Classroom' : (
                            <>
                              <Car className="h-3 w-3" />
                              {record.vehicleReg || 'None'}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {record.startTime} - {record.endTime}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-bold bg-green-50 text-green-700 border-green-100 text-[10px]">
                          {record.duration}h
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">{record.branch}</Badge>
                      </TableCell>
                      {isStaff && (
                        <TableCell className="text-right pr-6">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive"
                            onClick={() => handleDeleteRecord(record.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
