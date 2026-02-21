"use client"

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { DollarSign, PlusCircle, Receipt, TrendingUp, Filter, X, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  branch: string;
  category?: string;
}

export default function AccountingPage() {
  const db = useFirestore();
  const { user } = useUser();
  const [selectedBranch, setSelectedBranch] = useState<string>("Full");
  const [activeTab, setActiveTab] = useState<string>("transactions");
  const [dateFilter, setDateFilter] = useState<{ month: string | null, year: string | null }>({ month: null, year: null });

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'payments');
  }, [db, user]);

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'expenses');
  }, [db, user]);

  const { data: payments, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const { data: expenses, isLoading: isExpensesLoading } = useCollection(expensesQuery);

  const allTransactions = useMemo(() => {
    const income: Transaction[] = (payments || []).map(p => ({
      id: p.id,
      date: p.date?.seconds ? new Date(p.date.seconds * 1000) : new Date(),
      description: `Fee: ${p.studentName} (#${p.receiptNo})`,
      amount: Number(p.amount) || 0,
      type: 'Income',
      branch: p.branch || 'Unknown'
    }));

    const outgo: Transaction[] = (expenses || []).map(e => ({
      id: e.id,
      date: e.date ? new Date(e.date) : new Date(),
      description: e.description || `${e.category} Expense`,
      amount: Number(e.amount) || 0,
      type: 'Expense',
      branch: e.branch || 'Unknown',
      category: e.category
    }));

    let combined = [...income, ...outgo];
    
    if (selectedBranch !== "Full") {
      combined = combined.filter(t => t.branch === selectedBranch);
    }

    return combined.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [payments, expenses, selectedBranch]);

  const filteredTransactions = useMemo(() => {
    let result = [...allTransactions];
    if (dateFilter.month) {
      result = result.filter(t => format(t.date, 'yyyy-MM') === dateFilter.month);
    } else if (dateFilter.year) {
      result = result.filter(t => format(t.date, 'yyyy') === dateFilter.year);
    }
    return result;
  }, [allTransactions, dateFilter]);

  const totalIncome = filteredTransactions.filter(t => t.type === 'Income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = filteredTransactions.filter(t => t.type === 'Expense').reduce((acc, t) => acc + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  const monthlySummary = useMemo(() => {
    const summary: Record<string, { income: number, expense: number }> = {};
    allTransactions.forEach(t => {
      const monthKey = format(t.date, 'yyyy-MM');
      if (!summary[monthKey]) summary[monthKey] = { income: 0, expense: 0 };
      if (t.type === 'Income') summary[monthKey].income += t.amount;
      else summary[monthKey].expense += t.amount;
    });
    return Object.entries(summary).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allTransactions]);

  const yearlySummary = useMemo(() => {
    const summary: Record<string, { income: number, expense: number }> = {};
    allTransactions.forEach(t => {
      const yearKey = format(t.date, 'yyyy');
      if (!summary[yearKey]) summary[yearKey] = { income: 0, expense: 0 };
      if (t.type === 'Income') summary[yearKey].income += t.amount;
      else summary[yearKey].expense += t.amount;
    });
    return Object.entries(summary).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allTransactions]);

  const handlePeriodClick = (period: string, type: 'Month' | 'Year') => {
    if (type === 'Month') {
      setDateFilter({ month: period, year: null });
    } else {
      setDateFilter({ month: null, year: period });
    }
    setActiveTab("transactions");
  };

  const clearDateFilter = () => {
    setDateFilter({ month: null, year: null });
  };

  const isLoading = isPaymentsLoading || isExpensesLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Full">Full School View</SelectItem>
                {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(dateFilter.month || dateFilter.year) && (
            <Badge variant="secondary" className="h-9 px-3 flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFilter.month ? format(new Date(dateFilter.month + "-01"), 'MMMM yyyy') : dateFilter.year}
              <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-transparent" onClick={clearDateFilter}>
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard/payments">Collect Fee</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/expenses">Add Expense</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalIncome.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total collections for {selectedBranch}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Operational costs for {selectedBranch}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{netProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Earnings after expenses</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="transactions">Log</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>
        
        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Log</CardTitle>
              <CardDescription>
                Detailed list for {selectedBranch}
                {dateFilter.month ? ` in ${format(new Date(dateFilter.month + "-01"), 'MMMM yyyy')}` : dateFilter.year ? ` in ${dateFilter.year}` : ''}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingSpinner /> : <TransactionTable transactions={filteredTransactions} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Performance</CardTitle>
              <CardDescription>Click a row to view specific transactions for that month.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingSpinner /> : (
                <SummaryTable 
                  data={monthlySummary} 
                  type="Month" 
                  onRowClick={(p) => handlePeriodClick(p, 'Month')} 
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="yearly">
          <Card>
            <CardHeader>
              <CardTitle>Yearly Performance</CardTitle>
              <CardDescription>Click a row to view specific transactions for that year.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? <LoadingSpinner /> : (
                <SummaryTable 
                  data={yearlySummary} 
                  type="Year" 
                  onRowClick={(p) => handlePeriodClick(p, 'Year')} 
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    </div>
  );
}

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No transactions found.</TableCell>
          </TableRow>
        ) : (
          transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="text-xs text-muted-foreground">{format(t.date, 'MMM dd, yyyy')}</TableCell>
              <TableCell>
                <div className="grid gap-0.5">
                  <span className="font-medium text-sm">{t.description}</span>
                  {t.category && <span className="text-[10px] uppercase text-muted-foreground">{t.category}</span>}
                </div>
              </TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{t.branch}</Badge></TableCell>
              <TableCell className={`text-right font-bold ${t.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                {t.type === 'Income' ? '+' : '-'}₹{t.amount.toLocaleString()}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function SummaryTable({ 
  data, 
  type, 
  onRowClick 
}: { 
  data: [string, { income: number, expense: number }][], 
  type: string,
  onRowClick: (period: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{type}</TableHead>
          <TableHead className="text-right">Revenue (₹)</TableHead>
          <TableHead className="text-right">Expenses (₹)</TableHead>
          <TableHead className="text-right">Profit (₹)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No data available for this period.</TableCell>
          </TableRow>
        ) : (
          data.map(([period, values]) => {
            const profit = values.income - values.expense;
            return (
              <TableRow 
                key={period} 
                className="cursor-pointer hover:bg-muted/50 transition-colors group"
                onClick={() => onRowClick(period)}
              >
                <TableCell className="font-bold group-hover:text-primary transition-colors">
                  {type === 'Month' ? format(new Date(period + "-01"), 'MMMM yyyy') : period}
                </TableCell>
                <TableCell className="text-right text-green-600">₹{values.income.toLocaleString()}</TableCell>
                <TableCell className="text-right text-red-600">₹{values.expense.toLocaleString()}</TableCell>
                <TableCell className={`text-right font-black ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  ₹{profit.toLocaleString()}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
