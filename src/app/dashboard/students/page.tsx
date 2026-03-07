
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
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp, getDocs, query, where, getDoc, Timestamp } from "firebase/firestore";
import { MoreHorizontal, Edit2, Trash2, Search, PlusCircle, RefreshCw, Eye, User, Phone, MapPin, Fingerprint, CheckCircle2, Eraser, AlertCircle, Camera, Lock, BookOpen, Car, Tags, Wallet, Clock, CreditCard, FileText, Receipt as ReceiptIcon, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { format, isValid, parseISO } from "date-fns";

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
  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';
  const isBranchManager = profile?.role === 'BranchManager';
  const isInstructor = profile?.role === 'Instructor';
  const isStudent = profile?.role === 'Student';
  const isManagement = isAdmin || isBranchManager;
  const isStaff = isManagement || isInstructor;
  const profileBranch = profile?.branch;

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    const base = collection(db, 'students');
    if (isStudent) {
      return query(base, where('userId', '==', user.uid));
    }
    return base; 
  }, [db, user?.uid, profile, isStudent]);

  const coursesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'courses');
  }, [db, user?.uid]);
  
  const { data: students, isLoading: isStudentsLoading } = useCollection<Student>(studentsQuery);
  const { data: masterCourses, isLoading: isCoursesLoading } = useCollection<any>(coursesQuery);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("All");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cleanupId, setCleanupId] = useState("");

  const [formData, setFormData] = useState<Partial<Student>>({
    id: "",
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

  const [receiptFormData, setReceiptFormData] = useState({
    amount: 0,
    receiptNo: '',
    method: 'Cash' as 'Cash' | 'Online' | 'Cheque',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });

  const generateBranchStudentId = useCallback((branchName: string) => {
    if (!branchName) return "";
    const numMatch = branchName.match(/\d+/);
    const branchNumber = numMatch ? numMatch[0] : "1";
    const prefix = `B${branchNumber}`;
    
    const branchStudents = students?.filter(s => {
      const normalize = (val: string) => val?.replace(/\s+/g, '').toLowerCase() || '';
      return normalize(s.branch) === normalize(branchName) || s.id?.startsWith(prefix);
    }) || [];

    const maxSequence = branchStudents.reduce((max, s) => {
      if (s.id && s.id.startsWith(prefix)) {
        const seqPart = s.id.slice(prefix.length);
        const seq = parseInt(seqPart, 10);
        return !isNaN(seq) && seq > max ? seq : max;
      }
      return max;
    }, 0);
    
    const nextSeq = maxSequence > 0 ? maxSequence + 1 : 10001;
    return `${prefix}${nextSeq}`;
  }, [students]);

  const resetForm = useCallback(() => {
    const defaultBranch = isAdmin ? "Branch 1" : (profileBranch || "Branch 1");
    const nextId = generateBranchStudentId(defaultBranch);
    setFormData({ 
      id: nextId,
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
  }, [isAdmin, profileBranch, generateBranchStudentId]);

  useEffect(() => {
    if (profile && !isAdmin) {
      setSelectedBranchFilter(profileBranch || "Branch 1");
    }
  }, [profile, isAdmin, profileBranch]);

  useEffect(() => {
    if (isAddDialogOpen && formData.branch && students && !isStudentsLoading) {
      const nextId = generateBranchStudentId(formData.branch);
      if (formData.id !== nextId) {
        setFormData(prev => ({ ...prev, id: nextId }));
      }
    }
  }, [isAddDialogOpen, formData.branch, students, isStudentsLoading, generateBranchStudentId, formData.id]);

  const isFromBranch = useCallback((record: Student, branchName: string) => {
    if (!branchName || branchName === "All" || branchName === "Full") return true;
    
    const normalize = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';
    const rBranch = normalize(record.branch);
    const targetBranch = normalize(branchName);
    
    if (rBranch === targetBranch) return true;

    const branchNum = branchName.match(/\d+/)?.[0];
    if (branchNum) {
      const prefix = `B${branchNum}`;
      if (rBranch === prefix.toLowerCase()) return true;
      if (record.id?.startsWith(prefix)) return true;
    }
    return false;
  }, []);

  const filteredStudentsList = useMemo(() => {
    if (!students) return [];
    let result = students;

    const currentBranchContext = isManagement ? selectedBranchFilter : (profileBranch || "Branch 1");
    if (currentBranchContext !== "All") {
      result = result.filter(s => isFromBranch(s, currentBranchContext));
    }

    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(term) || 
        s.id.toLowerCase().includes(term) ||
        s.phone?.includes(term)
      );
    }

    return result;
  }, [students, searchQuery, selectedBranchFilter, isManagement, profileBranch, isFromBranch]);

  const closeAllModals = useCallback(() => {
    setIsEditDialogOpen(false);
    setIsAddDialogOpen(false);
    setIsReceiptDialogOpen(false);
    setIsDeleteAlertOpen(false);
    setIsProfileSheetOpen(false);
  }, []);

  const toInputDate = useCallback((val: any) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val.seconds) return format(new Date(val.seconds * 1000), 'yyyy-MM-dd');
    try {
      const d = new Date(val);
      return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
    } catch {
      return '';
    }
  }, []);

  const coursePriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    masterCourses?.forEach(c => { map[c.name] = c.amount; });
    return map;
  }, [masterCourses]);

  const calculateFees = useCallback((courses: string[], discount: number, specialFee: number = 0) => {
    const baseAmount = courses.reduce((sum, courseName) => sum + (coursePriceMap[courseName] || 0), 0);
    return Math.max(0, baseAmount + (specialFee || 0) - (discount || 0));
  }, [coursePriceMap]);

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
    const secondaryAppName = `secondary-s-${studentId}-${Date.now()}`;
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
    if (!formData.name || !formData.branch || !formData.id) {
      toast({ variant: "destructive", title: "Error", description: "Name, Branch, and Student ID are required." });
      return;
    }

    setIsSubmitting(true);
    const studentId = formData.id;
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
      console.error("Registration Error:", error);
      let errorMsg = "An unexpected error occurred.";
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = `ID Conflict: Auth record for "${studentId}" already exists. Use the "Fix Auth Conflicts" tool below.`;
      }
      toast({ variant: "destructive", title: "Registration Failed", description: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStudent = () => {
    if (!selectedStudent) return;
    setIsSubmitting(true);
    const studentRef = doc(db, 'students', selectedStudent.id);
    const updatedData = { 
      ...formData, 
      updatedAt: serverTimestamp()
    };
    updateDocumentNonBlocking(studentRef, updatedData);
    
    setTimeout(() => {
      setIsEditDialogOpen(false);
      setIsSubmitting(false);
      toast({ title: "Student Updated" });
    }, 100);
  };

  const handleSaveReceipt = async () => {
    if (!selectedStudent) return;
    if (!receiptFormData.receiptNo || receiptFormData.amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Data", description: "Receipt No and Amount are required." });
      return;
    }

    setIsSubmitting(true);
    const receiptId = `REC-${Date.now()}`;
    const receiptRef = doc(db, 'payments', receiptId);
    const studentRef = doc(db, 'students', selectedStudent.id);
    const transactionDate = new Date(receiptFormData.date);

    const record = {
      id: receiptId,
      category: "Course Fee",
      studentId: selectedStudent.id,
      studentUid: selectedStudent.userId,
      studentName: selectedStudent.name,
      amount: receiptFormData.amount,
      date: Timestamp.fromDate(transactionDate),
      receiptNo: receiptFormData.receiptNo,
      method: receiptFormData.method,
      branch: selectedStudent.branch,
      receivedBy: user?.uid,
      description: receiptFormData.description
    };

    setDocumentNonBlocking(receiptRef, record, { merge: true });

    try {
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        const currentPayments = studentSnap.data().payments || [];
        const updatedPayments = [
          ...currentPayments,
          {
            id: receiptId,
            amount: receiptFormData.amount,
            date: transactionDate.toISOString(),
            receiptNo: receiptFormData.receiptNo,
            method: receiptFormData.method,
            category: "Course Fee"
          }
        ];
        updateDocumentNonBlocking(studentRef, {
          payments: updatedPayments,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error(e);
    }

    setTimeout(() => {
      setIsReceiptDialogOpen(false);
      setIsSubmitting(false);
      toast({ title: "Receipt Generated", description: `Receipt #${receiptFormData.receiptNo} saved.` });
    }, 100);
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
    const secondaryAppName = `cleanup-s-s-${studentId}-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await signInWithEmailAndPassword(secondaryAuth, email, password);
      await deleteUser(cred.user);
      await deleteApp(secondaryApp);
      toast({ title: "Cleanup Successful", description: `Auth record for ${studentId} removed.` });
      setCleanupId("");
    } catch (error: any) {
      console.error("Cleanup error:", error);
      let msg = "Could not find or delete that identity.";
      if (error.code === 'auth/invalid-credential') {
        msg = "Cleanup Failed: Password has likely been changed from default 'City123'. Manual deletion in console required.";
      }
      toast({ variant: "destructive", title: "Cleanup Failed", description: msg });
      try { await deleteApp(secondaryApp); } catch {}
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const isActuallyLoading = isProfileLoading || isStudentsLoading || isCoursesLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Students Database</CardTitle>
              <CardDescription>
                {isStudent ? 'My training and profile record.' : isManagement ? (selectedBranchFilter === 'All' ? 'Global school enrollment records.' : `Records for ${selectedBranchFilter}`) : `Branch records.`}
              </CardDescription>
            </div>
            {!isStudent && (
              <div className="flex flex-wrap items-center gap-2">
                {isManagement && (
                  <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-primary/10">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground ml-2" />
                    <Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter} disabled={!isAdmin}>
                      <SelectTrigger className="h-8 w-[130px] text-[10px] font-bold border-none shadow-none bg-transparent">
                        <SelectValue placeholder="Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Branches</SelectItem>
                        {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search ID, Name or Mobile..."
                    className="pl-8 w-[200px] lg:w-[250px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if(open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button onClick={resetForm}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Register Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col h-[90dvh] max-h-[90dvh] gap-0">
                    <DialogHeader className="p-6 border-b bg-muted/5 shrink-0">
                      <DialogTitle>New Student Registration</DialogTitle>
                      <DialogDescription>IDs are auto-generated based on the last record in the branch.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                      <div className="space-y-8 pb-32">
                        <StudentForm 
                          formData={formData} 
                          setFormData={setFormData} 
                          isAdmin={isAdmin} 
                          masterCourses={masterCourses} 
                          calculateFees={calculateFees} 
                          handlePhotoUpload={handlePhotoUpload} 
                          photoInputRef={photoInputRef}
                          handleCourseToggle={handleCourseToggle}
                        />
                        
                        <div className="pt-6 border-t">
                          <div className="flex items-center gap-2 text-orange-600 mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <h4 className="text-xs font-bold uppercase tracking-tight">Fix Auth Conflicts</h4>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-3 leading-tight">
                            If registration fails because the ID already exists in the system but not in the list, use this tool to clear the hidden identity.
                          </p>
                          <div className="flex gap-2 max-w-sm">
                            <Input 
                              placeholder="Conflict ID (e.g. B110001)" 
                              className="h-9 text-xs" 
                              value={cleanupId} 
                              onChange={(e) => setCleanupId(e.target.value.toUpperCase())} 
                            />
                            <Button variant="outline" size="sm" className="h-9 text-[10px] font-bold" onClick={handleCleanupGhost} disabled={!cleanupId || isSubmitting}>
                              <Eraser className="h-3.5 w-3.5 mr-1.5" /> Force Delete Identity
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="p-6 border-t bg-muted/10 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] shrink-0">
                      <div className="flex w-full justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleAddStudent} disabled={isSubmitting} className="min-w-[150px]">
                          {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Confirm Registration
                        </Button>
                      </div>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                {filteredStudentsList.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No records found.</TableCell></TableRow>
                ) : (
                  filteredStudentsList.map((student) => (
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
                                <DropdownMenuItem onSelect={(e) => { 
                                  e.preventDefault();
                                  closeAllModals();
                                  const { payments, ...formDataRest } = student;
                                  setSelectedStudent(student); 
                                  setFormData({ 
                                    ...formDataRest,
                                    registrationDate: toInputDate(student.registrationDate),
                                    learnersDate: toInputDate(student.learnersDate),
                                    testDate: toInputDate(student.testDate)
                                  }); 
                                  setTimeout(() => setIsEditDialogOpen(true), 200);
                                }}>
                                  <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={(e) => { 
                                  e.preventDefault();
                                  closeAllModals();
                                  setSelectedStudent(student); 
                                  setReceiptFormData({ 
                                    amount: 0, 
                                    receiptNo: '', 
                                    method: 'Cash', 
                                    date: format(new Date(), 'yyyy-MM-dd'), 
                                    description: '' 
                                  });
                                  setTimeout(() => setIsReceiptDialogOpen(true), 200); 
                                }}>
                                  <ReceiptIcon className="mr-2 h-4 w-4" /> Issue Receipt
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {isAdmin && (
                                  <DropdownMenuItem 
                                    className="text-destructive font-bold" 
                                    onSelect={(e) => { 
                                      e.preventDefault();
                                      closeAllModals();
                                      setSelectedStudent(student); 
                                      setTimeout(() => setIsDeleteAlertOpen(true), 200); 
                                    }}
                                  >
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
            <AlertDialogDescription>Permanently delete <b>{selectedStudent?.name} ({selectedStudent?.id})</b>. This will wipe all fee and attendance records associated with this ID. This cannot be undone.</AlertDialogDescription>
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

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if(!open) setSelectedStudent(null); }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden flex flex-col h-[90dvh] max-h-[90dvh] gap-0">
          <DialogHeader className="p-6 border-b bg-muted/5 shrink-0">
            <DialogTitle>Edit Student Profile</DialogTitle>
            <DialogDescription>Update the registration details for {selectedStudent?.name}.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-8 pb-32">
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
          </div>
          <DialogFooter className="p-6 border-t bg-muted/10 shrink-0">
            <div className="flex w-full justify-end gap-3">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleUpdateStudent} disabled={isSubmitting}>
                {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceiptDialogOpen} onOpenChange={(open) => { setIsReceiptDialogOpen(open); if(!open) setSelectedStudent(null); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col h-[90dvh] max-h-[90dvh] gap-0">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>Issue Student Receipt</DialogTitle>
            <DialogDescription>Record a course fee collection for <b>{selectedStudent?.name}</b>.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-6 pb-20">
              {selectedStudent && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-2 border rounded bg-muted/30">
                      <p className="text-xs text-muted-foreground">Agreed Fee</p>
                      <p className="font-bold">₹{selectedStudent.amount?.toLocaleString()}</p>
                    </div>
                    <div className="p-2 border rounded bg-destructive/5">
                      <p className="text-xs text-muted-foreground">Current Balance</p>
                      <p className="font-bold text-destructive">₹{calculateBalanceDue(selectedStudent).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 pt-4 border-t">
                    <div className="grid gap-2">
                      <Label>Receipt Date</Label>
                      <Input type="date" value={receiptFormData.date} onChange={(e) => setReceiptFormData({...receiptFormData, date: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Amount (₹)</Label>
                        <Input type="number" placeholder="0.00" value={receiptFormData.amount || ''} onChange={(e) => setReceiptFormData({...receiptFormData, amount: Number(e.target.value)})} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Method</Label>
                        <Select value={receiptFormData.method} onValueChange={(v) => setReceiptFormData({...receiptFormData, method: v as any})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Online">Online</SelectItem>
                            <SelectItem value="Cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Receipt No.</Label>
                      <Input placeholder="e.g. 1001" value={receiptFormData.receiptNo} onChange={(e) => setReceiptFormData({...receiptFormData, receiptNo: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description (Optional)</Label>
                      <Input placeholder="e.g. 2nd Installment" value={receiptFormData.description} onChange={(e) => setReceiptFormData({...receiptFormData, description: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-muted/10 shrink-0">
            <Button onClick={handleSaveReceipt} disabled={isSubmitting} className="w-full">
              {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Confirm & Generate
            </Button>
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
  isEdit = false
}: any) {
  return (
    <div className="grid gap-8 py-4">
      <div className="flex flex-col items-center gap-4 py-6 border-2 border-dashed rounded-2xl bg-muted/20">
        <Label className="font-bold text-primary">STUDENT PHOTOGRAPH (REQUIRED)</Label>
        <div className="relative group">
          <Avatar className="h-40 w-40 border-4 border-white shadow-2xl transition-transform group-hover:scale-105">
            <AvatarImage src={formData.photoUrl || undefined} alt="Preview" className="object-cover" />
            <AvatarFallback className="bg-primary/5"><Camera className="h-16 w-16 text-primary/20" /></AvatarFallback>
          </Avatar>
          <Button size="icon" variant="default" className="absolute bottom-2 right-2 rounded-full shadow-lg h-10 w-10" onClick={() => photoInputRef.current?.click()}>
            <Camera className="h-5 w-5" />
          </Button>
          <input type="file" ref={photoInputRef} className="hidden" accept="image/jpeg" onChange={handlePhotoUpload} />
        </div>
        <p className="text-[10px] text-muted-foreground italic">Standard JPEG format only. Max 200KB.</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 text-primary font-bold border-b pb-2">
          <User className="h-4 w-4" />
          <h3 className="text-sm uppercase tracking-wider">Basic Identity</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="grid gap-2">
            <Label className="text-primary font-bold flex items-center gap-1.5">Branch Identity {!isAdmin && <Lock className="h-3 w-3" />}</Label>
            <Select value={formData.branch} onValueChange={(v) => setFormData((prev:any) => ({...prev, branch: v}))} disabled={!isAdmin && !isEdit}>
              <SelectTrigger className="h-11 font-bold border-primary/20"><SelectValue placeholder="Select Branch" /></SelectTrigger>
              <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-primary font-bold flex items-center gap-1.5">
              Student ID (Auto-generated)
              <Lock className="h-3 w-3 text-muted-foreground" />
            </Label>
            <Input 
              className="h-11 bg-muted font-black text-primary border-primary/20 cursor-not-allowed" 
              value={formData.id || ''} 
              readOnly 
            />
          </div>
          <div className="grid gap-2">
            <Label>Full Student Name</Label>
            <Input className="h-11" placeholder="e.g. Rahul Sharma" value={formData.name || ''} onChange={(e) => setFormData((prev:any) => ({...prev, name: e.target.value}))} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="grid gap-2">
            <Label>Mobile Contact No.</Label>
            <Input className="h-11 font-mono" placeholder="98XXXXXXXX" value={formData.phone || ''} onChange={(e) => setFormData((prev:any) => ({...prev, phone: e.target.value}))} />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 text-primary font-bold border-b pb-2">
          <MapPin className="h-4 w-4" />
          <h3 className="text-sm uppercase tracking-wider">Address & Family</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid gap-2">
            <Label>Parent / Guardian Name</Label>
            <Input className="h-11" placeholder="Father or Spouse name" value={formData.parentName || ''} onChange={(e) => setFormData((prev:any) => ({...prev, parentName: e.target.value}))} />
          </div>
          <div className="grid gap-2">
            <Label>Full Residential Address</Label>
            <Textarea className="min-h-[44px]" placeholder="Village, Landmark, District..." value={formData.address || ''} onChange={(e) => setFormData((prev:any) => ({...prev, address: e.target.value}))} />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 text-primary font-bold border-b pb-2">
          <Fingerprint className="h-4 w-4" />
          <h3 className="text-sm uppercase tracking-wider">Government Identifiers</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="grid gap-2">
            <Label>Aadhar Card Number</Label>
            <Input className="h-11 font-mono" placeholder="XXXX XXXX XXXX" value={formData.aadharNo || ''} onChange={(e) => setFormData((prev:any) => ({...prev, aadharNo: e.target.value}))} />
          </div>
          <div className="grid gap-2">
            <Label>RTO Online Application No.</Label>
            <Input className="h-11 font-mono" placeholder="e.g. 234000123" value={formData.onlineAppNo || ''} onChange={(e) => setFormData((prev:any) => ({...prev, onlineAppNo: e.target.value}))} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-6 border-2 border-primary/10 rounded-2xl bg-primary/5 space-y-4">
          <div className="flex items-center gap-2 text-primary font-black uppercase text-xs">
            <BookOpen className="h-4 w-4" /> Learners License Status
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Learners License No.</Label>
              <Input className="bg-background font-mono" placeholder="MH12 2023000..." value={formData.learnersNo || ''} onChange={(e) => setFormData((prev:any) => ({...prev, learnersNo: e.target.value}))} />
            </div>
            <div className="grid gap-2">
              <Label>Issue Date</Label>
              <Input type="date" className="bg-background" value={formData.learnersDate || ''} onChange={(e) => setFormData((prev:any) => ({...prev, learnersDate: e.target.value}))} />
            </div>
          </div>
        </div>

        <div className="p-6 border-2 border-green-100 rounded-2xl bg-green-50/30 space-y-4">
          <div className="flex items-center gap-2 text-green-700 font-black uppercase text-xs">
            <Car className="h-4 w-4" /> Permanent License Status
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Driving License No.</Label>
              <Input className="bg-background font-mono" placeholder="MH12..." value={formData.drivingNo || ''} onChange={(e) => setFormData((prev:any) => ({...prev, drivingNo: e.target.value}))} />
            </div>
            <div className="grid gap-2">
              <Label>RTO Test Date</Label>
              <Input type="date" className="bg-background" value={formData.testDate || ''} onChange={(e) => setFormData((prev:any) => ({...prev, testDate: e.target.value}))} />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-2 text-primary font-bold border-b pb-2">
          <CheckCircle2 className="h-4 w-4" />
          <h3 className="text-sm uppercase tracking-wider">Course Enrollment & Billing</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="grid gap-2">
            <Label>Admission Date</Label>
            <Input type="date" className="h-11" value={formData.registrationDate || ''} onChange={(e) => setFormData((prev:any) => ({...prev, registrationDate: e.target.value}))} />
          </div>
          <div className="grid gap-2">
            <Label>Admission Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData((prev:any) => ({...prev, status: v}))}>
              <SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Internal Remarks</Label>
            <Input className="h-11" placeholder="e.g. Late evening preferred" value={formData.remarks || ''} onChange={(e) => setFormData((prev:any) => ({...prev, remarks: e.target.value}))} />
          </div>
        </div>

        <div className="p-6 border rounded-2xl bg-muted/30 space-y-6">
          <Label className="font-black text-xs uppercase tracking-widest text-muted-foreground">Select Courses</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {masterCourses?.map((course: any) => (
              <div key={course.id} className="flex items-center space-x-3 p-3 rounded-xl border bg-background hover:bg-primary/5 transition-colors cursor-pointer">
                <Checkbox 
                  id={`course-${course.id}`} 
                  checked={formData.courses?.includes(course.name)} 
                  onCheckedChange={() => handleCourseToggle(course.name)} 
                />
                <Label htmlFor={`course-${course.id}`} className="text-sm font-bold flex-1 cursor-pointer">{course.name}</Label>
                <Badge variant="outline" className="font-mono text-[10px]">₹{course.amount}</Badge>
              </div>
            ))}
            <div className="flex items-center space-x-3 p-3 rounded-xl border border-primary/20 bg-primary/5 cursor-pointer">
              <Checkbox 
                id="course-others" 
                checked={formData.courses?.includes('Others')} 
                onCheckedChange={() => handleCourseToggle('Others')} 
              />
              <Label htmlFor="course-others" className="text-sm font-black text-primary flex-1 cursor-pointer">Others / Custom</Label>
            </div>
          </div>

          {formData.courses?.includes('Others') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border-2 border-primary/20 rounded-xl bg-background animate-in fade-in slide-in-from-top-2">
              <div className="grid gap-2">
                <Label className="text-xs font-bold text-primary">Custom Course Title</Label>
                <Input value={formData.specialCourseName || ''} placeholder="e.g. VIP VIP Refresher" onChange={(e) => setFormData((prev:any) => ({...prev, specialCourseName: e.target.value}))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-bold text-primary">Custom Fee (₹)</Label>
                <Input type="number" value={formData.specialCourseFee || ''} placeholder="0" onChange={(e) => { const val = Number(e.target.value); setFormData((prev:any) => ({ ...prev, specialCourseFee: val, amount: calculateFees(prev.courses || [], prev.discount || 0, val)})); }} />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="p-6 border-2 border-orange-100 rounded-2xl bg-orange-50/20">
            <div className="grid gap-3">
              <Label className={`flex items-center gap-2 font-bold ${!isAdmin ? "text-muted-foreground" : "text-orange-700"}`}>
                <Tags className="h-4 w-4" /> Discount Applied (₹) {!isAdmin && <Lock className="h-3 w-3" />}
              </Label>
              <Input 
                type="number" 
                className="h-12 text-lg font-bold bg-background" 
                value={formData.discount} 
                disabled={!isAdmin} 
                onChange={(e) => { const disc = Number(e.target.value); setFormData((prev:any) => ({...prev, discount: disc, amount: calculateFees(prev.courses || [], disc, prev.specialCourseFee || 0)})); }} 
              />
              {!isAdmin && <p className="text-[10px] text-muted-foreground italic">Discount authorization restricted.</p>}
            </div>
          </div>
          
          <div className="p-6 border-4 border-primary rounded-2xl bg-primary text-primary-foreground shadow-2xl">
            <div className="grid gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Final Agreed Net Fee</span>
              <div className="text-4xl font-black">₹{formData.amount?.toLocaleString() || '0'}</div>
              <span className="text-[10px] font-medium opacity-70">Payable amount calculated automatically</span>
            </div>
          </div>
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
    try {
      const d = new Date(dateStr);
      return isValid(d) ? format(d, 'MMM dd, yyyy') : 'N/A';
    } catch {
      return 'N/A';
    }
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
            <ProfileItem icon={<Clock />} label="Admission Date" value={formatSafeDate(student.registrationDate)} />
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

      <Separator className="my-4" />

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

function Separator({ className }: { className?: string }) {
  return <div className={`h-px w-full bg-border ${className}`} />;
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
