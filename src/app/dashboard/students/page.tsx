
'use client';

import { useState, useMemo, useRef, useEffect } from "react";
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
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp, getDoc, getDocs, Timestamp, query, where } from "firebase/firestore";
import { type Student } from "@/lib/mock-data";
import { MoreHorizontal, User, MapPin, Edit2, Eye, Trash2, Search, PlusCircle, Receipt, Download, Upload, ArrowDownCircle, Phone, Calendar, Hash, Mail, ClipboardList, Camera, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { format } from "date-fns";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

export default function StudentsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isAdmin) {
      return collection(db, 'students');
    }
    return query(collection(db, 'students'), where('branch', '==', profile.branch));
  }, [db, user, profile, isAdmin]);

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
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [paymentData, setPaymentData] = useState({
    amount: 0,
    receiptNo: '',
    method: 'Cash' as const,
    date: new Date().toISOString().split('T')[0]
  });

  const [formData, setFormData] = useState<Partial<Student>>({
    branch: "",
    status: "Active",
    courses: [],
    discount: 0,
    specialCourseFee: 0,
    specialCourseName: "",
    name: "",
    phone: "",
    address: "",
    parentName: "",
    aadharNo: "",
    onlineAppNo: "",
    learnersDate: "",
    testDate: "",
    remarks: "",
    photoUrl: ""
  });

  useEffect(() => {
    if (profile && !formData.branch) {
      const defaultBranch = profile.role === 'Admin' ? "Branch 1" : (profile.branch || "Branch 1");
      setFormData(prev => ({ ...prev, branch: defaultBranch }));
    }
  }, [profile, formData.branch]);

  const coursePriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    masterCourses?.forEach(c => { map[c.name] = c.amount; });
    return map;
  }, [masterCourses]);

  const filteredStudents = useMemo(() => {
    return students?.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone?.includes(searchQuery)
    ) || [];
  }, [students, searchQuery]);

  const generateBranchStudentId = (branchName: string) => {
    const branchPart = branchName.split(' ')[1] || "X";
    const prefix = `B${branchPart}-`;
    const branchStudents = students?.filter(s => s.branch === branchName) || [];
    const maxNumber = branchStudents.reduce((max, s) => {
      const parts = s.id.split('-');
      if (parts.length < 2) return max;
      const num = parseInt(parts[1], 10);
      return !isNaN(num) && num > max ? num : max;
    }, 1000); 
    return `${prefix}${maxNumber + 1}`;
  };

  const calculateFees = (courses: string[], discount: number, specialFee: number = 0) => {
    const baseAmount = courses.reduce((sum, courseName) => sum + (coursePriceMap[courseName] || 0), 0);
    const totalWithSpecial = baseAmount + (courses.includes("Other Special Course") ? (specialFee || 0) : 0);
    return Math.max(0, totalWithSpecial - (discount || 0));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'image/jpeg') {
      toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a JPEG image." });
      return;
    }
    if (file.size > 200 * 1024) {
      toast({ variant: "destructive", title: "File Too Large", description: "Image must be less than 200 KB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData({ ...formData, photoUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const createStudentAuth = async (studentId: string) => {
    const email = `${studentId.toLowerCase()}@citydriving.in`;
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

  const handleAddStudent = async () => {
    if (!formData.name || !formData.branch) {
      toast({ variant: "destructive", title: "Error", description: "Name and Branch are required." });
      return;
    }

    setIsSubmitting(true);
    const branchName = formData.branch;
    const studentId = generateBranchStudentId(branchName);
    const amount = calculateFees(formData.courses || [], formData.discount || 0, formData.specialCourseFee || 0);
    
    try {
      toast({ title: "Registering Student", description: `Generating ID ${studentId} for ${branchName}...` });
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
        createdBy: user?.uid,
      };

      const studentRef = doc(db, 'students', studentId);
      setDocumentNonBlocking(studentRef, newStudentData, { merge: true });

      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: `Student ${studentId} registered at ${branchName}.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStudent = () => {
    if (!selectedStudent) return;
    const studentRef = doc(db, 'students', selectedStudent.id);
    const updatedData = { 
      ...formData, 
      updatedAt: serverTimestamp()
    };
    updateDocumentNonBlocking(studentRef, updatedData);
    setIsEditDialogOpen(false);
    toast({ title: "Student Updated" });
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Unauthorized", description: "Only admins can delete student records." });
      return;
    }

    if (!confirm(`Permanently Delete ${student.name} (#${student.id})? This will remove all payments and login records. THIS ACTION CANNOT BE UNDONE.`)) {
      return;
    }

    setIsSubmitting(true);
    toast({ title: "Removing Student", description: "Wiping all records from system..." });

    try {
      // 1. Delete all payments
      const paymentsCol = collection(db, 'payments');
      const q = query(paymentsCol, where('studentId', '==', student.id));
      const paymentSnaps = await getDocs(q);
      paymentSnaps.forEach((p) => deleteDocumentNonBlocking(doc(db, 'payments', p.id)));

      // 2. Attempt Auth cleanup (Best effort)
      if (student.id) {
        const studentEmail = `${student.id.toLowerCase()}@citydriving.in`;
        const secondaryAppName = `cleanup-${student.id}-${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        try {
          const cred = await signInWithEmailAndPassword(secondaryAuth, studentEmail, "City123");
          await deleteUser(cred.user);
        } catch (authErr) {
          console.warn("Auth cleanup failed (possibly changed password):", authErr);
        } finally {
          await deleteApp(secondaryApp);
        }
      }

      // 3. Delete Firestore Records
      deleteDocumentNonBlocking(doc(db, 'students', student.id));
      if (student.userId) {
        deleteDocumentNonBlocking(doc(db, 'users', student.userId));
      }

      toast({ title: "Student Deleted", description: "All data has been removed from the database." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Delete Failed", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    const defaultBranch = profile?.role === 'Admin' ? "Branch 1" : (profile?.branch || "Branch 1");
    setFormData({ 
      branch: defaultBranch, 
      status: "Active", 
      courses: [], 
      discount: 0, 
      specialCourseFee: 0, 
      specialCourseName: "", 
      amount: 0,
      name: "",
      phone: "",
      address: "",
      parentName: "",
      aadharNo: "",
      onlineAppNo: "",
      learnersDate: "",
      testDate: "",
      remarks: "",
      photoUrl: ""
    });
  };

  const handleCourseToggle = (course: string) => {
    const currentCourses = formData.courses || [];
    let newCourses;
    if (currentCourses.includes(course)) {
      newCourses = currentCourses.filter(c => c !== course);
    } else {
      newCourses = [...currentCourses, course];
    }
    const newAmount = calculateFees(newCourses, formData.discount || 0, formData.specialCourseFee || 0);
    setFormData({ ...formData, courses: newCourses, amount: newAmount });
  };

  const calculateBalanceDue = (student: Student) => {
    const paid = student.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
    return Math.max(0, (student.amount || 0) - paid);
  };

  const handleReceivePayment = async () => {
    if (!selectedStudent || paymentData.amount <= 0 || !paymentData.receiptNo) {
      toast({ variant: "destructive", title: "Error", description: "Complete all fields." });
      return;
    }

    const payId = `PAY-${Date.now()}`;
    const paymentRef = doc(db, 'payments', payId);
    const studentRef = doc(db, 'students', selectedStudent.id);
    const transactionDate = new Date(paymentData.date);

    const paymentRecord = {
      id: payId,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      studentPhone: selectedStudent.phone,
      amount: paymentData.amount,
      date: Timestamp.fromDate(transactionDate),
      receiptNo: paymentData.receiptNo,
      method: paymentData.method,
      branch: selectedStudent.branch,
      receivedBy: user?.uid,
    };

    setDocumentNonBlocking(paymentRef, paymentRecord, { merge: true });
    
    try {
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        const currentPayments = studentSnap.data().payments || [];
        const updatedPayments = [
          ...currentPayments,
          {
            id: payId,
            amount: paymentData.amount,
            date: transactionDate.toISOString(),
            receiptNo: paymentData.receiptNo,
            method: paymentData.method,
          }
        ];
        updateDocumentNonBlocking(studentRef, {
          payments: updatedPayments,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error("Failed to update student payments array:", e);
    }

    setIsPaymentDialogOpen(false);
    setPaymentData({ 
      amount: 0, 
      receiptNo: '', 
      method: 'Cash',
      date: new Date().toISOString().split('T')[0]
    });
    toast({ title: "Payment Recorded", description: `Receipt #${paymentData.receiptNo} saved.` });
  };

  const handleExportCSV = () => {
    if (!students || students.length === 0) {
      toast({ variant: "destructive", title: "Export Failed", description: "No student data available to export." });
      return;
    }
    const headers = ["ID", "Name", "Phone", "Email", "Parent Name", "Address", "Aadhar No", "App No", "Branch", "Status", "Registration Date", "Courses", "Total Amount", "Discount"];
    const rows = students.map(s => [
      s.id, s.name, s.phone, s.email || '', s.parentName || '', `"${s.address?.replace(/"/g, '""')}"`,
      s.aadharNo || '', s.onlineAppNo || '', s.branch, s.status, s.registrationDate, `"${s.courses?.join('; ')}"`,
      s.amount, s.discount
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `citydrive_students_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Successful", description: "Student records downloaded as CSV." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Students Database</CardTitle>
              <CardDescription>
                {isAdmin ? 'Global school enrollment records.' : `Enrollment records for ${profile?.branch}.`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ID, Name or Mobile..."
                  className="pl-8 w-[200px] lg:w-[300px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              )}

              <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if(!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Register Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>New Student Registration</DialogTitle>
                    <DialogDescription>Fill in all details. IDs follow the branch series (e.g., B1-1001).</DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-[70vh] pr-4">
                    <div className="grid gap-6 py-4">
                      <div className="flex flex-col items-center gap-4 py-4 border rounded-lg bg-muted/30">
                        <Label className="font-bold">Student Photo</Label>
                        <div className="relative">
                          <Avatar className="h-32 w-32 border-4 border-primary/20">
                            <AvatarImage src={formData.photoUrl || undefined} alt="Preview" />
                            <AvatarFallback><Camera className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
                          </Avatar>
                          <Button size="icon" variant="secondary" className="absolute bottom-0 right-0 rounded-full shadow-lg" onClick={() => photoInputRef.current?.click()}>
                            <PlusCircle className="h-5 w-5" />
                          </Button>
                          <input type="file" ref={photoInputRef} className="hidden" accept="image/jpeg" onChange={handlePhotoUpload} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="grid gap-2">
                          <Label className="text-primary font-bold">Branch Assignment</Label>
                          <Select value={formData.branch} onValueChange={(v) => setFormData({...formData, branch: v as any})} disabled={!isAdmin}>
                            <SelectTrigger className="border-primary/50"><SelectValue placeholder="Select Branch" /></SelectTrigger>
                            <SelectContent>
                              {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Full Name</Label>
                          <Input placeholder="Liam Johnson" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Mobile No.</Label>
                          <Input placeholder="555-0101" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Parent/Guardian Name</Label>
                          <Input placeholder="Robert Johnson" value={formData.parentName || ''} onChange={(e) => setFormData({...formData, parentName: e.target.value})} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Aadhar No.</Label>
                          <Input placeholder="XXXX-XXXX-XXXX" value={formData.aadharNo || ''} onChange={(e) => setFormData({...formData, aadharNo: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>Address</Label>
                        <Textarea placeholder="123 Main St, Cityville" value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="grid gap-2">
                          <Label>Online App No.</Label>
                          <Input placeholder="APP-1001" value={formData.onlineAppNo || ''} onChange={(e) => setFormData({...formData, onlineAppNo: e.target.value})} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Learners Date</Label>
                          <Input type="date" value={formData.learnersDate || ''} onChange={(e) => setFormData({...formData, learnersDate: e.target.value})} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Test Date</Label>
                          <Input type="date" value={formData.testDate || ''} onChange={(e) => setFormData({...formData, testDate: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
                        <Label className="font-bold">Courses Selection</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {masterCourses?.map(course => (
                            <div key={course.id} className="flex items-center space-x-2">
                              <Checkbox id={`add-course-${course.id}`} checked={formData.courses?.includes(course.name)} onCheckedChange={() => handleCourseToggle(course.name)} />
                              <Label htmlFor={`add-course-${course.id}`} className="text-sm cursor-pointer">{course.name} (₹{course.amount})</Label>
                            </div>
                          ))}
                          <div className="flex items-center space-x-2">
                            <Checkbox id="add-course-special" checked={formData.courses?.includes("Other Special Course")} onCheckedChange={() => handleCourseToggle("Other Special Course")} />
                            <Label htmlFor="add-course-special" className="text-sm cursor-pointer text-primary font-medium">Other Special Course</Label>
                          </div>
                        </div>
                        {formData.courses?.includes("Other Special Course") && (
                          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                            <div className="grid gap-2">
                              <Label>Special Course Name</Label>
                              <Input value={formData.specialCourseName} onChange={(e) => setFormData({...formData, specialCourseName: e.target.value})} />
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Button onClick={handleAddStudent} disabled={isSubmitting}>
                      {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Confirm Registration
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isStudentsLoading || isCoursesLoading ? (
             <div className="flex justify-center py-8"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID & Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Agreed Fee (₹)</TableHead>
                  <TableHead>Balance Due (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">No student records found.</TableCell></TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={student.photoUrl || undefined} alt={student.name} />
                            <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="grid gap-0.5">
                            <span className="font-bold text-primary">{student.id}</span>
                            <span className="text-sm">{student.name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{student.branch}</TableCell>
                      <TableCell className="text-sm">{student.phone}</TableCell>
                      <TableCell>₹{(student.amount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`font-bold ${calculateBalanceDue(student) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          ₹{calculateBalanceDue(student).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedStudent(student); setIsProfileOpen(true); }}><Eye className="mr-2 h-4 w-4" /> View Profile</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedStudent(student); setPaymentData({ amount: 0, receiptNo: '', method: 'Cash', date: new Date().toISOString().split('T')[0] }); setIsPaymentDialogOpen(true); }}><ArrowDownCircle className="mr-2 h-4 w-4 text-green-600" /> Collect Payment</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedStudent(student); setFormData({ ...student }); setIsEditDialogOpen(true); }}><Edit2 className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isAdmin && (
                              <DropdownMenuItem className="text-destructive font-bold" onClick={() => handleDeleteStudent(student)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Permanent Delete
                              </DropdownMenuItem>
                            )}
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

      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => { setIsPaymentDialogOpen(open); if(!open) { setSelectedStudent(null); setPaymentData({ amount: 0, receiptNo: '', method: 'Cash', date: new Date().toISOString().split('T')[0] }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Receive Payment</DialogTitle><DialogDescription>Record fee collection for {selectedStudent?.name}.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 border rounded-lg bg-muted/50 flex justify-between">
               <span className="text-sm">Balance Due:</span>
               <span className="font-bold text-destructive">₹{selectedStudent ? calculateBalanceDue(selectedStudent).toLocaleString() : 0}</span>
            </div>
            <div className="grid gap-2">
              <Label>Payment Date</Label>
              <Input type="date" value={paymentData.date} disabled={!isAdmin} onChange={(e) => setPaymentData({...paymentData, date: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label>Amount Received (₹)</Label>
              <Input type="number" value={paymentData.amount || ''} onChange={(e) => setPaymentData({...paymentData, amount: Number(e.target.value)})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Receipt No.</Label>
                <Input value={paymentData.receiptNo} onChange={(e) => setPaymentData({...paymentData, receiptNo: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Method</Label>
                <Select value={paymentData.method} onValueChange={(v) => setPaymentData({...paymentData, method: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Online">Online</SelectItem><SelectItem value="Cheque">Cheque</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleReceivePayment} className="w-full">Confirm Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader><SheetTitle>Student Profile Details</SheetTitle></SheetHeader>
          {selectedStudent && (
             <ScrollArea className="h-full mt-6 pr-4">
               <div className="space-y-6 pb-20">
                 <div className="flex flex-col items-center text-center">
                    <Avatar className="h-32 w-32 border-4 border-primary/20 mb-4">
                      <AvatarImage src={selectedStudent.photoUrl || undefined} alt={selectedStudent.name} />
                      <AvatarFallback className="text-2xl">{selectedStudent.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
                    <Badge variant="outline" className="mt-1 font-mono">{selectedStudent.id}</Badge>
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedStudent.branch}</p>
                 </div>
                 <Separator />
                 <section className="space-y-3">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2"><User className="h-4 w-4" /> Personal Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1"><p className="text-xs text-muted-foreground">Mobile</p><p className="font-medium">{selectedStudent.phone}</p></div>
                      <div className="space-y-1"><p className="text-xs text-muted-foreground">Parent/Guardian</p><p className="font-medium">{selectedStudent.parentName || 'N/A'}</p></div>
                      <div className="space-y-1"><p className="text-xs text-muted-foreground">Aadhar</p><p className="font-medium">{selectedStudent.aadharNo || 'N/A'}</p></div>
                      <div className="space-y-1"><p className="text-xs text-muted-foreground">Email</p><p className="font-medium text-xs">{selectedStudent.email}</p></div>
                    </div>
                 </section>
                 <Separator />
                 <section className="p-4 border rounded-xl bg-primary/5 space-y-4">
                    <div className="flex justify-between items-center"><span className="text-sm font-medium">Total Fees</span><span className="text-xl font-bold">₹{selectedStudent.amount.toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-destructive"><span className="text-sm font-medium">Remaining</span><span className="text-xl font-black">₹{calculateBalanceDue(selectedStudent).toLocaleString()}</span></div>
                 </section>
                 <section className="space-y-3">
                    <p className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Payment History</p>
                    <div className="border rounded-lg"><Table><TableBody>
                      {selectedStudent.payments?.map((p, idx) => (
                        <TableRow key={p.id || idx} className="text-xs">
                          <TableCell>{p.date ? format(new Date(p.date), 'dd/MM/yy') : 'N/A'}</TableCell>
                          <TableCell className="font-bold text-green-600">₹{p.amount?.toLocaleString()}</TableCell>
                          <TableCell>{p.method}</TableCell>
                          <TableCell className="text-muted-foreground italic">#{p.receiptNo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table></div>
                 </section>
               </div>
             </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if(!open) setSelectedStudent(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Edit Student Profile</DialogTitle><DialogDescription>Update information, courses, and pricing.</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="grid gap-6 py-4">
              <div className="flex flex-col items-center gap-4 py-4 border rounded-lg bg-muted/30">
                <Label className="font-bold">Student Photo</Label>
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-primary/20">
                    <AvatarImage src={formData.photoUrl || undefined} alt="Preview" />
                    <AvatarFallback><Camera className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <Button size="icon" variant="secondary" className="absolute bottom-0 right-0 rounded-full shadow-lg" onClick={() => editPhotoInputRef.current?.click()}><PlusCircle className="h-5 w-5" /></Button>
                  <input type="file" ref={editPhotoInputRef} className="hidden" accept="image/jpeg" onChange={handlePhotoUpload} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Branch</Label>
                  <Select value={formData.branch} onValueChange={(v) => setFormData({...formData, branch: v as any})} disabled={!isAdmin}>
                    <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                    <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Full Name</Label><Input value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="On Hold">On Hold</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
                <Label className="font-bold">Courses & Pricing</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {masterCourses?.map(course => (
                    <div key={course.id} className="flex items-center space-x-2">
                      <Checkbox id={`edit-course-${course.id}`} checked={formData.courses?.includes(course.name)} onCheckedChange={() => handleCourseToggle(course.name)} />
                      <Label htmlFor={`edit-course-${course.id}`} className="text-sm cursor-pointer">{course.name} (₹{course.amount})</Label>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  <div className="grid gap-2"><Label>Discount (₹)</Label><Input type="number" value={formData.discount} onChange={(e) => { const disc = Number(e.target.value); setFormData({...formData, discount: disc, amount: calculateFees(formData.courses || [], disc, formData.specialCourseFee || 0)}); }} /></div>
                  <div className="grid gap-2"><Label className="text-primary font-bold">Total Agreed Fee (₹)</Label><Input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} /></div>
                </div>
              </div>
              <div className="grid gap-2"><Label>Address</Label><Textarea value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} /></div>
            </div>
          </ScrollArea>
          <DialogFooter><Button onClick={handleUpdateStudent}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
