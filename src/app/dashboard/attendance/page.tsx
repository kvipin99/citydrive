
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { collection, doc, query, where, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, Calendar as CalendarIcon, Search, RefreshCw, Clock, Trash2, PlusCircle, UserCircle, X, Car, BookOpen, Calculator, Filter, Users, UserSquare } from "lucide-react";
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
  const [instructorFilter, setInstructorFilter] = useState<string>("All");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [sessionType, setSessionType] = useState<'Practical' | 'Theory'>('Practical');
  
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>("");
  const [manualInstructorName, setManualInstructorName] = useState("");
  
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userProfileRef);
  
  const isStudent = profile?.role === 'Student';
  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';
  const isBranchManager = profile?.role === 'BranchManager';
  const isInstructor = profile?.role === 'Instructor';
  const isManagement = isAdmin || isBranchManager;
  const isStaff = isManagement || isInstructor;

  useEffect(() => {
    if (profile && !isAdmin) {
      setSelectedBranch(profile.branch || "Branch 1");
    }
    if (profile && !selectedInstructorId) {
      setSelectedInstructorId(user?.uid || "");
    }
  }, [profile?.branch, isAdmin, user?.uid, selectedInstructorId]);

  const vehiclesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'vehicles');
  }, [db, user?.uid]);
  const { data: vehicles } = useCollection(vehiclesQuery);

  const instructorsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'instructors');
  }, [db, user?.uid]);
  const { data: instructors } = useCollection(instructorsQuery);

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile?.role) return null;
    const base = collection(db, 'students');
    if (profile.role === 'Student') return query(base, where('userId', '==', user.uid));
    return base;
  }, [db, user?.uid, profile?.role]);

  const { data: allStudents, isLoading: isStudentsLoading } = useCollection(studentsQuery);

  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !user || !profile?.role) return null;
    const base = collection(db, 'attendance');
    if (profile.role === 'Student') return query(base, where('studentUid', '==', user.uid));
    if (isStaff) return query(base, where('date', '==', selectedDate));
    return null;
  }, [db, user?.uid, profile?.role, isStaff, selectedDate]);

  const { data: rawAttendance, isLoading: isAttendanceLoading } = useCollection(attendanceQuery);

  const isFromBranch = useCallback((record: any, branchName: string) => {
    if (!branchName || branchName === "All" || branchName === "Full") return true;
    
    const normalize = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';
    const rBranch = normalize(record.branch);
    const targetBranch = normalize(branchName);
    
    if (rBranch === targetBranch) return true;

    const branchNum = branchName.match(/\d+/)?.[0];
    if (branchNum) {
      const prefix = `B${branchNum}`;
      if (rBranch === prefix.toLowerCase()) return true;
      
      const rid = record.id || '';
      const sid = record.studentId || '';
      if (rid.startsWith(prefix) || rid.startsWith(`REC-${prefix}`) || rid.startsWith(`EXP-${prefix}`) || rid.startsWith(`MISC-${prefix}`)) return true;
      if (sid.startsWith(prefix)) return true;
    }
    return false;
  }, []);

  const filteredAttendance = useMemo(() => {
    if (!rawAttendance) return [];
    let result = rawAttendance;

    const currentBranchContext = isManagement ? selectedBranch : (profile?.branch || "Branch 1");
    if (currentBranchContext !== "All") {
      result = result.filter(rec => isFromBranch(rec, currentBranchContext));
    }

    if (instructorFilter !== "All") {
      if (instructorFilter === "Others") {
        const registeredIds = new Set(instructors?.map(i => i.userId) || []);
        result = result.filter(rec => !rec.instructorId || rec.instructorId === 'Manual' || !registeredIds.has(rec.instructorId));
      } else {
        result = result.filter(rec => rec.instructorId === instructorFilter);
      }
    }

    return result;
  }, [rawAttendance, selectedBranch, instructorFilter, profile?.branch, isManagement, isFromBranch, instructors]);

  const statsSummary = useMemo(() => {
    const uniquePractical = new Set();
    const uniqueTheory = new Set();
    
    const totals = (filteredAttendance || []).reduce((acc, curr) => {
      const hours = Number(curr.duration) || 0;
      if (curr.type === 'Theory') {
        acc.theoryHours += hours;
        uniqueTheory.add(curr.studentId);
      } else {
        acc.practicalHours += hours;
        uniquePractical.add(curr.studentId);
      }
      return acc;
    }, { practicalHours: 0, theoryHours: 0 });

    return {
      practicalHours: totals.practicalHours,
      theoryHours: totals.theoryHours,
      practicalCount: uniquePractical.size,
      theoryCount: uniqueTheory.size,
      totalUniqueStudents: new Set((filteredAttendance || []).map(a => a.studentId)).size
    };
  }, [filteredAttendance]);

  const filteredSearch = useMemo(() => {
    if (!allStudents) return [];
    // Strict isolation for search: Only global admins see all students in the dropdown
    const searchBranchContext = isAdmin ? "All" : (profile?.branch || "Branch 1");
    
    let result = allStudents.filter(s => s.status !== 'Completed' && s.status !== 'Inactive');
    if (searchBranchContext !== "All") {
      result = result.filter(s => isFromBranch(s, searchBranchContext));
    }
    
    if (!studentSearch) return result;
    const term = studentSearch.toLowerCase();
    return result.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.id.toLowerCase().includes(term) ||
      s.phone?.includes(term)
    );
  }, [allStudents, studentSearch, profile?.branch, isAdmin, isFromBranch]);

  const calculateDuration = (start: string, end: string) => {
    try {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      const startTotal = sH * 60 + sM;
      const endTotal = eH * 60 + eM;
      const diff = endTotal - startTotal;
      return Math.max(0, parseFloat((diff / 60).toFixed(1)));
    } catch (e) { return 0; }
  };

  const handleMarkAttendance = () => {
    if (!db || !user || !profile || !selectedStudent) return;

    const attendanceId = `${selectedStudent.id}_${selectedDate}_${startTime.replace(':', '')}_${sessionType.charAt(0)}`;
    const attendanceRef = doc(db, 'attendance', attendanceId);
    const duration = calculateDuration(startTime, endTime);
    const vehicle = vehicles?.find(v => v.id === selectedVehicleId);
    
    let instructorName = profile.name || "Unknown";
    let instructorId = user.uid;

    if (selectedInstructorId === 'Manual') {
      instructorName = manualInstructorName || "Manual Entry";
      instructorId = "Manual";
    } else if (selectedInstructorId) {
      const instr = instructors?.find(i => i.userId === selectedInstructorId);
      if (instr) {
        instructorName = instr.name;
        instructorId = instr.userId;
      }
    }

    const record = {
      id: attendanceId,
      studentId: selectedStudent.id,
      studentUid: selectedStudent.userId, 
      studentName: selectedStudent.name,
      instructorId,
      instructorName,
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
    toast({ title: "Attendance Recorded", description: `${selectedStudent.name} ${sessionType} session saved.` });
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
    setSelectedInstructorId(user?.uid || "");
    setManualInstructorName("");
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
            {isStudent ? 'My training sessions history.' : isManagement ? (selectedBranch === 'All' ? 'Global school training records.' : `Records for ${selectedBranch}`) : `Records for your branch.`}
          </p>
        </div>
        {!isStudent && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-muted/30 p-2 rounded-lg border flex items-center gap-2">
              <Label className="text-[10px] font-black px-2 text-primary uppercase flex items-center gap-1">
                <UserSquare className="h-3 w-3" /> Staff:
              </Label>
              <Select value={instructorFilter} onValueChange={setInstructorFilter}>
                <SelectTrigger className="h-9 w-[140px] bg-background border-primary/20 text-xs font-bold">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Instructors</SelectItem>
                  {instructors?.map(i => <SelectItem key={i.id} value={i.userId}>{i.name}</SelectItem>)}
                  <SelectItem value="Others">Manual Entries (Others)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isManagement && (
              <div className="bg-muted/30 p-2 rounded-lg border flex items-center gap-3">
                <Label className="text-[10px] font-black px-2 text-primary uppercase flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Branch:
                </Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!isAdmin}>
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
              <Car className="h-3.5 w-3.5" /> Practical Session Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-blue-700">{statsSummary.practicalHours.toFixed(1)} <span className="text-xs font-normal">Hours</span></div>
            <div className="flex items-center gap-1.5 text-blue-600/80 text-[10px] font-black uppercase mt-1">
              <Users className="h-3 w-3" /> {statsSummary.practicalCount} Students Attended
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50/50 border-orange-100 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-orange-600 flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5" /> Theory Session Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-orange-700">{statsSummary.theoryHours.toFixed(1)} <span className="text-xs font-normal">Hours</span></div>
            <div className="flex items-center gap-1.5 text-orange-600/80 text-[10px] font-black uppercase mt-1">
              <Users className="h-3 w-3" /> {statsSummary.theoryCount} Students Attended
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10 shadow-sm hidden lg:block">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase text-primary flex items-center gap-2">
              <Calculator className="h-3.5 w-3.5" /> Daily Overall Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-primary">{(statsSummary.practicalHours + statsSummary.theoryHours).toFixed(1)} <span className="text-xs font-normal">Total Hours</span></div>
            <div className="flex items-center gap-1.5 text-primary/80 text-[10px] font-black uppercase mt-1">
              <Users className="h-3 w-3" /> {statsSummary.totalUniqueStudents} Unique Students Total
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetPopup(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col h-[90dvh] max-h-[90dvh] gap-0">
          <DialogHeader className="p-6 border-b shrink-0 bg-muted/5">
            <DialogTitle>Record Student Session</DialogTitle>
            <DialogDescription>
              {isAdmin ? "Search all students to record training." : "Search branch students to record training."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-6 pb-24">
              {!selectedStudent ? (
                <div className="grid gap-2">
                  <Label className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Search Student {isAdmin ? "(Global)" : "(My Branch)"}
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Name, ID or Phone..." 
                      className="pl-8" 
                      value={studentSearch} 
                      onChange={(e) => setStudentSearch(e.target.value)} 
                    />
                  </div>
                  <div className="border rounded-xl mt-1 divide-y bg-background shadow-sm max-h-[400px] overflow-auto min-h-[100px]">
                    {isStudentsLoading ? (
                      <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-xs font-medium">Loading students...</p>
                      </div>
                    ) : filteredSearch.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground italic text-sm">
                        No matching students found.
                      </div>
                    ) : (
                      filteredSearch.map(s => (
                        <div 
                          key={s.id} 
                          className="p-4 hover:bg-primary/5 cursor-pointer flex justify-between items-center transition-colors group"
                          onClick={() => setSelectedStudent(s)}
                        >
                          <div className="flex items-center gap-3">
                            <UserCircle className="h-10 w-10 text-primary/30 group-hover:text-primary/60" />
                            <div className="grid">
                              <p className="font-black text-sm">{s.name}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">{s.id}</Badge>
                                <span className="text-[10px] text-muted-foreground uppercase font-bold">{s.branch}</span>
                              </div>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="text-primary font-bold text-[10px] uppercase">Select</Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white font-black text-lg shadow-sm">
                        {selectedStudent.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-primary leading-none mb-1">{selectedStudent.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-tight">{selectedStudent.id}</span>
                          <Badge variant="secondary" className="text-[9px] uppercase px-1 py-0">{selectedStudent.branch}</Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)} className="h-8 w-8 p-0 rounded-full border-primary/20">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Session Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {SESSION_TYPES.map(type => {
                        const Icon = type.icon;
                        const active = sessionType === type.value;
                        return (
                          <Button 
                            key={type.value}
                            variant={active ? 'default' : 'outline'}
                            className={`h-14 flex flex-col items-center gap-1 justify-center rounded-xl border-2 ${active ? 'border-primary shadow-md' : 'border-muted'}`}
                            onClick={() => setSessionType(type.value as any)}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase">{type.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Assigned Instructor</Label>
                    <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
                      <SelectTrigger className="h-11 border-2">
                        <SelectValue placeholder="Select Instructor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={user?.uid || ""}>Me ({profile?.name || 'Self'})</SelectItem>
                        {instructors?.filter(i => i.userId !== user?.uid).map(i => (
                          <SelectItem key={i.id} value={i.userId}>{i.name}</SelectItem>
                        ))}
                        <SelectItem value="Manual">Another Name (Manual Entry)</SelectItem>
                      </SelectContent>
                    </Select>
                    {selectedInstructorId === 'Manual' && (
                      <Input 
                        placeholder="Type Instructor Name" 
                        value={manualInstructorName} 
                        onChange={(e) => setManualInstructorName(e.target.value)}
                        className="h-11 border-2 animate-in fade-in slide-in-from-top-1"
                      />
                    )}
                  </div>

                  {sessionType === 'Practical' && (
                    <div className="grid gap-3 animate-in slide-in-from-top-2">
                      <Label className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                        <Car className="h-4 w-4 text-primary" />
                        Assigned Vehicle
                      </Label>
                      <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                        <SelectTrigger className="h-11 bg-background border-2">
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
                      <Label className="text-xs font-bold uppercase text-muted-foreground">From Time</Label>
                      <Input 
                        type="time" 
                        value={startTime} 
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-11 bg-background border-2"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">To Time</Label>
                      <Input 
                        type="time" 
                        value={endTime} 
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-11 bg-background border-2"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-2xl flex justify-between items-center border-2 border-dashed">
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Duration:</span>
                    <Badge variant="secondary" className="font-black text-sm px-3 py-1 bg-primary/10 text-primary border-primary/20">
                      {calculateDuration(startTime, endTime)} Hours
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-muted/10 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            <Button 
              onClick={handleMarkAttendance} 
              className="w-full h-12 text-base font-bold shadow-lg" 
              disabled={!selectedStudent}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Confirm & Save Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Session Log</CardTitle>
              <CardDescription>
                {isStudent ? 'Historical training record' : `Records for ${headerDateDisplay} at ${selectedBranch === 'All' ? 'All Branches' : selectedBranch}`}
              </CardDescription>
            </div>
            <Badge variant="outline" className="h-6 font-bold">
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
                  <TableHead>Instructor</TableHead>
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
                    <TableCell colSpan={isStudent ? 7 : 9} className="text-center py-20 text-muted-foreground">
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
                        <div className="flex items-center gap-2">
                          <UserSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">{record.instructorName || 'Unknown'}</span>
                        </div>
                      </TableCell>
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
