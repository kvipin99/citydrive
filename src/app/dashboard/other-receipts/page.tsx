
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, Timestamp, query, where } from 'firebase/firestore';
import { PlusCircle, Search, CreditCard, User, MoreHorizontal, Trash2, RefreshCw, Layers, Lock, Calendar as CalendarIcon, MapPin, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isValid, parseISO } from 'date-fns';

const RECEIPT_CATEGORIES = [
  "Photostate / Printing",
  "Admission Charge",
  "Late Fee / Fine",
  "Convenience Fee",
  "Other Income"
] as const;

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

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

  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';
  const isBranchManager = profile?.role === 'BranchManager';
  const isManagement = isAdmin || isBranchManager;
  const isStaff = isManagement || profile?.role === 'Instructor';
  const profileBranch = profile?.branch;

  const controlsRef = useMemoFirebase(() => (db && isStaff ? doc(db, 'settings', 'controls') : null), [db, isStaff]);
  const { data: controls } = useDoc(controlsRef);

  const isDateLocked = controls?.lockDateEntry && !isAdmin;

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("All");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [listSearchTerm, setListSearchTerm] = useState('');
  
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const receiptsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile?.role) return null;
    return collection(db, 'payments');
  }, [db, user?.uid, profile?.role]);

  const { data: allReceipts, isLoading: isReceiptsLoading } = useCollection<ReceiptRecord>(receiptsQuery);

  const [formData, setFormData] = useState({
    amount: 0,
    receiptNo: '',
    method: 'Cash' as const,
    date: new Date().toISOString().split('T')[0],
    payerName: '',
    category: 'Photostate / Printing' as ReceiptRecord['category'],
    description: '',
    branch: 'Branch 1'
  });

  useEffect(() => {
    if (profile && isDialogOpen) {
      setFormData(prev => ({ 
        ...prev, 
        branch: profile.branch || "Branch 1" 
      }));
    }
  }, [profile?.branch, isDialogOpen]);

  useEffect(() => {
    if (profile && !isAdmin) {
      setSelectedBranchFilter(profileBranch || "Branch 1");
    }
  }, [profile?.branch, isAdmin, profileBranch]);

  // Synchronized robust matching logic
  const isFromBranch = useCallback((record: any, branchName: string) => {
    if (!branchName || branchName === "All" || branchName === "Full") return true;
    
    const normalize = (s: any) => s?.toString().replace(/\s+/g, '').toLowerCase() || '';
    const rBranch = normalize(record.branch || '');
    const targetBranch = normalize(branchName);
    
    if (rBranch && rBranch === targetBranch) return true;

    const rNum = rBranch.match(/\d+/)?.[0];
    const tNum = targetBranch.match(/\d+/)?.[0];
    if (rNum && tNum && rNum === tNum) return true;

    const rid = normalize(record.id || '');
    const branchNum = tNum || targetBranch.replace(/[^0-9]/g, '');
    
    if (branchNum) {
      const bCode = `b${branchNum}`;
      if (rid.includes(`-${bCode}-`) || rid.startsWith(`exp-${bCode}`) || rid.startsWith(`rec-${bCode}`) || rid.startsWith(`misc-${bCode}`)) return true;
      if (rid.startsWith(bCode)) return true;
    }

    return false;
  }, []);

  const resetForm = () => {
    setFormData({ 
      amount: 0, 
      receiptNo: '', 
      method: 'Cash',
      date: new Date().toISOString().split('T')[0],
      payerName: '',
      category: 'Photostate / Printing',
      description: '',
      branch: profile?.branch || 'Branch 1'
    });
  };

  const handleCreateReceipt = async () => {
    if (formData.amount <= 0) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount." });
      return;
    }

    const branchNum = formData.branch.match(/\d+/)?.[0] || '1';
    const receiptId = `MISC-B${branchNum}-${Date.now()}`;
    const receiptRef = doc(db, 'payments', receiptId);
    
    const transactionDateStr = isDateLocked ? format(new Date(), 'yyyy-MM-dd') : formData.date;
    const transactionDate = new Date(transactionDateStr);
    
    const record: ReceiptRecord = {
      id: receiptId,
      category: formData.category,
      studentName: formData.payerName || "Walk-in Customer",
      amount: formData.amount,
      date: Timestamp.fromDate(transactionDate),
      receiptNo: formData.receiptNo || receiptId,
      method: formData.method,
      branch: formData.branch,
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
    let result = allReceipts.filter(r => r.category !== "Course Fee" && !r.studentId);

    // Filter by context
    const currentBranchContext = isAdmin ? selectedBranchFilter : (profileBranch || "Branch 1");
    if (currentBranchContext !== "All" && currentBranchContext !== "Full") {
      result = result.filter(r => isFromBranch(r, currentBranchContext));
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
        r.studentName.toLowerCase().includes(term) ||
        r.receiptNo.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term)
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
  }, [allReceipts, listSearchTerm, dateRange, isAdmin, selectedBranchFilter, profileBranch, isFromBranch]);

  const isActuallyLoading = isProfileLoading || isReceiptsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Other Receipts</h2>
          <p className="text-muted-foreground text-sm">Miscellaneous income tracking.</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search receipts..." className="pl-8 w-[200px] lg:w-[300px]" value={listSearchTerm} onChange={(e) => setListSearchTerm(e.target.value)} />
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} variant="outline" className="border-primary text-primary hover:bg-primary/5"><PlusCircle className="mr-2 h-4 w-4" />Record Income</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /><div><CardTitle className="text-lg">Misc Income Log</CardTitle><CardDescription>Records for {isAdmin ? (selectedBranchFilter === 'All' ? 'all branches' : selectedBranchFilter) : (profileBranch)}.</CardDescription></div></div>
            <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-primary/10">
              {isAdmin && (<div className="flex items-center gap-2 border-r pr-3 mr-1"><Filter className="h-3.5 w-3.5 text-muted-foreground" /><Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}><SelectTrigger className="h-8 w-[130px] text-[10px] font-bold bg-background"><SelectValue placeholder="All Branches" /></SelectTrigger><SelectContent><SelectItem value="All">All Branches</SelectItem>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>)}
              <div className="flex items-center gap-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">From</Label><Input type="date" className="h-8 w-[130px] text-xs bg-background" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} /></div>
              <div className="flex items-center gap-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">To</Label><Input type="date" className="h-8 w-[130px] text-xs bg-background" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} /></div>
              <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-primary hover:bg-primary/10" onClick={() => setDateRange({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })}>Today</Button>
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
                  <TableHead>Category & Payer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No records found.</TableCell></TableRow>
                ) : (
                  filteredReceipts.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/20">
                      <TableCell className="pl-6 text-muted-foreground text-xs">{r.date?.seconds ? format(new Date(r.date.seconds * 1000), 'MMM d, yyyy') : (isValid(new Date(r.date)) ? format(new Date(r.date), 'MMM d, yyyy') : '...')}</TableCell>
                      <TableCell><div className="grid gap-0.5"><span className="font-bold text-sm text-primary">{r.category}</span><span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> {r.studentName}</span></div></TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] font-bold uppercase">{r.branch}</Badge></TableCell>
                      <TableCell><div className="flex items-center gap-2 text-xs font-medium"><CreditCard className="h-3.5 w-3.5 text-muted-foreground" />{r.method}</div></TableCell>
                      <TableCell className="text-right font-black text-green-600 pr-6">₹{r.amount?.toLocaleString()}</TableCell>
                      <TableCell>{isAdmin && (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive font-bold" onClick={() => handleDeleteReceipt(r)}><Trash2 className="mr-2 h-4 w-4" /> Delete Receipt</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}</TableCell>
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
          <DialogHeader className="p-6 pb-2 border-b shrink-0"><DialogTitle>Issue Other Receipt</DialogTitle><DialogDescription>Record miscellaneous income.</DialogDescription></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-6 pb-32">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">
                    Target Branch {!isAdmin && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  {isAdmin ? (
                    <Select value={formData.branch} onValueChange={(v) => setFormData({...formData, branch: v})}>
                      <SelectTrigger className="h-11 font-bold border-primary/20">
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <div className="h-11 flex items-center px-3 rounded-md border-2 border-primary/10 bg-muted/30 font-black text-primary uppercase tracking-tight">
                      <MapPin className="h-4 w-4 mr-2" />
                      {formData.branch}
                    </div>
                  )}
                </div>
                <div className="grid gap-2"><Label>Income Category</Label><Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v as any})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RECEIPT_CATEGORIES.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent></Select></div>
                <div className="grid gap-2"><Label>Received From (Name)</Label><div className="relative"><User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Walk-in Customer" value={formData.payerName} onChange={(e) => setFormData({...formData, payerName: e.target.value})} /></div></div>
                <div className="grid gap-4 pt-4 border-t">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2">Receipt Date {isDateLocked && <Lock className="h-3 w-3" />}</Label>
                    <Input 
                      type="date" 
                      value={isDateLocked ? format(new Date(), 'yyyy-MM-dd') : formData.date} 
                      disabled={isDateLocked} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})} 
                    />
                    {isDateLocked && <p className="text-[10px] text-muted-foreground italic">Locked to today by administrator.</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Amount (₹)</Label><Input type="number" placeholder="0.00" value={formData.amount || ''} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} /></div><div className="grid gap-2"><Label>Method</Label><Select value={formData.method} onValueChange={(v) => setFormData({...formData, method: v as any})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Online">Online</SelectItem><SelectItem value="Cheque">Cheque</SelectItem></SelectContent></Select></div></div>
                  <div className="grid gap-2"><Label>Receipt No. (Optional)</Label><Input placeholder="Auto-generated if blank" value={formData.receiptNo} onChange={(e) => setFormData({...formData, receiptNo: e.target.value})} /></div>
                  <div className="grid gap-2"><Label>Description (Optional)</Label><Input placeholder="e.g. Form fee" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} /></div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 pt-2 border-t bg-muted/10 shrink-0"><Button onClick={handleCreateReceipt} className="w-full">Generate Other Receipt</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
