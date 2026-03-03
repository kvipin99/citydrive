
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, getDoc, Timestamp, query, where } from 'firebase/firestore';
import { PlusCircle, Search, CreditCard, Receipt, User, Phone, MoreHorizontal, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Student {
  id: string;
  userId: string;
  name: string;
  phone: string;
  branch: string;
  amount: number;
  payments: any[];
}

interface PaymentRecord {
  id: string;
  studentId: string;
  studentUid?: string; // UID for security rule cross-referencing
  studentName: string;
  studentPhone?: string;
  amount: number;
  date: any;
  receiptNo: string;
  method: 'Cash' | 'Online' | 'Cheque';
  branch: string;
  receivedBy: string;
}

export default function PaymentsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isAdmin) return collection(db, 'payments');
    return query(collection(db, 'payments'), where('branch', '==', profile.branch || "Branch 1"));
  }, [db, user, profile, isAdmin]);

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isAdmin) return collection(db, 'students');
    return query(collection(db, 'students'), where('branch', '==', profile.branch || "Branch 1"));
  }, [db, user, profile, isAdmin]);

  const { data: payments, isLoading: isPaymentsLoading } = useCollection<PaymentRecord>(paymentsQuery);
  const { data: students, isLoading: isStudentsLoading } = useCollection<Student>(studentsQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    receiptNo: '',
    method: 'Cash' as const,
    date: new Date().toISOString().split('T')[0],
  });

  const resetForm = () => {
    setSelectedStudent(null);
    setSearchTerm('');
    setPaymentData({ 
      amount: 0, 
      receiptNo: '', 
      method: 'Cash',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const filteredStudents = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return students?.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone.includes(searchTerm)
    ).slice(0, 5) || [];
  }, [students, searchTerm]);

  const calculateBalance = (student: Student) => {
    const paid = student.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
    return Math.max(0, (student.amount || 0) - paid);
  };

  const handleReceivePayment = async () => {
    if (!selectedStudent || paymentData.amount <= 0 || !paymentData.receiptNo) {
      toast({ variant: "destructive", title: "Error", description: "Please complete all fields." });
      return;
    }

    const paymentId = `PAY-${Date.now()}`;
    const paymentRef = doc(db, 'payments', paymentId);
    const studentRef = doc(db, 'students', selectedStudent.id);

    const transactionDate = new Date(paymentData.date);
    
    const fullPaymentRecord: PaymentRecord = {
      id: paymentId,
      studentId: selectedStudent.id,
      studentUid: selectedStudent.userId, 
      studentName: selectedStudent.name,
      studentPhone: selectedStudent.phone,
      amount: paymentData.amount,
      date: Timestamp.fromDate(transactionDate),
      receiptNo: paymentData.receiptNo,
      method: paymentData.method,
      branch: selectedStudent.branch,
      receivedBy: user?.uid!,
    };

    setDocumentNonBlocking(paymentRef, fullPaymentRecord, { merge: true });

    try {
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        const currentPayments = studentSnap.data().payments || [];
        const updatedPayments = [
          ...currentPayments,
          {
            id: paymentId,
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

    setIsDialogOpen(false);
    resetForm();
    toast({ title: "Payment Recorded", description: `Receipt #${paymentData.receiptNo} for ${selectedStudent.name}.` });
  };

  const handleDeletePayment = async (payment: PaymentRecord) => {
    if (!isAdmin) return;

    const paymentRef = doc(db, 'payments', payment.id);
    const studentRef = doc(db, 'students', payment.studentId);

    deleteDocumentNonBlocking(paymentRef);

    try {
      const studentSnap = await getDoc(studentRef);
      if (studentSnap.exists()) {
        const currentPayments = studentSnap.data().payments || [];
        const updatedPayments = currentPayments.filter((p: any) => p.id !== payment.id && p.receiptNo !== payment.receiptNo);
        
        updateDocumentNonBlocking(studentRef, {
          payments: updatedPayments,
          updatedAt: serverTimestamp(),
        });
      }
      toast({ 
        title: "Payment Deleted", 
        description: `Receipt #${payment.receiptNo} for ${payment.studentName} has been removed.` 
      });
    } catch (e) {
      console.error("Failed to delete payment from student record:", e);
    }
  };

  const sortedPayments = useMemo(() => {
    if (!payments) return [];
    // Spread ensures sorting a copy, preventing mutation of original state
    return [...payments].sort((a, b) => {
      const dateA = a.date?.seconds || 0;
      const dateB = b.date?.seconds || 0;
      return dateB - dateA;
    });
  }, [payments]);

  const filteredPayments = useMemo(() => {
    if (!listSearchTerm) return sortedPayments;
    const term = listSearchTerm.toLowerCase();
    return sortedPayments.filter(p => {
      const dateStr = p.date?.seconds 
        ? format(new Date(p.date.seconds * 1000), 'MMM d, yyyy').toLowerCase() 
        : '';
      return (
        p.studentName.toLowerCase().includes(term) ||
        p.receiptNo.toLowerCase().includes(term) ||
        p.studentPhone?.includes(term) ||
        dateStr.includes(term)
      );
    });
  }, [sortedPayments, listSearchTerm]);

  const isActuallyLoading = isProfileLoading || isPaymentsLoading || isStudentsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Fee Collection</h2>
          <p className="text-muted-foreground">{isAdmin ? 'Global school collection log.' : `Collection log for ${profile?.branchName || profile?.branch || 'your branch'}`}</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Name, Phone, Date..." 
              className="pl-8 w-[200px] lg:w-[300px]" 
              value={listSearchTerm} 
              onChange={(e) => setListSearchTerm(e.target.value)} 
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Receive Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Receive New Payment</DialogTitle>
                <DialogDescription>
                  Search for a student and record the amount received.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {!selectedStudent ? (
                  <div className="grid gap-2">
                    <Label>Search Student (ID/Name/Mobile)</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Start typing..." 
                        className="pl-8" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                      />
                    </div>
                    {filteredStudents.length > 0 && (
                      <div className="border rounded-md mt-1 divide-y bg-background">
                        {filteredStudents.map(s => (
                          <div 
                            key={s.id} 
                            className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center"
                            onClick={() => setSelectedStudent(s)}
                          >
                            <div>
                              <p className="font-medium text-sm">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{s.id} • {s.phone}</p>
                            </div>
                            <Badge variant="outline">Select</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg border bg-primary/5 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-primary">{selectedStudent.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedStudent.id}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>Change</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-2 border rounded bg-muted/30">
                        <p className="text-xs text-muted-foreground">Total Fee</p>
                        <p className="font-bold">₹{selectedStudent.amount?.toLocaleString()}</p>
                      </div>
                      <div className="p-2 border rounded bg-destructive/5">
                        <p className="text-xs text-muted-foreground">Balance Due</p>
                        <p className="font-bold text-destructive">₹{calculateBalance(selectedStudent).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="grid gap-4 pt-2">
                      <div className="grid gap-2">
                        <Label>Payment Date</Label>
                        <Input 
                          type="date" 
                          value={paymentData.date} 
                          disabled={!isAdmin}
                          onChange={(e) => setPaymentData({...paymentData, date: e.target.value})} 
                        />
                        {!isAdmin && <p className="text-[10px] text-muted-foreground">Only Admins can adjust the payment date.</p>}
                      </div>
                      <div className="grid gap-2">
                        <Label>Amount Received (₹)</Label>
                        <Input 
                          type="number" 
                          value={paymentData.amount || ''} 
                          onChange={(e) => setPaymentData({...paymentData, amount: Number(e.target.value)})} 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Receipt No.</Label>
                          <Input 
                            placeholder="e.g. REC-1001" 
                            value={paymentData.receiptNo} 
                            onChange={(e) => setPaymentData({...paymentData, receiptNo: e.target.value})} 
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Method</Label>
                          <Select value={paymentData.method} onValueChange={(v) => setPaymentData({...paymentData, method: v as any})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Online">Online</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button disabled={!selectedStudent} onClick={handleReceivePayment} className="w-full">
                  Confirm Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Recent Transactions
          </CardTitle>
          <CardDescription>Fee collections for {isAdmin ? 'all branches' : (profile?.branchName || profile?.branch)}.</CardDescription>
        </CardHeader>
        <CardContent>
          {isActuallyLoading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Receipt & Student</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {listSearchTerm ? 'No payments match your search.' : 'No payment transactions found for this branch.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {p.date?.seconds ? format(new Date(p.date.seconds * 1000), 'MMM d, yyyy') : 'Pending...'}
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <span className="font-bold text-sm">#{p.receiptNo}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> {p.studentName}
                          </span>
                          {p.studentPhone && (
                             <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Phone className="h-2 w-2" /> {p.studentPhone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{p.branch}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {p.method}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        ₹{p.amount?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeletePayment(p)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Payment
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
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
