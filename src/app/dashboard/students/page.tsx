'use client';

import { useState } from "react";
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
import { COURSE_PRICES, type Student } from "@/lib/mock-data";
import { MoreHorizontal, FileText, User, MapPin, Edit2, Eye, Trash2, Search, PlusCircle, Receipt, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";

const AVAILABLE_COURSES = Object.keys(COURSE_PRICES);
const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

export default function StudentsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'students');
  }, [db, user]);
  
  const { data: students, isLoading } = useCollection<Student>(studentsQuery);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<Student>>({
    branch: "Branch 1",
    status: "Active",
    courses: [],
    discount: 0,
  });

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
      
      // Also create the user role document required for security rules
      const userRef = doc(db, 'users', uid);
      setDocumentNonBlocking(userRef, {
        id: uid,
        email: email,
        role: 'Student',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid
      }, { merge: true });

      await deleteApp(secondaryApp);
      return uid;
    } catch (error: any) {
      console.error("Error creating student auth:", error);
      try { await deleteApp(secondaryApp); } catch {}
      throw error;
    }
  };

  const calculateFees = (courses: string[], discount: number) => {
    const baseAmount = courses.reduce((sum, course) => sum + (COURSE_PRICES[course] || 0), 0);
    return Math.max(0, baseAmount - (discount || 0));
  };

  const handleAddStudent = async () => {
    if (!formData.name || !formData.branch) {
      toast({ variant: "destructive", title: "Error", description: "Name and Branch are required." });
      return;
    }

    // Branch-specific ID generation: e.g., B1-00001
    const branchPrefix = formData.branch.split(' ')[1];
    const branchStudents = students?.filter(s => s.branch === formData.branch) || [];
    const nextNumber = branchStudents.length + 1;
    const studentId = `B${branchPrefix}-${String(nextNumber).padStart(5, '0')}`;
    
    const amount = calculateFees(formData.courses || [], formData.discount || 0);
    
    try {
      toast({ title: "Registering Student", description: `Generating ID ${studentId} and login...` });
      
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
      setFormData({ branch: "Branch 1", status: "Active", courses: [], discount: 0 });
      toast({ title: "Registration Successful", description: `User ID: ${studentId}, Pass: City123` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration Failed", description: error.message || "Could not create student." });
    }
  };

  const handleUpdateStudent = () => {
    if (!selectedStudent) return;
    const studentRef = doc(db, 'students', selectedStudent.id);
    
    const courses = formData.courses || [];
    const amount = calculateFees(courses, formData.discount || 0);

    const updatedData = { 
      ...formData, 
      amount,
      updatedAt: serverTimestamp()
    };
    
    updateDocumentNonBlocking(studentRef, updatedData);
    setIsEditDialogOpen(false);
    toast({ title: "Student Updated", description: "The student profile has been updated." });
  };

  const handleDeleteStudent = (id: string) => {
    const studentRef = doc(db, 'students', id);
    deleteDocumentNonBlocking(studentRef);
    toast({ variant: "destructive", title: "Student Deleted", description: "The student record has been removed." });
  };

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student);
    setFormData({ ...student });
    setIsEditDialogOpen(true);
  };

  const openProfile = (student: Student) => {
    setSelectedStudent(student);
    setIsProfileOpen(true);
  };

  const handleCourseToggle = (course: string) => {
    const currentCourses = formData.courses || [];
    if (currentCourses.includes(course)) {
      setFormData({ ...formData, courses: currentCourses.filter(c => c !== course) });
    } else {
      setFormData({ ...formData, courses: [...currentCourses, course] });
    }
  };

  const calculatePaidAmount = (student: Student) => {
    return student.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  };

  const calculateBalanceDue = (student: Student) => {
    return Math.max(0, (student.amount || 0) - calculatePaidAmount(student));
  };

  const handleExportCSV = () => {
    if (!students) return;
    const headers = ["ID", "Name", "Email", "Phone", "Status", "Branch", "Registration Date", "Aadhar", "Courses", "Total Fee", "Discount", "Amount Payable", "Balance Due"];
    const csvRows = [
      headers.join(','),
      ...students.map(s => [
        s.id,
        `"${s.name}"`,
        s.email,
        s.phone,
        s.status,
        s.branch,
        s.registrationDate,
        s.aadharNo || '',
        `"${s.courses.join('; ')}"`,
        (s.amount || 0) + (s.discount || 0),
        s.discount || 0,
        s.amount || 0,
        calculateBalanceDue(s)
      ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `citydrive_students_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast({ title: "Report Exported", description: "CSV downloaded successfully." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Students Database</CardTitle>
              <CardDescription>Automatic ID generation and login provisioning system.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search ID, Name or Mobile..."
                  className="pl-8 w-[200px] lg:w-[300px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={handleExportCSV}>
                <FileText className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setFormData({ branch: "Branch 1", status: "Active", courses: [], discount: 0 })}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Register Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>New Registration</DialogTitle>
                    <DialogDescription>Credentials will be auto-generated upon saving.</DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
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
                          <Input placeholder="Enter student name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Phone Number</Label>
                          <Input placeholder="Contact number" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Guardian Name</Label>
                          <Input placeholder="Parent/Guardian" value={formData.guardianName} onChange={(e) => setFormData({...formData, guardianName: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Aadhar Number</Label>
                        <Input placeholder="XXXX-XXXX-XXXX" value={formData.aadharNo} onChange={(e) => setFormData({...formData, aadharNo: e.target.value})} />
                      </div>
                      <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
                        <Label className="font-bold">Courses Selection</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {AVAILABLE_COURSES.map(course => (
                            <div key={course} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`add-course-${course}`} 
                                checked={formData.courses?.includes(course)} 
                                onCheckedChange={() => handleCourseToggle(course)}
                              />
                              <Label htmlFor={`add-course-${course}`} className="text-sm cursor-pointer">{course} (₹{COURSE_PRICES[course]})</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Discount (₹)</Label>
                          <Input type="number" value={formData.discount} onChange={(e) => setFormData({...formData, discount: Number(e.target.value)})} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Net Amount Payable</Label>
                          <div className="h-10 px-3 py-2 border rounded-md bg-muted text-sm font-bold flex items-center">
                            ₹{calculateFees(formData.courses || [], formData.discount || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Remarks</Label>
                        <Textarea value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})} />
                      </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter>
                    <Button onClick={handleAddStudent}>Complete Registration</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center py-8">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID & Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Fee (₹)</TableHead>
                  <TableHead>Balance Due (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No records found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={`https://picsum.photos/seed/${student.id}/40/40`} alt={student.name} />
                            <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="grid gap-0.5">
                            <span className="font-bold text-primary">{student.id}</span>
                            <span className="text-sm font-medium">{student.name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{student.branch}</TableCell>
                      <TableCell>
                        <Badge variant={student.status === 'Active' ? 'default' : 'secondary'}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell>₹{(student.amount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className={`text-sm font-bold ${calculateBalanceDue(student) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          ₹{calculateBalanceDue(student).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openProfile(student)}>
                              <Eye className="mr-2 h-4 w-4" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(student)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteStudent(student.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Updating details for {selectedStudent?.id}.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
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
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as any})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Full Name</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Guardian Name</Label>
                    <Input value={formData.guardianName} onChange={(e) => setFormData({...formData, guardianName: e.target.value})} />
                  </div>
                </div>
                <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
                  <Label className="font-bold">Courses Selection</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {AVAILABLE_COURSES.map(course => (
                      <div key={course} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`edit-course-${course}`} 
                          checked={formData.courses?.includes(course)} 
                          onCheckedChange={() => handleCourseToggle(course)}
                        />
                        <Label htmlFor={`edit-course-${course}`} className="text-sm cursor-pointer">{course}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Discount (₹)</Label>
                  <Input type="number" value={formData.discount} onChange={(e) => setFormData({...formData, discount: Number(e.target.value)})} />
                </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={handleUpdateStudent}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          {selectedStudent && (
            <ScrollArea className="h-full mt-6 pr-4">
              <div className="space-y-8 pb-10">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Avatar className="h-28 w-28">
                    <AvatarImage src={`https://picsum.photos/seed/${selectedStudent.id}/112/112`} />
                    <AvatarFallback>{selectedStudent.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedStudent.name}</h3>
                    <p className="text-sm font-bold text-primary uppercase tracking-widest">{selectedStudent.id}</p>
                    <Badge className="mt-2">{selectedStudent.status}</Badge>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2"><MapPin className="h-3 w-3" /> Address</p>
                    <p className="text-sm">{selectedStudent.address || 'Not provided'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2"><User className="h-3 w-3" /> Guardian</p>
                    <p className="text-sm">{selectedStudent.guardianName || 'Not provided'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Aadhar No.</p>
                    <p className="text-sm">{selectedStudent.aadharNo || 'Not provided'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Branch</p>
                    <p className="text-sm font-bold">{selectedStudent.branch}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Reg. Date</p>
                    <p className="text-sm">{selectedStudent.registrationDate}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Courses</p>
                    <p className="text-sm">{selectedStudent.courses.join(', ')}</p>
                  </div>
                </div>
                <div className="space-y-4">
                   <h4 className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Financial Breakdown</h4>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 border rounded-lg bg-muted/20">
                        <p className="text-xs text-muted-foreground">Payable Amount</p>
                        <p className="font-bold">₹{(selectedStudent.amount || 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 border rounded-lg bg-muted/20">
                        <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                        <p className="font-bold text-destructive">₹{calculateBalanceDue(selectedStudent).toLocaleString()}</p>
                      </div>
                   </div>
                </div>
                {selectedStudent.payments && selectedStudent.payments.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment History</h4>
                    <div className="space-y-2">
                      {selectedStudent.payments.map((p, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-lg text-sm">
                          <div>
                            <p className="font-medium">₹{p.amount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{p.receiptNo} • {p.method}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{p.date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Remarks</h4>
                  <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground italic">
                    {selectedStudent.remarks || "No additional remarks."}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}