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
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, arrayUnion, Timestamp } from 'firebase/firestore';
import { PlusCircle, Search, CreditCard, Receipt, User, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Student {
  id: string;
  name: string;
  phone: string;
  branch: string;
  amount: number;
  payments: any[];
}

interface PaymentRecord {
  id: string;
  studentId: string;
  studentName: string;
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
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'payments');
  }, [db, user]);

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'students');
  }, [db, user]);

  const { data: payments, isLoading: isPaymentsLoading } = useCollection<PaymentRecord>(paymentsQuery);
  const { data: students } = useCollection<Student>(studentsQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    receiptNo: '',
    method: 'Cash' as const,
    date: new Date().toISOString().split('T')[0],
  });

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

  const handleReceivePayment = () => {
    if (!selectedStudent || paymentData.amount <= 0 || !paymentData.receiptNo) {
      toast({ variant: "destructive", title: "Error", description: "Please complete all fields." });
      return;
    }

    const paymentId = `PAY-${Date.now()}`;
    const paymentRef = doc(db, 'payments', paymentId);
    const studentRef = doc(db, 'students', selectedStudent.id);

    // Create a proper JS Date from the input string
    const transactionDate = new Date(paymentData.date);
    
    const fullPaymentRecord = {
      id: paymentId,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      amount: paymentData.amount,
      date: Timestamp.fromDate(transactionDate),
      receiptNo: paymentData.receiptNo,
      method: paymentData.method,
      branch: selectedStudent.branch,
      receivedBy: user?.uid,
    };

    // Save to global payments collection
    setDocumentNonBlocking(paymentRef, fullPaymentRecord, { merge: true });

    // Append to student's history
    updateDocumentNonBlocking(studentRef, {
      payments: arrayUnion({
        amount: paymentData.amount,
        date: transactionDate.toISOString(),
        receiptNo: paymentData.receiptNo,
        method: paymentData.method,
      }),
      updatedAt: serverTimestamp(),
    });

    setIsDialogOpen(false);
    setSelectedStudent(null);
    setSearchTerm('');
    setPaymentData({ 
      amount: 0, 
      receiptNo: '', 
      method: 'Cash',
      date: new Date().toISOString().split('T')[0]
    });
    toast({ title: "Payment Recorded", description: `Receipt #${paymentData.receiptNo} for ${selectedStudent.name}.` });
  };

  const sortedPayments = useMemo(() => {
    return payments?.sort((a, b) => {
      const dateA = a.date?.seconds || 0;
      const dateB = b.date?.seconds || 0;
      return dateB - dateA;
    }) || [];
  }, [payments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Fee Collection</h2>
          <p className="text-muted-foreground">Manage student payments and track outstanding balances.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" />
              Receive Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Receive New Payment</DialogTitle>
              <DialogDescription>Search for a student and record the amount received.</DialogDescription>
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
              <Button disabled={!selectedStudent} onClick={handleReceivePayment} className="w-full">Confirm Payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Recent Transactions
          </CardTitle>
          <CardDescription>A complete log of all student fee collections across branches.</CardDescription>
        </CardHeader>
        <CardContent>
          {isPaymentsLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No payment transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPayments.map((p) => (
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
