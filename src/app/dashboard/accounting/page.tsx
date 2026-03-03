
"use client"

import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { DollarSign, Receipt, TrendingUp, X, Calendar as CalendarIcon, ArrowRightCircle, RefreshCw, Lock } from "lucide-react";
import { format, isValid } from "date-fns";
import Link from "next/link";

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
  
  // Role & Profile Logic
  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user?.uid]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  
  const isAdmin = profile?.role === 'Admin';
  
  const [activeTab, setActiveTab] = useState<string>("transactions");
  const [dateFilter, setDateFilter] = useState<{ month: string | null, year: string | null }>({ month: null, year: null });

  // Data Fetching - Admins fetch everything, Managers fetch by branch
  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (profile.role === 'Admin') return collection(db, 'payments');
    return query(collection(db, 'payments'), where('branch', '==', profile.branch || "Branch 1"));
  }, [db, user?.uid, profile?.branch, profile?.role]);

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    if (profile.role === 'Admin') return collection(db, 'expenses');
    return query(collection(db, 'expenses'), where('branch', '==', profile.branch || "Branch 1"));
  }, [db, user?.uid, profile?.branch, profile?.role]);

  const { data: payments, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const { data: expenses, isLoading: isExpensesLoading } = useCollection(expensesQuery);

  const parseSafeDate = (d: any) => {
    if (!d) return new Date();
    if (d.seconds) return new Date(d.seconds * 1000);
    const parsed = new Date(d);
    return isValid(parsed) ? parsed : new Date();
  };

  const allTransactions = useMemo(() => {
    const income: Transaction[] = (payments || []).map(p => ({
      id: p.id,
      date: parseSafeDate(p.date),
      description: `Fee: ${p.studentName || 'Student'} (#${p.receiptNo || 'N/A'})`,
      amount: Number(p.amount) || 0,
      type: 'Income',
      branch: p.branch || 'Unknown'
    }));

    const outgo: Transaction[] = (expenses || []).map(e => ({
      id: e.id,
      date: parseSafeDate(e.date),
      description: e.description || `${e.category} Expense`,
      amount: Number(e.amount) || 0,
      type: 'Expense',
      branch: e.branch || 'Unknown',
      category: e.category
    }));

    const combined = [...income, ...outgo];
    return [...combined].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [payments, expenses]);

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

  const isLoading = isProfileLoading || isPaymentsLoading || isExpensesLoading;

  if (isProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading financial records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {!isAdmin && (
            <Badge variant="outline" className="h-9 px-3 gap-2">
              <Lock className="h-3 w-3" /> {profile?.branchName || profile?.branch}
            </Badge>
          )}
          {(dateFilter.month || dateFilter.year) && (
            <Badge variant="secondary" className="h-9 px-3 flex items-center gap-2 border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-left-2">
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              <span className="font-bold">
                {dateFilter.month ? format(new Date(dateFilter.month + "-01"), 'MMMM yyyy') : dateFilter.year}
              </span>
              <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 hover:bg-transparent text-primary hover:text-destructive" onClick={clearDateFilter}>
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
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalIncome.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {dateFilter.month || dateFilter.year ? 'Period' : 'All-time'} school collections
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {dateFilter.month || dateFilter.year ? 'Period' : 'All-time'} school costs
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{netProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {dateFilter.month || dateFilter.year ? 'Period' : 'All-time'} earnings
            </p>
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
              <CardTitle>Global Transaction Log</CardTitle>
              <CardDescription>
                Detailed audit trail for the entire school
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
              <CardTitle>School-wide Monthly Performance</CardTitle>
              <CardDescription>Aggregated financial data across all branches. Click any row to see details.</CardDescription>
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
              <CardTitle>Annual Performance Overview</CardTitle>
              <CardDescription>Consolidated yearly stats for the organization. Click any row to see details.</CardDescription>
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
            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No records found for this period.</TableCell>
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
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No summary data available.</TableCell>
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
                <TableCell>
                  <ArrowRightCircle className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
