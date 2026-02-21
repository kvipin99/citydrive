
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { PlusCircle, Wallet, Calendar, Tag, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const EXPENSE_CATEGORIES = ["Fuel", "Salaries", "Maintenance", "Rent", "Utility", "Others"] as const;

interface ExpenseRecord {
  id: string;
  date: string;
  category: typeof EXPENSE_CATEGORIES[number];
  amount: number;
  description: string;
  branch: string;
  createdBy: string;
  createdAt: any;
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

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'expenses');
  }, [db, user]);

  const { data: expenses, isLoading } = useCollection<ExpenseRecord>(expensesQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Fuel' as typeof EXPENSE_CATEGORIES[number],
    amount: 0,
    description: '',
  });

  const handleAddExpense = () => {
    if (formData.amount <= 0 || !formData.date) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid amount and date." });
      return;
    }

    const expenseId = `EXP-${Date.now()}`;
    const expenseRef = doc(db, 'expenses', expenseId);

    const newExpense = {
      ...formData,
      id: expenseId,
      branch: profile?.branch || 'HeadOffice',
      createdBy: user?.uid,
      createdAt: serverTimestamp(),
    };

    setDocumentNonBlocking(expenseRef, newExpense, { merge: true });

    setIsDialogOpen(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      category: 'Fuel',
      amount: 0,
      description: '',
    });
    toast({ title: "Expense Recorded", description: `Added ₹${formData.amount} for ${formData.category}.` });
  };

  const sortedExpenses = useMemo(() => {
    return expenses?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Business Expenses</h2>
          <p className="text-muted-foreground">Track overheads, fuel, and operational costs.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record New Expense</DialogTitle>
              <DialogDescription>Enter the details of the expenditure.</DialogDescription>
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
              <Button onClick={handleAddExpense} className="w-full">Save Expense</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Expenditure Log
          </CardTitle>
          <CardDescription>A list of recent expenses recorded across branches.</CardDescription>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
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
                        <span className="text-xs">{exp.branch}</span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        ₹{exp.amount?.toLocaleString()}
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
