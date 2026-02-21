
'use client';

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking, useUser } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { type Student } from "@/lib/mock-data";
import { MoreHorizontal, FileText, User, MapPin, Edit2, Eye, Trash2, Search, PlusCircle, Receipt, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

export default function StudentsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'students');
  }, [db, user]);

  const coursesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'courses');
  }, [db, user]);
  
  const { data: students, isLoading: isStudentsLoading } = useCollection<Student>(studentsQuery);
  const { data: masterCourses, isLoading: isCoursesLoading } = useCollection<any>(coursesQuery);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [formData, setFormData] = useState<Partial<Student>>({
    branch: "Branch 1",
    status: "Active",
    courses: [],
    discount: 0,
    specialCourseFee: 0,
    specialCourseName: "",
  });

  const coursePriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    masterCourses?.forEach(c => { map[c.name] = c.amount; });
    return map;
  }, [masterCourses]);

  const filteredStudents = students?.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery)
  ) || [];

  const createStudentAuth = async (studentId: string) => {
    const email = `${studentId}@citydriving.in`;
    const password = "City123";
    const secondaryAppName = `secondary-${studentId}-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;
      
      const userRef = doc(db, 'users', uid);
      setDocumentNonBlocking(userRef, {
        id: uid,
        email: email,
        role: 'Student',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await deleteApp(secondaryApp);
      return uid;
    } catch (error: any) {
      try { await deleteApp(secondaryApp); } catch {}
      throw error;
    }
  };

  const calculateFees = (courses: string[], discount: number, specialFee: number = 0) => {
    const baseAmount = courses.reduce((sum, courseName) => sum + (coursePriceMap[courseName] || 0), 0);
    const totalWithSpecial = baseAmount + (courses.includes("Other Special Course") ? (specialFee || 0) : 0);
    return Math.max(0, totalWithSpecial - (discount || 0));
  };

  const handleAddStudent = async () => {
    if (!formData.name || !formData.branch) {
      toast({ variant: "destructive", title: "Error", description: "Name and Branch are required." });
      return;
    }

    const branchPrefix = formData.branch.split(' ')[1];
    const branchStudents = students?.filter(s => s.branch === formData.branch) || [];
    const nextNumber = branchStudents.length + 1;
    const studentId = `B${branchPrefix}-${String(nextNumber).padStart(5, '0')}`;
    
    const amount = calculateFees(formData.courses || [], formData.discount || 0, formData.specialCourseFee || 0);
    
    try {
      toast({ title: "Registering Student", description: `Generating ID ${studentId}...` });
      const authUid = await createStudentAuth(studentId);
      
      const newStudentData = {
        ...formData,
        id: studentId,
        userId: authUid,
        amount,
        registrationDate: new Date().toISOString().split('T')[0],
        payments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid
      };

      const studentRef = doc(db, 'students', studentId);
      setDocumentNonBlocking(studentRef, newStudentData, { merge: true });

      setIsAddDialogOpen(false);
      setFormData({ branch: "Branch 1", status: "Active", courses: [], discount: 0, specialCourseFee: 0, specialCourseName: "" });
      toast({ title: "Success", description: `Account created for ${studentId}.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    }
  };

  const handleUpdateStudent = () => {
    if (!selectedStudent) return;
    const studentRef = doc(db, 'students', selectedStudent.id);
    
    // Note: We don't automatically recalculate 'amount' if prices in coursePriceMap changed, 
    // unless the admin specifically changes the courses/discount here. 
    // This honors the "cannot change old amount" requirement.
    const updatedData = { 
      ...formData, 
      updatedAt: serverTimestamp()
    };
    
    updateDocumentNonBlocking(studentRef, updatedData);
    setIsEditDialogOpen(false);
    toast({ title: "Student Updated" });
  };

  const handleCourseToggle = (course: string) => {
    const currentCourses = formData.courses || [];
    let newCourses;
    if (currentCourses.includes(course)) {
      newCourses = currentCourses.filter(c => c !== course);
    } else {
      newCourses = [...currentCourses, course];
    }
    
    // If it's a NEW registration, update the amount dynamically
    const newAmount = calculateFees(newCourses, formData.discount || 0, formData.specialCourseFee || 0);
    setFormData({ ...formData, courses: newCourses, amount: newAmount });
  };

  const calculateBalanceDue = (student: Student) => {
    const paid = student.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    return Math.max(0, (student.amount || 0) - paid);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Students Database</CardTitle>
              <CardDescription>Live pricing sourced from Course Catalog.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ID, Name or Mobile..."
                  className="pl-8 w-[200px] lg:w-[300px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setFormData({ branch: "Branch 1", status: "Active", courses: [], discount: 0, specialCourseFee: 0, specialCourseName: "", amount: 0 })}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Register Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>New Registration</DialogTitle>
                    <DialogDescription>Fees are auto-calculated based on current master pricing.</DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-[70vh] pr-4">
                    <div className="grid gap-6 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Branch</Label>
                          <Select value={formData.branch} onValueChange={(v) => setFormData({...formData, branch: v as any})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Full Name</Label>
                          <Input placeholder="Enter student name" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
                        <Label className="font-bold">Courses Selection</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {masterCourses?.map(course => (
                            <div key={course.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`add-course-${course.id}`} 
                                checked={formData.courses?.includes(course.name)} 
                                onCheckedChange={() => handleCourseToggle(course.name)}
                              />
                              <Label htmlFor={`add-course-${course.id}`} className="text-sm cursor-pointer">{course.name} (₹{course.amount})</Label>
                            </div>
                          ))}
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="add-course-special" 
                              checked={formData.courses?.includes("Other Special Course")} 
                              onCheckedChange={() => handleCourseToggle("Other Special Course")}
                            />
                            <Label htmlFor="add-course-special" className="text-sm cursor-pointer text-primary font-medium">Other Special Course</Label>
                          </div>
                        </div>
                        {formData.courses?.includes("Other Special Course") && (
                          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                            <div className="grid gap-2">
                              <Label>Special Course Name</Label>
                              <Input placeholder="Enter course name" value={formData.specialCourseName} onChange={(e) => setFormData({...formData, specialCourseName: e.target.value})} />
                            </div>
                            <div className="grid gap-2">
                              <Label>Special Course Fee (₹)</Label>
                              <Input type="number" value={formData.specialCourseFee} onChange={(e) => {
                                const fee = Number(e.target.value);
                                setFormData({...formData, specialCourseFee: fee, amount: calculateFees(formData.courses || [], formData.discount || 0, fee)});
                              }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Discount (₹)</Label>
                          <Input type="number" value={formData.discount} onChange={(e) => {
                             const disc = Number(e.target.value);
                             setFormData({...formData, discount: disc, amount: calculateFees(formData.courses || [], disc, formData.specialCourseFee || 0)});
                          }} />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-primary font-bold">Total Payable Amount</Label>
                          <div className="h-10 px-3 py-2 border rounded-md bg-primary/10 text-primary font-bold flex items-center">
                            ₹{formData.amount?.toLocaleString() || '0'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter>
                    <Button onClick={handleAddStudent}>Confirm Registration</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isStudentsLoading || isCoursesLoading ? (
             <div className="flex justify-center py-8">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID & Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Agreed Fee (₹)</TableHead>
                  <TableHead>Balance Due (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <span className="font-bold text-primary">{student.id}</span>
                          <span className="text-sm">{student.name}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{student.branch}</TableCell>
                    <TableCell>₹{(student.amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${calculateBalanceDue(student) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                        ₹{calculateBalanceDue(student).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedStudent(student); setIsProfileOpen(true); }}><Eye className="mr-2 h-4 w-4" /> View Profile</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedStudent(student); setFormData({ ...student }); setIsEditDialogOpen(true); }}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'students', student.id))}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Profile & Edit Dialogs remain similarly structured, refactored to use dynamic pricing labels */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          {selectedStudent && (
             <ScrollArea className="h-full mt-6 pr-4">
               <div className="space-y-6 pb-10">
                 <div className="text-center">
                    <Avatar className="h-20 w-20 mx-auto mb-4">
                      <AvatarFallback>{selectedStudent.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedStudent.id}</p>
                 </div>
                 <Separator />
                 <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="font-semibold">Phone</p><p>{selectedStudent.phone}</p></div>
                    <div><p className="font-semibold">Branch</p><p>{selectedStudent.branch}</p></div>
                    <div><p className="font-semibold">Registered</p><p>{selectedStudent.registrationDate}</p></div>
                    <div><p className="font-semibold">Status</p><p>{selectedStudent.status}</p></div>
                 </div>
                 <div className="space-y-2">
                    <p className="text-sm font-semibold">Enrolled Courses</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedStudent.courses.map(c => <Badge key={c} variant="outline">{c}</Badge>)}
                    </div>
                 </div>
                 <div className="p-4 border rounded-lg bg-primary/5 space-y-3">
                    <div className="flex justify-between font-bold"><span>Total Agreed Fee</span><span>₹{selectedStudent.amount.toLocaleString()}</span></div>
                    <div className="flex justify-between text-destructive font-bold"><span>Remaining Balance</span><span>₹{calculateBalanceDue(selectedStudent).toLocaleString()}</span></div>
                 </div>
               </div>
             </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Note: Historical fees (Agreed Amount) are preserved unless updated manually.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Full Name</Label><Input value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
                <div className="grid gap-2"><Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Completed">Completed</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Total Agreed Fee (₹)</Label>
                <Input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} />
              </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateStudent}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
