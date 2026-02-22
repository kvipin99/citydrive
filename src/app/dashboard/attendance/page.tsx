
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { collection, doc, query, where, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, Calendar as CalendarIcon, Search, RefreshCw, Clock, Trash2, PlusCircle, UserCircle, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const TIME_OPTIONS = Array.from({ length: 18 }, (_, i) => {
  const hour = i + 6; // Start from 6 AM
  const period = hour >= 12 ? (hour === 24 ? 'AM' : (hour === 12 ? 'PM' : 'PM')) : 'AM';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  const value = `${String(hour).padStart(2, '0')}:00`;
  const label = `${displayHour}:00 ${period}`;
  return { value, label, hour };
});

export default function AttendancePage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';
  const isStudent = profile?.role === 'Student';

  // Fetch Students for search (filtered by branch if not admin)
  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isStudent) return query(collection(db, 'students'), where('userId', '==', user.uid));
    if (isAdmin) return collection(db, 'students');
    if (!profile.branch) return null;
    return query(
      collection(db, 'students'), 
      where('branch', '==', profile.branch)
    );
  }, [db, user, profile, isAdmin, isStudent]);

  const { data: students } = useCollection(studentsQuery);

  // Fetch Attendance records
  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isStudent) {
      const studentId = students?.[0]?.id;
      if (!studentId) return null;
      return query(collection(db, 'attendance'), where('studentId', '==', studentId));
    }
    if (isAdmin) return query(collection(db, 'attendance'), where('date', '==', selectedDate));
    if (!profile.branch) return null;
    return query(
      collection(db, 'attendance'), 
      where('branch', '==', profile.branch),
      where('date', '==', selectedDate)
    );
  }, [db, user, profile, isAdmin, isStudent, selectedDate, students]);

  const { data: attendanceRecords, isLoading: isAttendanceLoading } = useCollection(attendanceQuery);

  const filteredSearch = useMemo(() => {
    if (!students) return [];
    
    // Filter out students who have completed their courses
    const activeOnes = students.filter(s => s.status !== 'Completed');

    if (!studentSearch) return activeOnes;

    const term = studentSearch.toLowerCase();
    return activeOnes.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.id.toLowerCase().includes(term) ||
      s.phone?.includes(term)
    );
  }, [students, studentSearch]);

  const handleMarkAttendance = () => {
    if (!db || !user || !profile || !selectedStudent) return;

    const attendanceId = `${selectedStudent.id}_${selectedDate}_${startTime.replace(':', '')}`;
    const attendanceRef = doc(db, 'attendance', attendanceId);

    const startH = parseInt(startTime.split(':')[0]);
    const endH = parseInt(endTime.split(':')[0]);
    const duration = Math.max(0, endH - startH);

    const record = {
      id: attendanceId,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      date: selectedDate,
      status: 'Present',
      startTime,
      endTime,
      duration,
      branch: selectedStudent.branch,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    };

    setDocumentNonBlocking(attendanceRef, record, { merge: true });
    
    toast({
      title: "Attendance Recorded",
      description: `${selectedStudent.name} session saved (${duration} Hrs).`
    });

    setIsDialogOpen(false);
    resetPopup();
  };

  const resetPopup = () => {
    setStudentSearch("");
    setSelectedStudent(null);
    setStartTime("09:00");
    setEndTime("10:00");
  };

  const handleDeleteRecord = (recordId: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'attendance', recordId));
    toast({ title: "Record Removed" });
  };

  const sortedRecords = useMemo(() => {
    return attendanceRecords?.sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime)) || [];
  }, [attendanceRecords]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Attendance Log</h2>
          <p className="text-muted-foreground text-sm">
            {isStudent ? 'My training sessions history.' : isAdmin ? 'Global school attendance records.' : `Attendance logs for ${profile?.branch || 'Loading...'}.`}
          </p>
        </div>
        {!isStudent && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-muted/30 p-2 rounded-lg border flex items-center gap-3">
              <Label className="text-xs font-bold px-2">DATE:</Label>
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 w-[150px] bg-background border-primary/20"
              />
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetPopup(); }}>
              <DialogTrigger asChild>
                <Button size="lg" className="shadow-lg">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Record Session
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Record Student Session</DialogTitle>
                  <DialogDescription>Select a student and log their training time.</DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                  {!selectedStudent ? (
                    <div className="grid gap-2">
                      <Label>Search or Select Student</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search Name, ID or Phone..." 
                          className="pl-8" 
                          value={studentSearch} 
                          onChange={(e) => setStudentSearch(e.target.value)} 
                        />
                      </div>
                      <ScrollArea className="h-[300px] border rounded-lg mt-1">
                        {filteredSearch.length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground italic text-sm">
                            No students found.
                          </div>
                        ) : (
                          <div className="divide-y">
                            {filteredSearch.map(s => (
                              <div 
                                key={s.id} 
                                className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center transition-colors"
                                onClick={() => setSelectedStudent(s)}
                              >
                                <div className="flex items-center gap-3">
                                  <UserCircle className="h-8 w-8 text-primary/40" />
                                  <div className="grid">
                                    <p className="font-bold text-sm">{s.name}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{s.id} • {s.phone}</p>
                                  </div>
                                </div>
                                <Badge variant="outline">Select</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
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
                            <p className="text-xs font-mono">{selectedStudent.id}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)} className="h-8 w-8 p-0 rounded-full">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>From Time</Label>
                          <Select value={startTime} onValueChange={setStartTime}>
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>To Time</Label>
                          <Select value={endTime} onValueChange={setEndTime}>
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="p-3 bg-muted/50 rounded-lg flex justify-between items-center border">
                        <span className="text-sm font-medium">Session Duration:</span>
                        <Badge variant="secondary" className="font-bold text-sm">
                          {Math.max(0, parseInt(endTime.split(':')[0]) - parseInt(startTime.split(':')[0]))} Hours
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
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
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Session Log</CardTitle>
              <CardDescription>
                {isStudent ? 'Historical training record' : `Training sessions recorded for ${format(new Date(selectedDate), 'EEEE, MMMM do')}`}
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
                  <TableHead>Session Timing</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Branch</TableHead>
                  {!isStudent && <TableHead className="text-right pr-6">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <CalendarIcon className="h-10 w-10 opacity-20" />
                        <p className="italic">No sessions logged.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/20">
                      {isStudent && (
                        <TableCell className="pl-6 font-medium">
                          {format(new Date(record.date), 'MMM dd, yyyy')}
                        </TableCell>
                      )}
                      {!isStudent && (
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {record.studentName?.charAt(0) || 'S'}
                            </div>
                            <div className="grid gap-0.5">
                              <span className="font-bold text-sm">{record.studentName}</span>
                              <span className="text-[10px] text-muted-foreground uppercase font-mono">{record.studentId}</span>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {record.startTime} - {record.endTime}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-bold bg-green-50 text-green-700 border-green-100">
                          {record.duration}h
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">{record.branch}</Badge>
                      </TableCell>
                      {!isStudent && (
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
