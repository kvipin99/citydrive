
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { PlusCircle, Wallet, MoreHorizontal, Edit2, Trash2, RefreshCw, Calendar as CalendarIcon, Filter, Lock, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isValid, parseISO } from 'date-fns';
import { DateSegmentedInput } from "@/components/ui/date-segmented-input";

const EXPENSE_CATEGORIES = ["Fuel", "Salaries", "Maintenance", "Rent", "Utility", "Others"] as const;
const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

interface ExpenseRecord {
  id: string;
  date: string;
  category: typeof EXPENSE_CATEGORIES[number];
  amount: number;
  description: string;
  branch: string;
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
}

const toUI = (iso: string) => {
  if (!iso) return 'N/A';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
};

export default function ExpensesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user?.uid]);
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
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });
  
  const expensesQuery = useMemoFirebase(() => (db && user && profile?.role ? collection(db, 'expenses') : null), [db, user?.uid, profile?.role]);
  const { data: expenses, isLoading: isExpensesLoading } = useCollection<ExpenseRecord>(expensesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'Fuel' as typeof EXPENSE_CATEGORIES[number],
    amount: 0,
    description: '',
    branch: 'Branch 1',
  });

  useEffect(() => {
    if (profile && !isAdmin) setSelectedBranchFilter(profileBranch || "Branch 1");
  }, [profile, isAdmin, profileBranch]);

  const isFromBranch = useCallback((record: any, branchName: string) => {
    if (!branchName || branchName === "All" || branchName === "Full") return true;
    
    const normalize = (s: any) => s?.toString().toLowerCase().trim().replace(/\s+/g, '') || '';
    const rBranchStr = normalize(record.branch);
    const tBranchStr = normalize(branchName);
    
    // 1. Match by normalized name
    if (rBranchStr === tBranchStr) return true;

    // 2. Match by branch number
    const getNum = (s: string) => s.match(/\d+/)?.[0];
    const rNum = getNum(rBranchStr);
    const tNum = getNum(tBranchStr);
    if (rNum && tNum && rNum === tNum) return true;

    // 3. Match by ID prefix
    if (tNum) {
      const rid = normalize(record.id || '');
      const bPattern = new RegExp(`(^|[^a-z0-9])b${tNum}([^0-9]|$)`, 'i');
      if (bPattern.test(rid)) return true;
    }
    
    return false;
  }, []);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    let result = expenses.filter(e => e.date >= dateRange.from && e.date <= dateRange.to);
    const context = isAdmin ? selectedBranchFilter : (profileBranch || "Branch 1");
    if (context !== "All" && context !== "Full") result = result.filter(e => isFromBranch(e, context));
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, dateRange, isAdmin, selectedBranchFilter, profileBranch, isFromBranch]);

  const handleOpenDialog = (expense: ExpenseRecord | null = null) => {
    if (expense) {
      setSelectedExpense(expense);
      setFormData({ date: expense.date, category: expense.category, amount: expense.amount, description: expense.description || '', branch: expense.branch || profile?.branch || 'Branch 1' });
    } else {
      setSelectedExpense(null);
      // Ensure the branch defaults correctly from profile for non-admins immediately
      setFormData({ date: format(new Date(), 'yyyy-MM-dd'), category: 'Fuel', amount: 0, description: '', branch: isAdmin ? "Branch 1" : (profileBranch || "Branch 1") });
    }
    setTimeout(() => setIsDialogOpen(true), 150);
  };

  const handleSaveExpense = () => {
    if (formData.amount <= 0 || !formData.date) { toast({ variant: "destructive", title: "Error" }); return; }
    const branchNum = formData.branch.match(/\d+/)?.[0] || '1';
    const expenseId = selectedExpense ? selectedExpense.id : `EXP-B${branchNum}-${Date.now()}`;
    const expenseData = { ...formData, date: isDateLocked ? format(new Date(), 'yyyy-MM-dd') : formData.date, id: expenseId, createdBy: selectedExpense?.createdBy || user?.uid, updatedAt: serverTimestamp(), ...(selectedExpense ? {} : { createdAt: serverTimestamp() }) };
    setDocumentNonBlocking(doc(db, 'expenses', expenseId), expenseData, { merge: true });
    setIsDialogOpen(false);
    toast({ title: selectedExpense ? "Updated" : "Recorded" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1"><h2 className="text-2xl font-bold tracking-tight">Business Expenses</h2><p className="text-muted-foreground text-sm">{isAdmin ? 'School-wide costs.' : `Expenses for ${profile?.branch || 'your branch'}.`}</p></div>
        <Button size="lg" onClick={() => handleOpenDialog()} className="shadow-lg"><PlusCircle className="mr-2 h-4 w-4" />Add Expense</Button>
      </div>

      <Card><CardHeader className="pb-3 border-b"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /><div><CardTitle className="text-lg">Expenditure Log</CardTitle><CardDescription>{isAdmin ? (selectedBranchFilter === 'All' ? 'All Branches' : selectedBranchFilter) : profileBranch}</CardDescription></div></div>
            <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-primary/10">
              {isAdmin && (<div className="flex items-center gap-2 border-r pr-3 mr-1"><Filter className="h-3.5 w-3.5 text-muted-foreground" /><Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter}><SelectTrigger className="h-8 w-[130px] text-[10px] font-bold bg-transparent border-none"><SelectValue placeholder="Branch" /></SelectTrigger><SelectContent><SelectItem value="All">All Branches</SelectItem>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>)}
              <div className="flex items-center gap-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">From</Label><DateSegmentedInput value={dateRange.from} onChange={(v) => setDateRange({...dateRange, from: v})} /></div>
              <div className="flex items-center gap-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">To</Label><DateSegmentedInput value={dateRange.to} onChange={(v) => setDateRange({...dateRange, to: v})} /></div>
              <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-primary" onClick={() => setDateRange({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })}>Today</Button>
            </div>
          </div></CardHeader>
        <CardContent className="p-0">
          {isProfileLoading || isExpensesLoading ? (<div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>) : (
            <Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="pl-6">Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Branch</TableHead><TableHead className="text-right">Amount (₹)</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
              <TableBody>{filteredExpenses.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic"><div className="flex flex-col items-center gap-2 opacity-50"><CalendarIcon className="h-10 w-10" /><p className="italic text-sm font-medium">No expenses found.</p></div></TableCell></TableRow>) : filteredExpenses.map((exp) => (
                <TableRow key={exp.id} className="hover:bg-muted/20"><TableCell className="pl-6 text-muted-foreground text-xs">{toUI(exp.date)}</TableCell><TableCell><Badge variant="secondary" className="font-medium text-[10px] uppercase">{exp.category}</Badge></TableCell><TableCell className="max-w-[200px] truncate text-sm">{exp.description || '--'}</TableCell><TableCell><Badge variant="outline" className="text-[10px] uppercase">{exp.branch}</Badge></TableCell><TableCell className="text-right font-black text-red-600 pr-6">₹{exp.amount?.toLocaleString()}</TableCell><TableCell>{isAdmin && (<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => handleOpenDialog(exp)}><Edit2 className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive font-bold" onSelect={() => { if(window.confirm('Delete?')) deleteDocumentNonBlocking(doc(db, 'expenses', exp.id)); }}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>)}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) { setIsDialogOpen(false); setSelectedExpense(null); } }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{selectedExpense ? 'Edit Expense' : 'New Expense'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4"><div className="grid gap-2"><Label className="flex items-center gap-2">Date {isDateLocked && <Lock className="h-3 w-3" />}</Label><DateSegmentedInput value={isDateLocked ? format(new Date(), 'yyyy-MM-dd') : formData.date} onChange={(v) => setFormData({...formData, date: v})} disabled={isDateLocked} /></div>
              <div className="grid gap-2"><Label>Category</Label><Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v as any})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="grid gap-2"><Label className="font-bold flex items-center gap-2">Branch {!isAdmin && <Lock className="h-3 w-3 text-muted-foreground" />}</Label>{isAdmin ? (
              <Select value={formData.branch} onValueChange={(v) => setFormData({...formData, branch: v})}>
                <SelectTrigger className="h-11 font-bold border-primary/20">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>{BRANCHES.map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <div className="h-11 flex items-center px-3 rounded-md border-2 border-primary/10 bg-muted/30 font-black text-primary uppercase tracking-tight">
                <MapPin className="h-4 w-4 mr-2" />
                {formData.branch || profileBranch || 'Branch 1'}
              </div>
            )}</div>
            <div className="grid gap-2"><Label>Amount (₹)</Label><Input type="number" placeholder="0.00" value={formData.amount || ''} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} /></div>
            <div className="grid gap-2"><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleSaveExpense} className="w-full">Save Expense</Button></DialogFooter>
        </DialogContent></Dialog>
    </div>
  );
}
