
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc, setDocumentNonBlocking } from "@/firebase";
import { collection, doc, query, where, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, XCircle, Calendar as CalendarIcon, User, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function AttendancePage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState("");

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
    const map: Record<string, any> = {};
    attendanceRecords?.forEach(record => {
      map[record.studentId] = record;
    });
    return map;
  }, [attendanceRecords]);

  const handleMarkAttendance = (student: any, status: 'Present' | 'Absent') => {
    if (!db || !user || !profile) return;

    const attendanceId = `${student.id}_${selectedDate}`;
    const attendanceRef = doc(db, 'attendance', attendanceId);

    const record = {
      id: attendanceId,
      studentId: student.id,
      studentName: student.name,
      date: selectedDate,
      status: status,
      branch: student.branch,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    };

    setDocumentNonBlocking(attendanceRef, record, { merge: true });
    
    toast({
      title: "Attendance Updated",
      description: `${student.name} marked as ${status}.`
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Daily Attendance</h2>
          <p className="text-muted-foreground">
            {isAdmin ? 'Global school attendance records.' : `Attendance logs for ${profile?.branch}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Selected Date</Label>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 w-[160px]"
              />
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Attendance Sheet</CardTitle>
              <CardDescription>
                Records for {format(new Date(selectedDate), 'EEEE, MMMM do, yyyy')}
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
                  <TableHead>Student ID</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No students found for this selection.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => {
                    const record = attendanceMap[student.id];
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono text-xs font-bold">{student.id}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{student.name}</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{student.branch}</Badge></TableCell>
                        <TableCell>
                          {record ? (
                            <Badge className={record.status === 'Present' ? 'bg-green-500' : 'bg-destructive'}>
                              {record.status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Pending...</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant={record?.status === 'Present' ? 'default' : 'outline'}
                              className={record?.status === 'Present' ? 'bg-green-600 hover:bg-green-700' : 'text-green-600 border-green-200 hover:bg-green-50'}
                              onClick={() => handleMarkAttendance(student, 'Present')}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Present
                            </Button>
                            <Button 
                              size="sm" 
                              variant={record?.status === 'Absent' ? 'destructive' : 'outline'}
                              className={record?.status === 'Absent' ? '' : 'text-destructive border-red-200 hover:bg-red-50'}
                              onClick={() => handleMarkAttendance(student, 'Absent')}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Absent
                            </Button>
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
