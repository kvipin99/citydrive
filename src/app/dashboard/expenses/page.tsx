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
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { PlusCircle, Wallet, MoreHorizontal, Edit2, Trash2, RefreshCw, Calendar as CalendarIcon, Filter, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isValid, parseISO } from 'date-fns';

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

export default function ExpensesPage() {
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

  // Only fetch controls if staff to avoid permission error for students
  const controlsRef = useMemoFirebase(() => (db && isStaff ? doc(db, 'settings', 'controls') : null), [db, isStaff]);
  const { data: controls } = useDoc(controlsRef);

  const isDateLocked = controls?.lockDateEntry && !isAdmin;

  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("All");

  useEffect(() => {
    if (profile && !isAdmin) {
      setSelectedBranchFilter(profileBranch || "Branch 1");
    }
  }, [profile?.branch, isAdmin, profileBranch]);

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user || !profile?.role) return null;
    return collection(db, 'expenses'); 
  }, [db, user?.uid, profile?.role]);

  const { data: expenses, isLoading: isExpensesLoading } = useCollection<ExpenseRecord>(expensesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Fuel' as typeof EXPENSE_CATEGORIES[number],
    amount: 0,
    description: '',
    branch: 'Branch 1',
  });

  useEffect(() => {
    if (profile && !selectedExpense && isDialogOpen) {
      const defaultBranch = isAdmin ? "Branch 1" : (profileBranch || "Branch 1");
      setFormData(prev => ({ ...prev, branch: defaultBranch }));
    }
  }, [profile?.branch, selectedExpense, isDialogOpen, isAdmin, profileBranch]);

  const isFromBranch = useCallback((record: any, branchName: string) => {
    if (!branchName || branchName === "All") return true;
    
    const normalize = (s: string) => s?.replace(/\s+/g, '').toLowerCase() || '';
    const rBranch = normalize(record.branch);
    const targetBranch = normalize(branchName);
    
    if (rBranch === targetBranch) return true;

    const branchNum = branchName.match(/\d+/)?.[0];
    if (branchNum && record.id?.startsWith(`EXP-B${branchNum}`)) return true;
    return false;
  }, []);

  const isWithinRange = (dateStr: string) => {
    if (!dateStr) return false;
    return dateStr >= dateRange.from && dateStr <= dateRange.to;
  };

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    let result = expenses.filter(e => isWithinRange(e.date));

    const currentBranchContext = isManagement ? selectedBranchFilter : (profileBranch || "Branch 1");
    if (currentBranchContext !== "All") {
      result = result.filter(e => isFromBranch(e, currentBranchContext));
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, dateRange, isManagement, selectedBranchFilter, profileBranch, isFromBranch]);

  const handleOpenDialog = (expense: ExpenseRecord | null = null) => {
    if (expense) {
      setSelectedExpense(expense);
      setFormData({
        date: expense.date,
        category: expense.category,
        amount: expense.amount,
        description: expense.description || '',
        branch: expense.branch || profile?.branch || 'Branch 1',
      });
    } else {
      setSelectedExpense(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        category: 'Fuel',
        amount: 0,
        description: '',
        branch: profileBranch || 'Branch 1',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSaveExpense = () => {
    if (formData.amount <= 0 || !formData.date || !formData.branch) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount, date, and branch." });
      return;
    }

    const expenseId = selectedExpense ? selectedExpense.id : `EXP-${Date.now()}`;
    const expenseRef = doc(db, 'expenses', expenseId);

    const expenseDate = isDateLocked ? format(new Date(), 'yyyy-MM-dd') : formData.date;

    const expenseData = {
      ...formData,
      date: expenseDate,
      id: expenseId,
      createdBy: selectedExpense?.createdBy || user?.uid,
      updatedAt: serverTimestamp(),
      ...(selectedExpense ? {} : { createdAt: serverTimestamp() }),
    };

    setDocumentNonBlocking(expenseRef, expenseData, { merge: true });

    setIsDialogOpen(false);
    toast({ 
      title: selectedExpense ? "Expense Updated" : "Expense Recorded", 
      description: `${selectedExpense ? 'Updated' : 'Added'} ₹${formData.amount} for ${formData.category} at ${formData.branch}.` 
    });
  };

  const handleDeleteExpense = (id: string) => {
    const expenseRef = doc(db, 'expenses', id);
    deleteDocumentNonBlocking(expenseRef);
    toast({ variant: "destructive", title: "Expense Deleted", description: "The record has been permanently removed." });
  };

  const isActuallyLoading = isProfileLoading || isExpensesLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Business Expenses</h2>
          <p className="text-muted-foreground">{isManagement ? (selectedBranchFilter === 'All' ? 'All branches overheads and operational costs.' : `Expenses for ${selectedBranchFilter}`) : `Expenses for ${profile?.branch || 'your branch'}.`}</p>
        </div>
        <Button size="lg" onClick={() => handleOpenDialog()} className="shadow-lg">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Expenditure Log</CardTitle>
                <CardDescription>Records for {isManagement ? (selectedBranchFilter === 'All' ? 'all branches' : selectedBranchFilter) : (profileBranch)}.</CardDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-xl border border-primary/10">
              {isManagement && (
                <div className="flex items-center gap-2 border-r pr-3 mr-1">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                  <Select value={selectedBranchFilter} onValueChange={setSelectedBranchFilter} disabled={!isAdmin}>
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
                <Input type="date" className="h-8 w-[130px] text-xs bg-background" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} />
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
            <div className="flex justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <CalendarIcon className="h-10 w-10" />
                        <p className="italic text-sm font-medium">No expenses found for the selected period.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses.map((exp) => (
                    <TableRow key={exp.id} className="hover:bg-muted/20">
                      <TableCell className="pl-6 text-muted-foreground text-xs">
                        {exp.date ? format(new Date(exp.date), 'MMM dd, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium text-[10px] uppercase tracking-wider">{exp.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {exp.description || '--'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">{exp.branch}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-black text-red-600 pr-6">
                        ₹{exp.amount?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(exp)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive font-bold" onClick={() => handleDeleteExpense(exp.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) setSelectedExpense(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedExpense ? 'Edit Expense' : 'Record New Expense'}</DialogTitle>
            <DialogDescription>
              {selectedExpense ? 'Update the details of this expenditure.' : 'Enter the details of the expenditure.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">Date {isDateLocked && <Lock className="h-3 w-3" />}</Label>
                <Input 
                  type="date" 
                  value={isDateLocked ? format(new Date(), 'yyyy-MM-dd') : formData.date} 
                  disabled={isDateLocked}
                  onChange={(e) => setFormData({...formData, date: e.target.value})} 
                />
                {isDateLocked && <p className="text-[10px] text-muted-foreground italic">Today only.</p>}
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Branch</Label>
              <Select 
                value={formData.branch} 
                onValueChange={(v) => setFormData({...formData, branch: v})}
                disabled={!isAdmin}
              >
                <SelectTrigger><SelectValue placeholder="Select Branch" /></SelectTrigger>
                <SelectContent>
                  {BRANCHES.map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Amount (₹)</Label>
              <Input 
                type="number" 
                placeholder="0.00"
                value={formData.amount || ''} 
                onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} 
              />
            </div>
            <div className="grid gap-2">
              <Label>Description (Optional)</Label>
              <Textarea 
                placeholder="e.g. Fuel for V01 (MH-12...)" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveExpense} className="w-full">
              {selectedExpense ? 'Update Expense' : 'Save Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}