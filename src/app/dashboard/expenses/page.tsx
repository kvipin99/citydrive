'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { PlusCircle, Wallet, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
  }, [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (isAdmin) return collection(db, 'expenses');
    return query(collection(db, 'expenses'), where('branch', '==', profile.branch));
  }, [db, user, profile, isAdmin]);

  const { data: expenses, isLoading } = useCollection<ExpenseRecord>(expensesQuery);

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
      const defaultBranch = profile.role === 'Admin' ? "Branch 1" : (profile.branch || "Branch 1");
      setFormData(prev => ({ ...prev, branch: defaultBranch }));
    }
  }, [profile, selectedExpense, isDialogOpen]);

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
        branch: profile?.branch || 'Branch 1',
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

    const expenseData = {
      ...formData,
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

  const sortedExpenses = useMemo(() => {
    return expenses?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Business Expenses</h2>
          <p className="text-muted-foreground">{isAdmin ? 'Track overheads, fuel, and operational costs across all branches.' : `Expenses for ${profile?.branch}.`}</p>
        </div>
        <Button size="lg" onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Expense
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Expenditure Log
          </CardTitle>
          <CardDescription>A list of recent expenses recorded for {isAdmin ? 'all branches' : profile?.branch}.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No expenses recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedExpenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="text-sm">
                        {format(new Date(exp.date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium">{exp.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {exp.description || '--'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{exp.branch}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        ₹{exp.amount?.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(exp)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteExpense(exp.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={formData.date} 
                  onChange={(e) => setFormData({...formData, date: e.target.value})} 
                />
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