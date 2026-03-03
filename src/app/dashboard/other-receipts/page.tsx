
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, Timestamp, query, where } from 'firebase/firestore';
import { PlusCircle, Search, CreditCard, User, MoreHorizontal, Trash2, RefreshCw, Layers, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isValid } from 'date-fns';

const RECEIPT_CATEGORIES = [
  "Photostate / Printing",
  "Admission Charge",
  "Late Fee / Fine",
  "Convenience Fee",
  "Other Income"
] as const;

interface ReceiptRecord {
  id: string;
  category: typeof RECEIPT_CATEGORIES[number] | "Course Fee";
  studentName: string;
  amount: number;
  date: any;
  receiptNo: string;
  method: 'Cash' | 'Online' | 'Cheque';
  branch: string;
  receivedBy: string;
  description?: string;
  studentId?: string;
}

export default function OtherReceiptsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user?.uid]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const receiptsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    const baseCol = collection(db, 'payments');
    if (isAdmin) return baseCol;
    return query(baseCol, where('branch', '==', profile.branch || "Branch 1"));
  }, [db, user?.uid, profile?.branch, isAdmin]);

  const { data: allReceipts, isLoading: isReceiptsLoading } = useCollection<ReceiptRecord>(receiptsQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [listSearchTerm, setListSearchTerm] = useState('');
  
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

  const handleCreateReceipt = async () => {
    if (formData.amount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount." });
      return;
    }

    const receiptId = `MISC-${Date.now()}`;
    const receiptRef = doc(db, 'payments', receiptId);
    const transactionDate = new Date(formData.date);
    
    const record: ReceiptRecord = {
      id: receiptId,
      category: formData.category,
      studentName: formData.payerName || "Walk-in Customer",
      amount: formData.amount,
      date: Timestamp.fromDate(transactionDate),
      receiptNo: formData.receiptNo || receiptId,
      method: formData.method,
      branch: profile?.branch || "Branch 1",
      receivedBy: user?.uid!,
      description: formData.description
    };

    setDocumentNonBlocking(receiptRef, record, { merge: true });

    setIsDialogOpen(false);
    resetForm();
    toast({ title: "Receipt Recorded", description: `Receipt generated for ${record.studentName}.` });
  };

  const handleDeleteReceipt = async (receipt: ReceiptRecord) => {
    if (!isAdmin) return;
    deleteDocumentNonBlocking(doc(db, 'payments', receipt.id));
    toast({ variant: "destructive", title: "Receipt Deleted" });
  };

  const filteredReceipts = useMemo(() => {
    if (!allReceipts) return [];
    
    // Logic fix: Exclude any record that is explicitly Course Fee OR has a studentId (legacy data)
    let result = allReceipts.filter(r => 
      r.category !== "Course Fee" && !r.studentId
    );
    
    if (listSearchTerm) {
      const term = listSearchTerm.toLowerCase();
      result = result.filter(r => 
        r.studentName.toLowerCase().includes(term) ||
        r.receiptNo.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term)
      );
    }
    
    return result.sort((a, b) => {
      const timeA = a.date?.seconds || (isValid(new Date(a.date)) ? new Date(a.date).getTime() / 1000 : 0);
      const timeB = b.date?.seconds || (isValid(new Date(b.date)) ? new Date(b.date).getTime() / 1000 : 0);
      return timeB - timeA;
    });
  }, [allReceipts, listSearchTerm]);

  const isActuallyLoading = isProfileLoading || isReceiptsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Other Receipts</h2>
          <p className="text-muted-foreground">Miscellaneous income like photostate, admission charges, and fines.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search receipts..." 
              className="pl-8 w-[200px] lg:w-[300px]" 
              value={listSearchTerm} 
              onChange={(e) => setListSearchTerm(e.target.value)} 
            />
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} variant="outline" className="border-primary text-primary hover:bg-primary/5">
            <PlusCircle className="mr-2 h-4 w-4" />
            Record Income
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Issue Other Receipt</DialogTitle>
            <DialogDescription>Record non-student fee income for the branch.</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="grid gap-6 px-6 py-4 pb-10">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Income Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RECEIPT_CATEGORIES.map(cat => (
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

                <div className="grid gap-4 pt-4 border-t">
                  <div className="grid gap-2">
                    <Label>Receipt Date</Label>
                    <div className="relative">
                      {!isAdmin && <Lock className="absolute right-3 top-3 h-3 w-3 text-muted-foreground z-10" />}
                      <Input type="date" value={formData.date} disabled={!isAdmin} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                    </div>
                    {!isAdmin && <p className="text-[10px] text-muted-foreground italic">Locked to today's date for branch users.</p>}
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
                    <Label>Receipt No. <span className="text-[10px] font-normal text-muted-foreground ml-1">(Optional)</span></Label>
                    <Input placeholder="Auto-generated if blank" value={formData.receiptNo} onChange={(e) => setFormData({...formData, receiptNo: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description (Optional)</Label>
                    <Input placeholder="e.g. Form fee for B1002" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
            <Button onClick={handleCreateReceipt} className="w-full">
              Generate Other Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-primary" />
            Misc Income Log
          </CardTitle>
          <CardDescription>Daily records of non-student income streams.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isActuallyLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Category & Payer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">No miscellaneous records found.</TableCell>
                  </TableRow>
                ) : (
                  filteredReceipts.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/20">
                      <TableCell className="pl-6 text-muted-foreground text-xs">
                        {r.date?.seconds ? format(new Date(r.date.seconds * 1000), 'MMM d, yyyy') : 
                         (isValid(new Date(r.date)) ? format(new Date(r.date), 'MMM d, yyyy') : 'Pending')}
                      </TableCell>
                      <TableCell>
                        <div className="grid gap-0.5">
                          <span className="font-bold text-sm text-primary">{r.category}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> {r.studentName}
                          </span>
                        </div>
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
