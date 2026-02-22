"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, XCircle, Calendar as CalendarIcon, User, Search, RefreshCw, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const TIME_OPTIONS = Array.from({ length: 18 }, (_, i) => {
  const hour = i + 6; // Start from 6 AM
  const period = hour >= 12 ? (hour === 24 ? 'AM' : 'PM') : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour;
  const value = `${String(hour).padStart(2, '0')}:00`;
  const label = `${displayHour}:00 ${period}`;
  return { value, label, hour };
});

export default function AttendancePage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState("");
  const [globalStartTime, setGlobalStartTime] = useState("09:00");
  const [globalEndTime, setGlobalEndTime] = useState("10:00");

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  // Fetch Students for this branch
  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isAdmin) return collection(db, 'students');
    return query(collection(db, 'students'), where('branch', '==', profile.branch));
  }, [db, user, profile, isAdmin]);

  const { data: students, isLoading: isStudentsLoading } = useCollection(studentsQuery);

  // Fetch Attendance for this branch and date
  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isAdmin) return query(collection(db, 'attendance'), where('date', '==', selectedDate));
    return query(
      collection(db, 'attendance'), 
      where('branch', '==', profile.branch),
      where('date', '==', selectedDate)
    );
  }, [db, user, profile, isAdmin, selectedDate]);

  const { data: attendanceRecords, isLoading: isAttendanceLoading } = useCollection(attendanceQuery);

  const filteredStudents = useMemo(() => {
    return students?.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.id.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];
  }, [students, searchQuery]);

  const attendanceMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    attendanceRecords?.forEach(record => {
      if (!map[record.studentId]) map[record.studentId] = [];
      map[record.studentId].push(record);
    });
    return map;
  }, [attendanceRecords]);

  const handleMarkAttendance = (student: any, status: 'Present' | 'Absent', startTime?: string, endTime?: string) => {
    if (!db || !user || !profile) return;

    // For multiple sessions, we include startTime in ID to allow uniqueness
    const attendanceId = status === 'Present' 
      ? `${student.id}_${selectedDate}_${startTime?.replace(':', '')}` 
      : `${student.id}_${selectedDate}_ABSENT`;
      
    const attendanceRef = doc(db, 'attendance', attendanceId);

    let duration = 0;
    if (startTime && endTime) {
      const startH = parseInt(startTime.split(':')[0]);
      const endH = parseInt(endTime.split(':')[0]);
      duration = Math.max(0, endH - startH);
    }

    const record = {
      id: attendanceId,
      studentId: student.id,
      studentName: student.name,
      date: selectedDate,
      status: status,
      startTime: status === 'Present' ? startTime : null,
      endTime: status === 'Present' ? endTime : null,
      duration: status === 'Present' ? duration : 0,
      branch: student.branch,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    };

    setDocumentNonBlocking(attendanceRef, record, { merge: true });
    
    toast({
      title: "Attendance Recorded",
      description: `${student.name} marked as ${status}${status === 'Present' ? ` (${duration} Hrs)` : ''}.`
    });
  };

  const handleDeleteRecord = (recordId: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'attendance', recordId));
    toast({ title: "Record Removed" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Daily Attendance</h2>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? 'Global school attendance records.' : `Attendance logs for ${profile?.branch}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-muted/30 p-3 rounded-xl border">
          <div className="grid gap-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Select Date</Label>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 w-[150px] bg-background"
              />
            </div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-border mx-2" />
          <div className="grid gap-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Default Session Time</Label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <Select value={globalStartTime} onValueChange={setGlobalStartTime}>
                <SelectTrigger className="h-9 w-[110px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs font-bold text-muted-foreground">to</span>
              <Select value={globalEndTime} onValueChange={setGlobalEndTime}>
                <SelectTrigger className="h-9 w-[110px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Student Session Log</CardTitle>
              <CardDescription>
                Marking records for {format(new Date(selectedDate), 'EEEE, MMMM do, yyyy')}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-[300px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Student..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isStudentsLoading || isAttendanceLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID & Name</TableHead>
                  <TableHead>History for Today</TableHead>
                  <TableHead className="text-right">New Session Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                      No students found for this selection.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => {
                    const records = attendanceMap[student.id] || [];
                    const isAbsent = records.some(r => r.status === 'Absent');
                    
                    return (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="grid gap-0.5">
                            <span className="font-bold text-primary text-sm">{student.id}</span>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium text-sm">{student.name}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {records.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic">No sessions logged.</span>
                            ) : (
                              records.map((r) => (
                                <Badge 
                                  key={r.id} 
                                  variant={r.status === 'Present' ? 'default' : 'destructive'}
                                  className={`flex items-center gap-1.5 py-1 ${r.status === 'Present' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                                >
                                  {r.status === 'Present' ? (
                                    <>
                                      <Clock className="h-3 w-3" />
                                      {r.startTime} - {r.endTime} ({r.duration}h)
                                    </>
                                  ) : (
                                    'Absent'
                                  )}
                                  <button onClick={() => handleDeleteRecord(r.id)} className="ml-1 hover:text-white/70">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              onClick={() => handleMarkAttendance(student, 'Present', globalStartTime, globalEndTime)}
                              disabled={isAbsent}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Add Present Session
                            </Button>
                            {!isAbsent && records.length === 0 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-destructive border-red-200 hover:bg-red-50"
                                onClick={() => handleMarkAttendance(student, 'Absent')}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Mark Absent
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
