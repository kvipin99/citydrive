
"use client";

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
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, getDoc, Timestamp, query, where } from 'firebase/firestore';
import { PlusCircle, Search, CreditCard, Receipt as ReceiptIcon, User, MoreHorizontal, Trash2, RefreshCw, Lock, Calendar as CalendarIcon, Filter, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isValid, parseISO } from 'date-fns';
import { DateSegmentedInput } from "@/components/ui/date-segmented-input";

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

const toUI = (iso: string) => {
  if (!iso) return 'N/A';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
};

export default function StudentReceiptsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userProfileRef);

  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';
  const isBranchManager = profile?.role === 'BranchManager';
  const isManagement = isAdmin || isBranchManager;
  const isStaff = isManagement || profile?.role === 'Instructor';
  const profileBranch = profile?.branch;

  const controlsRef = useMemoFirebase(() => (db && isStaff ? doc(db, 'settings', 'controls') : null), [db, isStaff]);
  const { data: controls } = useDoc(controlsRef);
  const isDateLocked = controls?.lockDateEntry && !isAdmin;

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("All");
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [listSearchTerm, setListSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const [receiptFormData, setReceiptFormData] = useState({
    amount: 0,
    receiptNo: '',
    method: 'Cash' as 'Cash' | 'Online' | 'Cheque',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });

  const isFromBranch = useCallback((record: any, branchName: string) => {
    if (!branchName || branchName === "All" || branchName === "Full") return true;
    const normalize = (s: any) => s?.toString().toLowerCase().trim().replace(/\s+/g, '') || '';
    const rBranch = normalize(record.branch);
    const targetBranch = normalize(branchName);
    if (rBranch === targetBranch) return true;
    const tNum = branchName.match(/\d+/)?.[0];
    if (tNum) {
      const rid = normalize(record.id || '');
      const bPattern = new RegExp(`(^|[^a-z0-9])b${tNum}`, 'i');
      if (bPattern.test(rid)) return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (profile && !isAdmin) setSelectedBranchFilter(profileBranch || "Branch 1");
  }, [profile, isAdmin, profileBranch]);

  const receiptsQuery = useMemoFirebase(() => (db && user && profile?.role ? collection(db, 'payments') : null), [db, user?.uid, profile?.role]);
  const studentsQuery = useMemoFirebase(() => (db && user && profile?.role ? collection(db, 'students') : null), [db, user?.uid, profile?.role]);

  const { data: allReceipts, isLoading: isReceiptsLoading } = useCollection<ReceiptRecord>(receiptsQuery);
  const { data: students } = useCollection<Student>(studentsQuery);

  const resetForm = () => { setSelectedStudent(null); setSearchTerm(''); setReceiptFormData({ amount: 0, receiptNo: '', method: 'Cash', date: format(new Date(), 'yyyy-MM-dd'), description: '' }); };

  const filteredSearchStudents = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    let res = students || [];
    if (!isAdmin) res = res.filter(s => isFromBranch(s, profileBranch || "Branch 1"));
    return res.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone?.includes(searchTerm)).slice(0, 5);
  }, [students, searchTerm, profileBranch, isFromBranch, isAdmin]);

  const filteredReceipts = useMemo(() => {
    if (!allReceipts) return [];
    let res = allReceipts.filter(r => r.category === "Course Fee" || (!!r.studentId));
    const context = isAdmin ? selectedBranchFilter : (profileBranch || "Branch 1");
    if (context !== "All" && context !== "Full") res = res.filter(r => isFromBranch(r, context));
    res = res.filter(r => { const d = r.date?.seconds ? format(new Date(r.date.seconds * 1000), 'yyyy-MM-dd') : (typeof r.date === 'string' ? r.date : format(new Date(r.date), 'yyyy-MM-dd')); return d >= dateRange.from && d <= dateRange.to; });
    if (listSearchTerm) { const t = listSearchTerm.toLowerCase(); res = res.filter(r => r.studentName?.toLowerCase().includes(t) || r.receiptNo?.toLowerCase().includes(t)); }
    return res.sort((a, b) => { const getTime = (d: any) => d?.seconds || 0; return getTime(b.date) - getTime(a.date); });
  }, [allReceipts, listSearchTerm, dateRange, isAdmin, selectedBranchFilter, profileBranch, isFromBranch]);

  const handleCreateReceipt = async () => {
    if (!selectedStudent || !receiptFormData.receiptNo || receiptFormData.amount <= 0) { toast({ variant: "destructive", title: "Error" }); return; }
    setIsSubmitting(true);
    const branchNum = selectedStudent.branch.match(/\d+/)?.[0] || '1';
    const receiptId = `REC-B${branchNum}-${Date.now()}`;
    const transactionDate = new Date(isDateLocked ? format(new Date(), 'yyyy-MM-dd') : receiptFormData.date);
    const record = { id: receiptId, category: "Course Fee", studentId: selectedStudent.id, studentUid: selectedStudent.userId, studentName: selectedStudent.name, studentPhone: selectedStudent.phone, amount: receiptFormData.amount, date: Timestamp.fromDate(transactionDate), receiptNo: receiptFormData.receiptNo, method: receiptFormData.method, branch: selectedStudent.branch, receivedBy: user?.uid!, description: receiptFormData.description };
    setDocumentNonBlocking(doc(db, 'payments', receiptId), record, { merge: true });
    try {
      const snap = await getDoc(doc(db, 'students', selectedStudent.id));
      if (snap.exists()) {
        const cur = snap.data().payments || [];
        const upd = [...cur, { id: receiptId, amount: receiptFormData.amount, date: transactionDate.toISOString(), receiptNo: receiptFormData.receiptNo, method: receiptFormData.method, category: "Course Fee" }];
        updateDocumentNonBlocking(doc(db, 'students', selectedStudent.id), { payments: upd, updatedAt: serverTimestamp() });
      }
    } catch (e) {}
    setTimeout(() => { setIsReceiptDialogOpen(false); setIsSubmitting(false); resetForm(); toast({ title: "Receipt Generated" }); }, 150);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1"><h2 className="text-2xl font-bold tracking-tight">Student Receipts</h2><p className="text-muted-foreground text-sm">{isAdmin ? 'Global collections.' : 'Branch collections.'}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." className="pl-8 w-[200px]" value={listSearchTerm} onChange={(e) => setListSearchTerm(e.target.value)} /></div>
          <Button onClick={() => { resetForm(); setTimeout(() => setIsReceiptDialogOpen(true), 150); }} className="shadow-lg"><PlusCircle className="mr-2 h-4 w-4" />Collect Fee</Button>
        </div>
      </div>

      <Card><CardHeader className="pb-3 border-b"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex items-center gap-2"><ReceiptIcon className="h-5 w-5 text-primary" /><div><CardTitle className="text-lg">Fee Collection Log</CardTitle><CardDescription>History of receipts issued.</CardDescription></div></div>
            <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-primary/10">
              {isAdmin && (<div className="flex items-center gap-2 border-r pr-3 mr-1"><Filter className="h-3.5 w-3.5 text-muted-foreground" /><Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}><SelectTrigger className="h-8 w-[130px] text-[10px] font-bold bg-transparent border-none"><SelectValue placeholder="Branch" /></SelectTrigger><SelectContent><SelectItem value="All">All Branches</SelectItem>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>)}
              <div className="flex items-center gap-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">From</Label><DateSegmentedInput value={dateRange.from} onChange={(v) => setDateRange({...dateRange, from: v})} /></div>
              <div className="flex items-center gap-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">To</Label><DateSegmentedInput value={dateRange.to} onChange={(v) => setDateRange({...dateRange, to: v})} /></div>
              <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-primary" onClick={() => setDateRange({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })}>Today</Button>
            </div>
          </div></CardHeader>
        <CardContent className="p-0">
          {isReceiptsLoading ? (<div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>) : (
            <Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="pl-6">Date</TableHead><TableHead>Receipt & Student</TableHead><TableHead>Branch</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount (₹)</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
              <TableBody>{filteredReceipts.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">No records.</TableCell></TableRow>) : filteredReceipts.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/20"><TableCell className="pl-6 text-muted-foreground text-xs">{toUI(r.date?.seconds ? format(new Date(r.date.seconds * 1000), 'yyyy-MM-dd') : r.date)}</TableCell><TableCell><div className="grid gap-0.5"><span className="font-bold text-sm">#{r.receiptNo}</span><span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> {r.studentName}</span></div></TableCell><TableCell><Badge variant="outline" className="text-[10px] uppercase">{r.branch}</Badge></TableCell><TableCell><div className="flex items-center gap-2 text-xs font-medium"><CreditCard className="h-3.5 w-3.5 text-muted-foreground" />{r.method}</div></TableCell><TableCell className="text-right font-black text-green-600 pr-6">₹{r.amount?.toLocaleString()}</TableCell><TableCell>{isAdmin && (<Button variant="ghost" size="icon" onClick={() => { if(window.confirm('Delete receipt?')) deleteDocumentNonBlocking(doc(db, 'payments', r.id)); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>)}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card>

      <Dialog open={isReceiptDialogOpen} onOpenChange={(open) => { setIsReceiptDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col h-[90dvh] max-h-[90dvh] gap-0">
          <DialogHeader className="p-6 border-b shrink-0"><DialogTitle>Collect Student Fee</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-6"><div className="grid gap-6 pb-20">{!selectedStudent ? (
                <div className="grid gap-2"><Label>Search Student</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Type ID/Name..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>{filteredSearchStudents.length > 0 && (<div className="border rounded-md mt-1 divide-y bg-background">{filteredSearchStudents.map(s => (<div key={s.id} className="p-3 hover:bg-muted cursor-pointer flex justify-between" onClick={() => setSelectedStudent(s)}><div><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-muted-foreground">{s.id}</p></div><Badge variant="outline">Select</Badge></div>))}</div>)}</div>
              ) : (<div className="space-y-4"><div className="p-3 rounded-lg border bg-primary/5 flex justify-between"><div><p className="font-bold text-primary">{selectedStudent.name}</p><p className="text-xs text-muted-foreground">{selectedStudent.id}</p></div><Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>Change</Button></div>
                  <div className="grid gap-4 pt-4 border-t"><div className="grid gap-2"><Label className="flex items-center gap-2">Receipt Date {isDateLocked && <Lock className="h-3 w-3" />}</Label><DateSegmentedInput value={isDateLocked ? format(new Date(), 'yyyy-MM-dd') : receiptFormData.date} onChange={(v) => setReceiptFormData({...receiptFormData, date: v})} disabled={isDateLocked} /></div>
                    <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label>Amount (₹)</Label><Input type="number" value={receiptFormData.amount || ''} onChange={(e) => setReceiptFormData({...receiptFormData, amount: Number(e.target.value)})} /></div><div className="grid gap-2"><Label>Method</Label><Select value={receiptFormData.method} onValueChange={(v) => setReceiptFormData({...receiptFormData, method: v as any})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Online">Online</SelectItem><SelectItem value="Cheque">Cheque</SelectItem></SelectContent></Select></div></div>
                    <div className="grid gap-2"><Label>Receipt No.</Label><Input value={receiptFormData.receiptNo} onChange={(e) => setReceiptFormData({...receiptFormData, receiptNo: e.target.value})} /></div><div className="grid gap-2"><Label>Note</Label><Input value={receiptFormData.description} onChange={(e) => setReceiptFormData({...receiptFormData, description: e.target.value})} /></div></div></div>)}</div></div>
          <DialogFooter className="p-6 border-t bg-muted/10 shrink-0"><Button disabled={!selectedStudent || isSubmitting} onClick={handleCreateReceipt} className="w-full">{isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirm & Generate</Button></DialogFooter>
        </DialogContent></Dialog>
    </div>
  );
}
