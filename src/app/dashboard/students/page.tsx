
"use client";

import { useState, useMemo, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp, getDoc, getDocs, Timestamp, query, where } from "firebase/firestore";
import { MoreHorizontal, Edit2, Trash2, Search, PlusCircle, ArrowDownCircle, RefreshCw, Eye, CreditCard, Calendar, User, Phone, MapPin, FileText, Fingerprint, Clock, CheckCircle2, Tags, Wallet, BookOpen, Car, Eraser, AlertCircle, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { format, isValid } from "date-fns";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

export interface Student {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  address: string;
  parentName: string;
  aadharNo: string;
  onlineAppNo: string;
  learnersNo: string;
  learnersDate: string;
  drivingNo: string;
  testDate: string;
  remarks: string;
  photoUrl: string;
  courses: string[];
  amount: number;
  discount: number;
  status: 'Active' | 'Inactive' | 'Completed' | 'On Hold';
  registrationDate: string;
  payments: any[];
  specialCourseName?: string;
  specialCourseFee?: number;
}

function StudentsContent() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user?.uid]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';
  const isStudent = profile?.role === 'Student';
  const profileBranch = profile?.branch;

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isStudent) {
      return query(collection(db, 'students'), where('userId', '==', user.uid));
    }
    if (isAdmin) {
      return collection(db, 'students');
    }
    const branchId = profileBranch || "Branch 1";
    return query(collection(db, 'students'), where('branch', '==', branchId));
  }, [db, user?.uid, profileBranch, isAdmin, isStudent]);

  const coursesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'courses');
  }, [db, user?.uid]);
  
  const { data: students, isLoading: isStudentsLoading } = useCollection<Student>(studentsQuery);
  const { data: masterCourses, isLoading: isCoursesLoading } = useCollection<any>(coursesQuery);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cleanupId, setCleanupId] = useState("");

  // Handle studentId query parameter for deep-linking
  useEffect(() => {
    const studentIdParam = searchParams.get('studentId');
    if (studentIdParam && students && !isStudentsLoading) {
      const student = students.find(s => s.id === studentIdParam);
      if (student) {
        setSelectedStudent(student);
        setIsProfileSheetOpen(true);
      }
    }
  }, [searchParams, students, isStudentsLoading]);

  useEffect(() => {
    if (isStudent && students && students.length > 0 && !selectedStudent) {
      setSelectedStudent(students[0]);
      setIsProfileSheetOpen(true);
    }
  }, [isStudent, students, selectedStudent]);

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
    amount: 0,
    name: "",
    phone: "",
    address: "",
    parentName: "",
    aadharNo: "",
    onlineAppNo: "",
    learnersNo: "",
    learnersDate: "",
    drivingNo: "",
    testDate: "",
    remarks: "",
    photoUrl: "",
    registrationDate: format(new Date(), 'yyyy-MM-dd'),
    specialCourseName: "",
    specialCourseFee: 0
  });

  useEffect(() => {
    if (profile && isAddDialogOpen) {
      const defaultBranch = isAdmin ? (formData.branch || "Branch 1") : (profileBranch || "Branch 1");
      setFormData(prev => {
        if (prev.branch === defaultBranch) return prev;
        return { ...prev, branch: defaultBranch };
      });
    }
  }, [profileBranch, isAddDialogOpen, isAdmin, formData.branch]);

  const coursePriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    masterCourses?.forEach(c => { map[c.name] = c.amount; });
    return map;
  }, [masterCourses]);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone?.includes(searchQuery)
    );
  }, [students, searchQuery]);

  const calculateFees = useCallback((courses: string[], discount: number, specialFee: number = 0) => {
    const baseAmount = courses.reduce((sum, courseName) => sum + (coursePriceMap[courseName] || 0), 0);
    return Math.max(0, baseAmount + (specialFee || 0) - (discount || 0));
  }, [coursePriceMap]);

  const generateBranchStudentId = useCallback((branchName: string) => {
    const numMatch = branchName.match(/\d+/);
    const branchNumber = numMatch ? numMatch[0] : "1";
    const prefix = `B${branchNumber}`;
    
    const branchStudents = students?.filter(s => s.branch === branchName) || [];
    const maxSequence = branchStudents.reduce((max, s) => {
      if (s.id && s.id.startsWith(prefix)) {
        const seqPart = s.id.slice(prefix.length);
        const seq = parseInt(seqPart, 10);
        return !isNaN(seq) && seq > max ? seq : max;
      }
      return max;
    }, 0);
    
    const nextSeq = maxSequence > 0 ? maxSequence + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }, [students]);

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
      setFormData(prev => ({ ...prev, photoUrl: event.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const createStudentAuth = async (studentId: string, name: string) => {
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
        name: name,
        role: 'Student',
        studentId: studentId,
        branch: formData.branch,
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
    const branchName = formData.branch!;
    const studentId = generateBranchStudentId(branchName);
    const amount = calculateFees(formData.courses || [], formData.discount || 0, formData.specialCourseFee || 0);
    
    try {
      toast({ title: "Registering Student", description: `Generating ID ${studentId}...` });
      const authUid = await createStudentAuth(studentId, formData.name!);
      
      const newStudentData = {
        ...formData,
        id: studentId,
        userId: authUid,
        amount,
        registrationDate: formData.registrationDate || new Date().toISOString().split('T')[0],
        payments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid,
      };

      const studentRef = doc(db, 'students', studentId);
      setDocumentNonBlocking(studentRef, newStudentData, { merge: true });

      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: `Student ${studentId} registered.` });
    } catch (error: any) {
      let errorMsg = "An unexpected error occurred.";
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = `ID Conflict: Login for "${studentId}" already exists. Use the cleanup tool.`;
      }
      toast({ variant: "destructive", title: "Registration Failed", description: errorMsg });
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

  const handlePermanentDelete = async () => {
    if (!selectedStudent || !isAdmin) return;

    setIsSubmitting(true);
    try {
      const paymentsCol = collection(db, 'payments');
      const q = query(paymentsCol, where('studentId', '==', selectedStudent.id));
      const paymentSnaps = await getDocs(q);
      paymentSnaps.forEach((p) => deleteDocumentNonBlocking(doc(db, 'payments', p.id)));

      deleteDocumentNonBlocking(doc(db, 'students', selectedStudent.id));
      if (selectedStudent.userId) {
        deleteDocumentNonBlocking(doc(db, 'users', selectedStudent.userId));
      }

      setIsDeleteAlertOpen(false);
      setSelectedStudent(null);
      toast({ title: "Student Removed" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCleanupGhost = async () => {
    if (!cleanupId) return;
    setIsSubmitting(true);
    const studentId = cleanupId.trim().toUpperCase();
    const email = `${studentId.toLowerCase()}@citydriving.in`;
    const password = "City123";
    const secondaryAppName = `cleanup-s-${studentId}-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await signInWithEmailAndPassword(secondaryAuth, email, password);
      await deleteUser(cred.user);
      await deleteApp(secondaryApp);
      toast({ title: "Cleanup Successful" });
      setCleanupId("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Cleanup Failed" });
      try { await deleteApp(secondaryApp); } catch {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = useCallback(() => {
    const defaultBranch = isAdmin ? "Branch 1" : (profileBranch || "Branch 1");
    setFormData({ 
      branch: defaultBranch, 
      status: "Active", 
      courses: [], 
      discount: 0, 
      amount: 0,
      name: "",
      phone: "",
      address: "",
      parentName: "",
      aadharNo: "",
      onlineAppNo: "",
      learnersNo: "",
      learnersDate: "",
      drivingNo: "",
      testDate: "",
      remarks: "",
      photoUrl: "",
      registrationDate: format(new Date(), 'yyyy-MM-dd'),
      specialCourseName: "",
      specialCourseFee: 0
    });
    setCleanupId("");
  }, [isAdmin, profileBranch]);

  const handleCourseToggle = (course: string) => {
    const currentCourses = formData.courses || [];
    let newCourses;
    if (currentCourses.includes(course)) {
      newCourses = currentCourses.filter(c => c !== course);
    } else {
      newCourses = [...currentCourses, course];
    }
    
    const hasOthers = newCourses.includes('Others');
    const specialFee = hasOthers ? (formData.specialCourseFee || 0) : 0;
    const newAmount = calculateFees(newCourses, formData.discount || 0, specialFee);
    
    setFormData(prev => ({ 
      ...prev, 
      courses: newCourses, 
      amount: newAmount,
      ...(!hasOthers ? { specialCourseName: '', specialCourseFee: 0 } : {})
    }));
  };

  const calculateBalanceDue = useCallback((student: Student) => {
    const paid = student.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
    return Math.max(0, (student.amount || 0) - paid);
  }, []);

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
      category: "Course Fee",
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
            category: "Course Fee"
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
    toast({ title: "Receipt Generated" });
  };

  const isActuallyLoading = isProfileLoading || isStudentsLoading || isCoursesLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Students Database</CardTitle>
              <CardDescription>
                {isStudent ? 'My training and profile record.' : isAdmin ? 'Global school enrollment records.' : `Enrollment records for ${profile?.branchName || profileBranch || 'your branch'}.`}
              </CardDescription>
            </div>
            {!isStudent && (
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
                
                {!isAdmin && (
                  <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if(!open) resetForm(); }}>
                    <DialogTrigger asChild>
                      <Button onClick={resetForm}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Register Student
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col max-h-[90dvh] gap-0">
                      <DialogHeader className="p-6 pb-2">
                        <DialogTitle>New Student Registration</DialogTitle>
                        <DialogDescription>Fill in all details. IDs are auto-generated.</DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="flex-1 min-h-0">
                        <div className="px-6 py-4 pb-32">
                          <StudentForm 
                            formData={formData} 
                            setFormData={setFormData} 
                            isAdmin={isAdmin} 
                            masterCourses={masterCourses} 
                            calculateFees={calculateFees} 
                            handlePhotoUpload={handlePhotoUpload} 
                            photoInputRef={photoInputRef}
                            handleCourseToggle={handleCourseToggle}
                            generateBranchStudentId={generateBranchStudentId}
                          />
                          
                          <div className="mt-8 pt-6 border-t">
                            <div className="flex items-center gap-2 text-orange-600 mb-2">
                              <AlertCircle className="h-4 w-4" />
                              <h4 className="text-xs font-bold uppercase tracking-tight">Fix Conflicts</h4>
                            </div>
                            <div className="flex gap-2 max-w-sm">
                              <Input 
                                placeholder="Conflict ID (e.g. B10001)" 
                                className="h-9 text-xs" 
                                value={cleanupId} 
                                onChange={(e) => setCleanupId(e.target.value.toUpperCase())} 
                              />
                              <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold" onClick={handleCleanupGhost} disabled={!cleanupId || isSubmitting}>
                                <Eraser className="h-3 w-3 mr-1.5" /> Force Delete Auth
                              </Button>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                      <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
                        <Button onClick={handleAddStudent} disabled={isSubmitting} className="w-full sm:w-auto">
                          {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Confirm Registration
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isActuallyLoading ? (
             <div className="flex justify-center py-8"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
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
                {filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No records found.</TableCell></TableRow>
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
                      <TableCell>₹{(student.amount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`font-bold ${calculateBalanceDue(student) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          ₹{calculateBalanceDue(student).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => { setSelectedStudent(student); setIsProfileSheetOpen(true); }}>
                            <Eye className="h-4 w-4 text-primary" />
                          </Button>
                          {!isStudent && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" disabled={isSubmitting}><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedStudent(student); setPaymentData({ amount: 0, receiptNo: '', method: 'Cash', date: new Date().toISOString().split('T')[0] }); setIsPaymentDialogOpen(true); }}><ArrowDownCircle className="mr-2 h-4 w-4 text-green-600" /> Issue Receipt</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSelectedStudent(student); setFormData({ ...student }); setIsEditDialogOpen(true); }}><Edit2 className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {isAdmin && (
                                  <DropdownMenuItem className="text-destructive font-bold" onClick={() => { setSelectedStudent(student); setIsDeleteAlertOpen(true); }}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Permanent Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={isProfileSheetOpen} onOpenChange={(open) => { setIsProfileSheetOpen(open); if(!open && !isStudent) setSelectedStudent(null); }}>
        <SheetContent className="sm:max-w-3xl overflow-y-auto">
          <SheetHeader className="pb-6">
            <SheetTitle>Student Profile Dashboard</SheetTitle>
          </SheetHeader>
          {selectedStudent && (
            <StudentProfileView 
              student={selectedStudent} 
              db={db} 
              isAdmin={isAdmin} 
              calculateBalanceDue={calculateBalanceDue} 
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete <b>{selectedStudent?.name} ({selectedStudent?.id})</b>. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={isSubmitting}>
              {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Wipe Record
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => { setIsPaymentDialogOpen(open); if(!open) { setSelectedStudent(null); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[90dvh] gap-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Issue Receipt</DialogTitle>
            <DialogDescription>Record payment for {selectedStudent?.name}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-4 px-6 py-4 pb-32">
              <div className="grid gap-2">
                <Label>Receipt Date</Label>
                <div className="relative">
                  {!isAdmin && <Lock className="absolute right-3 top-3 h-3 w-3 text-muted-foreground z-10" />}
                  <Input type="date" value={paymentData.date} disabled={!isAdmin} onChange={(e) => setPaymentData({...paymentData, date: e.target.value})} />
                </div>
                {!isAdmin && <p className="text-[10px] text-muted-foreground italic">Restricted to today's date.</p>}
              </div>
              <div className="grid gap-2">
                <Label>Amount Received (₹)</Label>
                <Input type="number" placeholder="0.00" value={paymentData.amount || ''} onChange={(e) => setPaymentData({...paymentData, amount: Number(e.target.value)})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Receipt No.</Label>
                  <Input placeholder="e.g. 1001" value={paymentData.receiptNo} onChange={(e) => setPaymentData({...paymentData, receiptNo: e.target.value})} />
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
          </ScrollArea>
          <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
            <Button onClick={handleReceivePayment} className="w-full">Confirm & Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if(!open) setSelectedStudent(null); }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col max-h-[90dvh] gap-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Edit Student Profile</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-4 pb-32">
              <StudentForm 
                formData={formData} 
                setFormData={setFormData} 
                isAdmin={isAdmin} 
                masterCourses={masterCourses} 
                calculateFees={calculateFees} 
                handlePhotoUpload={handlePhotoUpload} 
                photoInputRef={editPhotoInputRef}
                handleCourseToggle={handleCourseToggle}
                isEdit={true}
              />
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
            <Button onClick={handleUpdateStudent} className="w-full sm:w-auto">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentForm({ 
  formData, 
  setFormData, 
  isAdmin, 
  masterCourses, 
  calculateFees, 
  handlePhotoUpload, 
  photoInputRef,
  handleCourseToggle,
  isEdit = false,
  generateBranchStudentId
}: any) {
  return (
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
          <Label className="text-primary font-bold">Branch {!isAdmin && <Lock className="h-3 w-3" />}</Label>
          <Select value={formData.branch} onValueChange={(v) => setFormData((prev:any) => ({...prev, branch: v}))} disabled={!isAdmin && !isEdit}>
            <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
            <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Full Name</Label>
          <Input placeholder=" Liam Johnson" value={formData.name || ''} onChange={(e) => setFormData((prev:any) => ({...prev, name: e.target.value}))} />
        </div>
        <div className="grid gap-2">
          <Label>Mobile No.</Label>
          <Input placeholder="555-0101" value={formData.phone || ''} onChange={(e) => setFormData((prev:any) => ({...prev, phone: e.target.value}))} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData((prev:any) => ({...prev, status: v}))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="On Hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Admission Date</Label>
          <Input type="date" value={formData.registrationDate || ''} onChange={(e) => setFormData((prev:any) => ({...prev, registrationDate: e.target.value}))} />
        </div>
        <div className="grid gap-2">
          <Label>Parent/Guardian</Label>
          <Input value={formData.parentName || ''} onChange={(e) => setFormData((prev:any) => ({...prev, parentName: e.target.value}))} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-2"><Label>Aadhar No.</Label><Input value={formData.aadharNo || ''} onChange={(e) => setFormData((prev:any) => ({...prev, aadharNo: e.target.value}))} /></div>
        <div className="grid gap-2"><Label>Online App No.</Label><Input value={formData.onlineAppNo || ''} onChange={(e) => setFormData((prev:any) => ({...prev, onlineAppNo: e.target.value}))} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-primary/5">
        <div className="grid gap-2"><Label className="text-primary font-bold">Learners License No.</Label><Input value={formData.learnersNo || ''} onChange={(e) => setFormData((prev:any) => ({...prev, learnersNo: e.target.value}))} /></div>
        <div className="grid gap-2"><Label>Learners Date</Label><Input type="date" value={formData.learnersDate || ''} onChange={(e) => setFormData((prev:any) => ({...prev, learnersDate: e.target.value}))} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-green-50/30">
        <div className="grid gap-2"><Label className="text-green-700 font-bold">Driving License No.</Label><Input value={formData.drivingNo || ''} onChange={(e) => setFormData((prev:any) => ({...prev, drivingNo: e.target.value}))} /></div>
        <div className="grid gap-2"><Label>Test Date</Label><Input type="date" value={formData.testDate || ''} onChange={(e) => setFormData((prev:any) => ({...prev, testDate: e.target.value}))} /></div>
      </div>

      <div className="grid gap-2"><Label>Address</Label><Textarea value={formData.address || ''} onChange={(e) => setFormData((prev:any) => ({...prev, address: e.target.value}))} /></div>

      <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
        <Label className="font-bold">Courses Selection</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {masterCourses?.map((course: any) => (
            <div key={course.id} className="flex items-center space-x-2">
              <Checkbox id={`course-${course.id}`} checked={formData.courses?.includes(course.name)} onCheckedChange={() => handleCourseToggle(course.name)} />
              <Label htmlFor={`course-${course.id}`} className="text-sm cursor-pointer">{course.name} (₹{course.amount})</Label>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <Checkbox id="course-others" checked={formData.courses?.includes('Others')} onCheckedChange={() => handleCourseToggle('Others')} />
            <Label htmlFor="course-others" className="text-sm cursor-pointer font-bold text-primary">Others / Custom</Label>
          </div>
        </div>

        {formData.courses?.includes('Others') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div className="grid gap-2"><Label className="text-xs">Custom Course Name</Label><Input value={formData.specialCourseName || ''} onChange={(e) => setFormData((prev:any) => ({...prev, specialCourseName: e.target.value}))} /></div>
            <div className="grid gap-2"><Label className="text-xs">Custom Fee (₹)</Label><Input type="number" value={formData.specialCourseFee || ''} onChange={(e) => { const val = Number(e.target.value); setFormData((prev:any) => ({ ...prev, specialCourseFee: val, amount: calculateFees(prev.courses || [], prev.discount || 0, val)})); }} /></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label className={!isAdmin ? "text-muted-foreground" : ""}>Discount (₹) {!isAdmin && <Lock className="h-3 w-3" />}</Label>
          <Input type="number" value={formData.discount} disabled={!isAdmin} onChange={(e) => { const disc = Number(e.target.value); setFormData((prev:any) => ({...prev, discount: disc, amount: calculateFees(prev.courses || [], disc, prev.specialCourseFee || 0)})); }} />
        </div>
        <div className="grid gap-2">
          <Label className="text-primary font-bold">Total Payable Amount</Label>
          <div className="h-10 px-3 py-2 border rounded-md bg-primary/10 text-primary font-bold">₹{formData.amount?.toLocaleString() || '0'}</div>
        </div>
      </div>
    </div>
  );
}

function StudentProfileView({ student, db, isAdmin, calculateBalanceDue }: any) {
  const studentId = student?.id;
  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !studentId) return null;
    return query(collection(db, 'attendance'), where('studentId', '==', studentId));
  }, [db, studentId]);

  const { data: attendance, isLoading: isAttendanceLoading } = useCollection(attendanceQuery);

  const hourStats = useMemo(() => {
    if (!attendance) return { practical: 0, theory: 0 };
    return attendance.reduce((acc, curr) => {
      const h = Number(curr.duration) || 0;
      if (curr.type === 'Theory') acc.theory += h;
      else acc.practical += h;
      return acc;
    }, { practical: 0, theory: 0 });
  }, [attendance]);

  const sortedAttendance = useMemo(() => {
    if (!attendance) return [];
    return [...attendance].sort((a, b) => {
      const dateCompare = (b.date || '').localeCompare(a.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (b.startTime || '').localeCompare(a.startTime || '');
    });
  }, [attendance]);

  const paidAmount = useMemo(() => {
    return student?.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
  }, [student?.payments]);

  const balance = calculateBalanceDue(student);

  const formatSafeDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isValid(d) ? format(d, 'MMM dd, yyyy') : 'N/A';
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col items-center text-center gap-4 py-6 bg-primary/5 rounded-2xl border-2 border-primary/10">
        <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
          <AvatarImage src={student.photoUrl} alt={student.name} />
          <AvatarFallback className="text-2xl font-bold bg-primary text-white">{student.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="grid gap-1">
          <h2 className="text-2xl font-black tracking-tight">{student.name}</h2>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="font-mono font-bold">{student.id}</Badge>
            <Badge variant="outline" className="uppercase font-bold text-[10px]">{student.branch}</Badge>
          </div>
          <Badge className="mx-auto mt-2" variant={student.status === 'Active' ? 'default' : 'secondary'}>{student.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatSummary label="Practical Hr" value={`${hourStats.practical.toFixed(1)}h`} icon={<Car className="h-3 w-3" />} color="blue" />
        <StatSummary label="Theory Hr" value={`${hourStats.theory.toFixed(1)}h`} icon={<BookOpen className="h-3 w-3" />} color="orange" />
        <StatSummary label="Paid" value={`₹${paidAmount.toLocaleString()}`} icon={<CreditCard className="h-3 w-3" />} color="green" />
        <StatSummary label="Balance" value={`₹${balance.toLocaleString()}`} icon={<Wallet className="h-3 w-3" />} color="red" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h3 className="font-bold flex items-center gap-2 text-primary border-b pb-2"><User className="h-4 w-4" /> Information</h3>
          <div className="grid gap-4 text-sm">
            <ProfileItem icon={<Calendar />} label="Admission Date" value={formatSafeDate(student.registrationDate)} />
            <ProfileItem icon={<Phone />} label="Mobile" value={student.phone} />
            <ProfileItem icon={<Fingerprint />} label="Aadhar" value={student.aadharNo} />
            <ProfileItem icon={<FileText />} label="Online App ID" value={student.onlineAppNo} />
            <ProfileItem icon={<Fingerprint />} label="Learners No" value={student.learnersNo} />
            <ProfileItem icon={<Car />} label="Driving License No" value={student.drivingNo} />
            <ProfileItem icon={<MapPin />} label="Address" value={student.address} fullWidth />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="font-bold flex items-center gap-2 text-primary border-b pb-2"><CheckCircle2 className="h-4 w-4" /> Courses</h3>
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
        <h3 className="font-bold flex items-center gap-2 text-primary border-b pb-2"><Clock className="h-4 w-4" /> Attendance</h3>
        {isAttendanceLoading ? (
          <div className="flex justify-center py-6"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : sortedAttendance.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground italic text-sm border-2 border-dashed rounded-xl">No logs found.</p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Duration</TableHead></TableRow></TableHeader>
              <TableBody>
                {sortedAttendance.map((a: any) => (
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

      <section className="space-y-4">
        <h3 className="font-bold flex items-center gap-2 text-primary border-b pb-2"><CreditCard className="h-4 w-4" /> Receipts</h3>
        {student.payments?.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground italic text-sm border-2 border-dashed rounded-xl">No receipts issued.</p>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Receipt No.</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {student.payments?.map((p: any) => (
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

function StatSummary({ label, value, icon, color }: any) {
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

export default function StudentsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <StudentsContent />
    </Suspense>
  );
}
