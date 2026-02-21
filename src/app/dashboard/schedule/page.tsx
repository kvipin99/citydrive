
'use client';

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, orderBy, where } from "firebase/firestore";
import { format, isSameDay, addHours, startOfToday } from "date-fns";
import { PlusCircle, Calendar as CalendarIcon, Clock, User, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SchedulePage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("today");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Data Fetching
  const studentsQuery = useMemoFirebase(() => (db ? collection(db, 'students') : null), [db]);
  const instructorsQuery = useMemoFirebase(() => (db ? collection(db, 'instructors') : null), [db]);
  const classesQuery = useMemoFirebase(() => (db ? query(collection(db, 'classes'), orderBy('startTime', 'asc')) : null), [db]);

  const { data: students } = useCollection(studentsQuery);
  const { data: instructors } = useCollection(instructorsQuery);
  const { data: classes, isLoading } = useCollection(classesQuery);

  const [formData, setFormData] = useState({
    studentId: '',
    instructorId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    duration: '1',
    status: 'Scheduled' as const
  });

  const today = startOfToday();
  const todaysClasses = useMemo(() => classes?.filter(c => isSameDay(new Date(c.startTime), today)) || [], [classes, today]);
  const upcomingClasses = useMemo(() => classes?.filter(c => new Date(c.startTime) > today) || [], [classes, today]);

  const handleCreateClass = () => {
    if (!formData.studentId || !formData.instructorId) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please select both a student and an instructor." });
      return;
    }

    const selectedStudent = students?.find(s => s.id === formData.studentId);
    const selectedInstructor = instructors?.find(i => i.id === formData.instructorId);

    const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
    const endDateTime = addHours(startDateTime, parseInt(formData.duration));

    const classId = `CLS-${Date.now()}`;
    const classRef = doc(db, 'classes', classId);

    const newClass = {
      id: classId,
      studentId: formData.studentId,
      studentName: selectedStudent?.name || 'Unknown',
      instructorId: formData.instructorId,
      instructorName: selectedInstructor?.name || 'Unknown',
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      status: formData.status,
      createdAt: serverTimestamp(),
      createdBy: user?.uid
    };

    setDocumentNonBlocking(classRef, newClass, { merge: true });
    setIsAddDialogOpen(false);
    toast({ title: "Class Scheduled", description: `Lesson for ${selectedStudent?.name} has been added.` });
  };

  const handleUpdateStatus = (clsId: string, status: string) => {
    const classRef = doc(db, 'classes', clsId);
    updateDocumentNonBlocking(classRef, { status });
    toast({ title: "Status Updated", description: `Class marked as ${status}.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Class Scheduling</h2>
          <p className="text-muted-foreground">Manage and track instructor-led driving sessions.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Schedule Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule New Lesson</DialogTitle>
              <DialogDescription>Assign an instructor and student for a driving session.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Student</Label>
                <Select value={formData.studentId} onValueChange={(v) => setFormData({...formData, studentId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Student" /></SelectTrigger>
                  <SelectContent>
                    {students?.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.id})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Instructor</Label>
                <Select value={formData.instructorId} onValueChange={(v) => setFormData({...formData, instructorId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select Instructor" /></SelectTrigger>
                  <SelectContent>
                    {instructors?.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.id})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Duration (Hours)</Label>
                <Select value={formData.duration} onValueChange={(v) => setFormData({...formData, duration: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Hour</SelectItem>
                    <SelectItem value="2">2 Hours</SelectItem>
                    <SelectItem value="3">3 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateClass} className="w-full">Create Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="today">Today's Schedule</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="today" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Classes</CardTitle>
              <CardDescription>{format(today, "EEEE, MMMM do, yyyy")}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingState /> : <ClassList classes={todaysClasses} onStatusUpdate={handleUpdateStatus} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Classes</CardTitle>
              <CardDescription>Scheduled lessons for the future.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingState /> : <ClassList classes={upcomingClasses} onStatusUpdate={handleUpdateStatus} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Past Sessions</CardTitle>
              <CardDescription>Archive of all completed and canceled classes.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingState /> : <ClassList classes={classes?.filter(c => new Date(c.startTime) < today) || []} onStatusUpdate={handleUpdateStatus} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}

function ClassList({ classes, onStatusUpdate }: { classes: any[], onStatusUpdate: (id: string, status: string) => void }) {
  if (classes.length === 0) {
    return <p className="text-center py-12 text-muted-foreground italic">No classes found for this period.</p>;
  }

  return (
    <div className="space-y-4">
      {classes.map((c) => (
        <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <Avatar className="h-10 w-10 border-2 border-primary/10">
              <AvatarFallback className="bg-primary/5 text-primary"><User className="h-5 w-5" /></AvatarFallback>
            </Avatar>
            <div className="grid gap-0.5">
              <p className="font-bold">{c.studentName}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserCheck className="h-3 w-3" /> 
                Instructor: <span className="font-medium text-foreground">{c.instructorName}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 font-medium">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              {format(new Date(c.startTime), "MMM d")}
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 font-medium">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {format(new Date(c.startTime), 'p')} - {format(new Date(c.endTime), 'p')}
            </div>
            <Badge variant={c.status === 'Completed' ? 'default' : c.status === 'Canceled' ? 'destructive' : 'outline'} className="uppercase text-[10px]">
              {c.status}
            </Badge>
          </div>

          <div className="flex gap-2">
            {c.status === 'Scheduled' && (
              <>
                <Button size="sm" variant="outline" className="h-8 text-xs text-green-600 border-green-200 hover:bg-green-50" onClick={() => onStatusUpdate(c.id, 'Completed')}>
                  Mark Done
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:bg-destructive/10" onClick={() => onStatusUpdate(c.id, 'Canceled')}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
