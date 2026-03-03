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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, getDoc, Timestamp, query, where } from 'firebase/firestore';
import { PlusCircle, Search, CreditCard, Receipt as ReceiptIcon, User, Phone, MoreHorizontal, Trash2, RefreshCw, Layers, GraduationCap, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const RECEIPT_CATEGORIES = [
  "Course Fee",
  "Photostate / Printing",
  "Admission Charge",
  "Late Fee / Fine",
  "Convenience Fee",
  "Other Income"
] as const;

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
  category: typeof RECEIPT_CATEGORIES[number];
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

export default function ReceiptsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const receiptsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isAdmin) return collection(db, 'payments');
    return query(collection(db, 'payments'), where('branch', '==', profile.branch || "Branch 1"));
  }, [db, user?.uid, profile?.branch, isAdmin]);

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isAdmin) return collection(db, 'students');
    return query(collection(db, 'students'), where('branch', '==', profile.branch || "Branch 1"));
  }, [db, user?.uid, profile?.branch, isAdmin]);

  const { data: receipts, isLoading: isReceiptsLoading } = useCollection<ReceiptRecord>(receiptsQuery);
  const { data: students, isLoading: isStudentsLoading } = useCollection<Student>(studentsQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"fee" | "misc">("fee");
  const [searchTerm, setSearchTerm] = useState('');
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [formData, setFormData] = useState({
    amount: 0,
    receiptNo: '',
    method: 'Cash' as const,
    date: new Date().toISOString().split('T')[0],
    payerName: '',
    category: 'Photostate / Printing' as ReceiptRecord['category'],
    description: ''
  });

  const resetForm = () => {
    setSelectedStudent(null);
    setSearchTerm('');
    setFormData({ 
      amount: 0, 
      receiptNo: '', 
      method: 'Cash',
      date: new Date().toISOString().split('T')[0],
      payerName: '',
      category: 'Photostate / Printing',
      description: ''
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

  const handleCreateReceipt = async () => {
    const isFee = activeTab === "fee";
    if (isFee && !selectedStudent) {
      toast({ variant: "destructive", title: "Error", description: "Please select a student." });
      return;
    }
    
    // Receipt No is only mandatory for Fees to maintain serial audit
    if (isFee && !formData.receiptNo) {
      toast({ variant: "destructive", title: "Error", description: "Receipt Number is required for student fees." });
      return;
    }

    if (formData.amount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount." });
      return;
    }

    const receiptId = `REC-${Date.now()}`;
    const receiptRef = doc(db, 'payments', receiptId);
    const transactionDate = new Date(formData.date);
    
    const record: ReceiptRecord = {
      id: receiptId,
      category: isFee ? "Course Fee" : formData.category,
      studentId: isFee ? selectedStudent!.id : undefined,
      studentUid: isFee ? selectedStudent!.userId : undefined, 
      studentName: isFee ? selectedStudent!.name : (formData.payerName || "Walk-in Customer"),
      studentPhone: isFee ? selectedStudent!.phone : '',
      amount: formData.amount,
      date: Timestamp.fromDate(transactionDate),
      receiptNo: formData.receiptNo || receiptId,
      method: formData.method,
      branch: isFee ? selectedStudent!.branch : (profile?.branch || "Branch 1"),
      receivedBy: user?.uid!,
      description: formData.description
    };

    setDocumentNonBlocking(receiptRef, record, { merge: true });

    // Update student payment array if it's a fee
    if (isFee && selectedStudent) {
      const studentRef = doc(db, 'students', selectedStudent.id);
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
              receiptNo: formData.receiptNo || receiptId,
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
    }

    setIsDialogOpen(false);
    resetForm();
    toast({ title: "Receipt Generated", description: `Receipt #${record.receiptNo} for ${record.studentName} saved.` });
  };

  const handleDeleteReceipt = async (receipt: ReceiptRecord) => {
    if (!isAdmin) return;

    const receiptRef = doc(db, 'payments', receipt.id);
    deleteDocumentNonBlocking(receiptRef);

    if (receipt.category === "Course Fee" && receipt.studentId) {
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

  const sortedReceipts = useMemo(() => {
    if (!receipts) return [];
    return [...receipts].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
  }, [receipts]);

  const filteredReceipts = useMemo(() => {
    if (!listSearchTerm) return sortedReceipts;
    const term = listSearchTerm.toLowerCase();
    return sortedReceipts.filter(r => {
      const dateStr = r.date?.seconds ? format(new Date(r.date.seconds * 1000), 'MMM d, yyyy').toLowerCase() : '';
      return (
        r.studentName.toLowerCase().includes(term) ||
        r.receiptNo.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term) ||
        dateStr.includes(term)
      );
    });
  }, [sortedReceipts, listSearchTerm]);

  const isActuallyLoading = isProfileLoading || isReceiptsLoading || isStudentsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Receipts & Billing</h2>
          <p className="text-muted-foreground">{isAdmin ? 'Global transaction history.' : `Billing log for ${profile?.branchName || profile?.branch || 'your branch'}`}</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Name, Receipt, Date..." 
              className="pl-8 w-[200px] lg:w-[300px]" 
              value={listSearchTerm} 
              onChange={(e) => setListSearchTerm(e.target.value)} 
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="shadow-lg">
                <PlusCircle className="mr-2 h-4 w-4" />
                Issue Receipt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Issue New Receipt</DialogTitle>
                <DialogDescription>Collect fees or record miscellaneous income.</DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="max-h-[65vh] pr-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-2">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="fee">Student Fee</TabsTrigger>
                    <TabsTrigger value="misc">Other Receipt</TabsTrigger>
                  </TabsList>

                  <div className="grid gap-6 py-2">
                    {activeTab === "fee" ? (
                      !selectedStudent ? (
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
                                <div key={s.id} className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center" onClick={() => setSelectedStudent(s)}>
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
                          <div className="p-3 rounded-lg border bg-primary/5 flex justify-between items-center animate-in fade-in zoom-in-95">
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
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label>Income Category</Label>
                          <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v as any})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {RECEIPT_CATEGORIES.filter(c => c !== "Course Fee").map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Received From (Name) <span className="text-[10px] font-normal text-muted-foreground ml-1">(Optional)</span></Label>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="Walk-in Customer" value={formData.payerName} onChange={(e) => setFormData({...formData, payerName: e.target.value})} />
                          </div>
                        </div>
                      </div>
                    )}

                    {(activeTab === "misc" || selectedStudent) && (
                      <div className="grid gap-4 pt-2 border-t animate-in slide-in-from-top-2">
                        <div className="grid gap-2">
                          <Label>Receipt Date</Label>
                          <div className="relative">
                            {!isAdmin && <Lock className="absolute right-3 top-3 h-3 w-3 text-muted-foreground z-10" />}
                            <Input type="date" value={formData.date} disabled={!isAdmin} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                          </div>
                          {!isAdmin && <p className="text-[10px] text-muted-foreground italic">Branch users are locked to today's date.</p>}
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
                          <Label>Receipt No. {activeTab === "misc" && <span className="text-[10px] font-normal text-muted-foreground ml-1">(Optional)</span>}</Label>
                          <Input placeholder="e.g. REC-1001" value={formData.receiptNo} onChange={(e) => setFormData({...formData, receiptNo: e.target.value})} />
                        </div>
                        {activeTab === "misc" && (
                          <div className="grid gap-2">
                            <Label>Description (Optional)</Label>
                            <Input placeholder="e.g. 10 sets of photostate" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Tabs>
              </ScrollArea>

              <DialogFooter className="mt-4">
                <Button disabled={(activeTab === "fee" && !selectedStudent)} onClick={handleCreateReceipt} className="w-full">
                  Generate Receipt
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ReceiptIcon className="h-5 w-5 text-primary" />
            Receipt Log
          </CardTitle>
          <CardDescription>Daily collections and fee transactions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isActuallyLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Receipt & Payer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground italic">No transactions found matching your search.</TableCell>
                  </TableRow>
                ) : (
                  filteredReceipts.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/20">
                      <TableCell className="pl-6 text-muted-foreground text-xs">
                        {r.date?.seconds ? format(new Date(r.date.seconds * 1000), 'MMM d, yyyy') : 'Pending...'}
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <span className="font-bold text-sm">#{r.receiptNo}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> {r.studentName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${r.category === 'Course Fee' ? 'text-blue-600 bg-blue-50' : 'text-orange-600 bg-orange-50'}`}>
                          {r.category === 'Course Fee' ? <GraduationCap className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
                          {r.category}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{r.branch}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          {r.method}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600 pr-6">
                        ₹{r.amount?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteReceipt(r)}>
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
    </div>
  );
}
