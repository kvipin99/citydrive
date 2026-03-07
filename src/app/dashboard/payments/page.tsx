
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, getDoc, Timestamp, query, where } from 'firebase/firestore';
import { PlusCircle, Search, CreditCard, Receipt as ReceiptIcon, User, MoreHorizontal, Trash2, RefreshCw, Lock, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isValid, parseISO } from 'date-fns';

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

interface Student {
  id: string;
  userId: string;
  name: string;
  phone: string;
  branch: string;
  amount: number;
  payments: any[];
}

interface ReceiptRecord {
  id: string;
  category: "Course Fee";
  studentId?: string;
  studentUid?: string;
  studentName: string;
  studentPhone?: string;
  amount: number;
  date: any;
  receiptNo: string;
  method: 'Cash' | 'Online' | 'Cheque';
  branch: string;
  receivedBy: string;
  description?: string;
}

export default function StudentReceiptsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user?.uid]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("All");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const receiptsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    const baseCol = collection(db, 'payments');
    if (isAdmin) return baseCol;
    return query(baseCol, where('branch', '==', profile.branch || "Branch 1"));
  }, [db, user?.uid, profile?.branch, isAdmin]);

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    const baseCol = collection(db, 'students');
    if (profile.role === 'Student') return query(baseCol, where('userId', '==', user.uid));
    return baseCol;
  }, [db, user?.uid, profile?.role]);

  const { data: allReceipts, isLoading: isReceiptsLoading } = useCollection<ReceiptRecord>(receiptsQuery);
  const { data: students, isLoading: isStudentsLoading } = useCollection<Student>(studentsQuery);

  const [formData, setFormData] = useState({
    amount: 0,
    receiptNo: '',
    method: 'Cash' as const,
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });

  const resetForm = () => {
    setSelectedStudent(null);
    setSearchTerm('');
    setFormData({ 
      amount: 0, 
      receiptNo: '', 
      method: 'Cash',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: ''
    });
  };

  const filteredStudents = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return students?.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone?.includes(searchTerm)
    ).slice(0, 5) || [];
  }, [students, searchTerm]);

  const calculateBalance = (student: Student) => {
    const paid = student.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
    return Math.max(0, (student.amount || 0) - paid);
  };

  const handleCreateReceipt = async () => {
    if (!selectedStudent) {
      toast({ variant: "destructive", title: "Error", description: "Please select a student." });
      return;
    }
    
    if (!formData.receiptNo) {
      toast({ variant: "destructive", title: "Error", description: "Receipt Number is required." });
      return;
    }

    if (formData.amount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount." });
      return;
    }

    const receiptId = `REC-${Date.now()}`;
    const receiptRef = doc(db, 'payments', receiptId);
    const studentRef = doc(db, 'students', selectedStudent.id);
    const transactionDate = new Date(formData.date);
    
    const record: ReceiptRecord = {
      id: receiptId,
      category: "Course Fee",
      studentId: selectedStudent.id,
      studentUid: selectedStudent.userId, 
      studentName: selectedStudent.name,
      studentPhone: selectedStudent.phone,
      amount: formData.amount,
      date: Timestamp.fromDate(transactionDate),
      receiptNo: formData.receiptNo,
      method: formData.method,
      branch: selectedStudent.branch,
      receivedBy: user?.uid!,
      description: formData.description
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
            amount: formData.amount,
            date: transactionDate.toISOString(),
            receiptNo: formData.receiptNo,
            method: formData.method,
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

    setIsDialogOpen(false);
    resetForm();
    toast({ title: "Receipt Generated", description: `Receipt #${record.receiptNo} for ${record.studentName} saved.` });
  };

  const handleDeleteReceipt = async (receipt: ReceiptRecord) => {
    if (!isAdmin) return;

    const receiptRef = doc(db, 'payments', receipt.id);
    deleteDocumentNonBlocking(receiptRef);

    if (receipt.studentId) {
      const studentRef = doc(db, 'students', receipt.studentId);
      try {
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists()) {
          const currentPayments = studentSnap.data().payments || [];
          const updatedPayments = currentPayments.filter((p: any) => p.id !== receipt.id && p.receiptNo !== receipt.receiptNo);
          updateDocumentNonBlocking(studentRef, {
            payments: updatedPayments,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.error("Failed to delete payment from student record:", e);
      }
    }
    toast({ variant: "destructive", title: "Receipt Deleted" });
  };

  const filteredReceipts = useMemo(() => {
    if (!allReceipts) return [];
    let result = allReceipts.filter(r => r.category === "Course Fee" || (!!r.studentId));

    if (isAdmin && selectedBranchFilter !== "All") {
      result = result.filter(r => r.branch === selectedBranchFilter);
    }

    if (dateRange.from || dateRange.to) {
      result = result.filter(r => {
        const rDate = r.date?.seconds ? new Date(r.date.seconds * 1000) : (typeof r.date === 'string' ? parseISO(r.date) : new Date(r.date));
        if (!isValid(rDate)) return true;
        const rDateStr = format(rDate, 'yyyy-MM-dd');
        return rDateStr >= dateRange.from && rDateStr <= dateRange.to;
      });
    }
    
    if (listSearchTerm) {
      const term = listSearchTerm.toLowerCase();
      result = result.filter(r => 
        r.studentName?.toLowerCase().includes(term) ||
        r.receiptNo?.toLowerCase().includes(term)
      );
    }
    
    return result.sort((a, b) => {
      const getTime = (d: any) => {
        if (!d) return 0;
        if (d.seconds) return d.seconds;
        const p = typeof d === 'string' ? parseISO(d) : new Date(d);
        return isValid(p) ? p.getTime() / 1000 : 0;
      };
      return getTime(b.date) - getTime(a.date);
    });
  }, [allReceipts, listSearchTerm, dateRange, isAdmin, selectedBranchFilter]);

  const isActuallyLoading = isProfileLoading || isReceiptsLoading || isStudentsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Student Receipts</h2>
          <p className="text-muted-foreground">{isAdmin ? 'Global course fee collections.' : `Fee collections for ${profile?.branchName || profile?.branch || 'your branch'}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
           <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              placeholder="Search Name or Receipt..." 
              className="flex h-9 w-[200px] lg:w-[250px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pl-8"
              value={listSearchTerm} 
              onChange={(e) => setListSearchTerm(e.target.value)} 
            />
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="shadow-lg">
            <PlusCircle className="mr-2 h-4 w-4" />
            Collect Fee
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ReceiptIcon className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Fee Collection Log</CardTitle>
                <CardDescription>History of receipts issued to students.</CardDescription>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-primary/10">
              {isAdmin && (
                <div className="flex items-center gap-2 border-r pr-3 mr-1">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                  <Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}>
                    <SelectTrigger className="h-8 w-[130px] text-[10px] font-bold border-none shadow-none bg-transparent">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Branches</SelectItem>
                      {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">From</Label>
                <Input 
                  type="date" 
                  className="h-8 w-[130px] text-xs bg-background" 
                  value={dateRange.from} 
                  onChange={(e) => setDateRange({...dateRange, from: e.target.value})} 
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">To</Label>
                <Input 
                  type="date" 
                  className="h-8 w-[130px] text-xs bg-background" 
                  value={dateRange.to} 
                  onChange={(e) => setDateRange({...dateRange, to: e.target.value})} 
                />
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-[10px] font-bold text-primary hover:bg-primary/10"
                onClick={() => setDateRange({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })}
              >
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isActuallyLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Receipt & Student</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <CalendarIcon className="h-10 w-10" />
                        <p className="italic text-sm font-medium">No records found for the selected period.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReceipts.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/20">
                      <TableCell className="pl-6 text-muted-foreground text-xs">
                        {r.date?.seconds ? format(new Date(r.date.seconds * 1000), 'MMM d, yyyy') : 
                         (isValid(new Date(r.date)) ? format(new Date(r.date), 'MMM d, yyyy') : '...')}
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <span className="font-bold text-sm">#{r.receiptNo || 'N/A'}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> {r.studentName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] uppercase font-bold">{r.branch}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.method}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-green-600 pr-6">
                        ₹{r.amount?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-destructive focus:text-destructive font-bold" onClick={() => handleDeleteReceipt(r)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Receipt
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col h-[90dvh] max-h-[90dvh] gap-0">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>Collect Student Fee</DialogTitle>
            <DialogDescription>Record course fee payment and update student balance.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-6 pb-20">
              {!selectedStudent ? (
                <div className="grid gap-2">
                  <Label>Search Student (ID/Name/Mobile)</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Start typing student details..." 
                      className="pl-8" 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                  </div>
                  {filteredStudents.length > 0 && (
                    <div className="border rounded-md mt-1 divide-y bg-background shadow-sm overflow-hidden">
                      {filteredStudents.map(s => (
                        <div key={s.id} className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center transition-colors" onClick={() => setSelectedStudent(s)}>
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
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-3 rounded-lg border bg-primary/5 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-primary">{selectedStudent.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedStudent.id}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>Change</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-2 border rounded bg-muted/30">
                      <p className="text-xs text-muted-foreground">Agreed Fee</p>
                      <p className="font-bold">₹{selectedStudent.amount?.toLocaleString()}</p>
                    </div>
                    <div className="p-2 border rounded bg-destructive/5">
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-bold text-destructive">₹{calculateBalance(selectedStudent).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 pt-4 border-t">
                    <div className="grid gap-2">
                      <Label>Receipt Date</Label>
                      <div className="relative">
                        {!isAdmin && <Lock className="absolute right-3 top-3 h-3 w-3 text-muted-foreground z-10" />}
                        <Input type="date" value={formData.date} disabled={!isAdmin} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                      </div>
                      {!isAdmin && <p className="text-[10px] text-muted-foreground italic">Restricted to today's date.</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Amount (₹)</Label>
                        <Input type="number" placeholder="0.00" value={formData.amount || ''} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Method</Label>
                        <Select value={formData.method} onValueChange={(v) => setFormData({...formData, method: v as any})}>
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
                      <Input placeholder="e.g. 1001" value={formData.receiptNo} onChange={(e) => setFormData({...formData, receiptNo: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Note (Optional)</Label>
                      <Input placeholder="e.g. 2nd Installment" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-muted/10 shrink-0">
            <Button disabled={!selectedStudent} onClick={handleCreateReceipt} className="w-full">
              Generate Student Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
