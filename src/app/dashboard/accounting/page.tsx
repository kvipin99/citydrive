"use client"

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { DollarSign, MoreHorizontal, PlusCircle, Receipt, TrendingUp, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface Transaction {
  id: string;
  date: any;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  status: 'Paid' | 'Pending';
  category?: string;
}

export default function AccountingPage() {
  const db = useFirestore();
  const { user } = useUser();

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

  const transactions = useMemo(() => {
    const income: Transaction[] = (payments || []).map(p => ({
      id: p.id,
      date: p.date?.seconds ? new Date(p.date.seconds * 1000) : new Date(),
      description: `Fee Collection: ${p.studentName} (#${p.receiptNo})`,
      amount: p.amount || 0,
      type: 'Income',
      status: 'Paid'
    }));

    const outgo: Transaction[] = (expenses || []).map(e => ({
      id: e.id,
      date: e.date ? new Date(e.date) : new Date(),
      description: e.description || `${e.category} Expense`,
      amount: e.amount || 0,
      type: 'Expense',
      status: 'Paid',
      category: e.category
    }));

    return [...income, ...outgo].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [payments, expenses]);

  const incomeList = transactions.filter(t => t.type === 'Income');
  const expenseList = transactions.filter(t => t.type === 'Expense');

  const totalIncome = incomeList.reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = expenseList.reduce((acc, t) => acc + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  const isLoading = isPaymentsLoading || isExpensesLoading;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalIncome.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total fees collected</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Operational costs</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{netProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Revenue minus expenses</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>
          <div className="sm:ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/dashboard/payments">
                <ArrowUpCircle className="mr-2 h-4 w-4" />
                Collect Fee
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/expenses">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Expense
              </Link>
            </Button>
          </div>
        </div>
        
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Unified Transaction Log</CardTitle>
              <CardDescription>Recent income and expenses across all categories.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
              ) : (
                <TransactionTable transactions={transactions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
           <Card>
            <CardHeader>
              <CardTitle>Income Only</CardTitle>
              <CardDescription>Records of all student fee collections.</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={incomeList} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
           <Card>
            <CardHeader>
              <CardTitle>Expenses Only</CardTitle>
              <CardDescription>Operational expenditures and branch costs.</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={expenseList} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
              No transactions found.
            </TableCell>
          </TableRow>
        ) : (
          transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className="text-xs text-muted-foreground">
                {format(transaction.date, 'MMM dd, yyyy')}
              </TableCell>
              <TableCell>
                <div className="grid gap-0.5">
                  <span className="font-medium text-sm">{transaction.description}</span>
                  {transaction.category && (
                    <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{transaction.category}</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={transaction.type === 'Income' ? 'default' : 'secondary'} 
                  className={transaction.type === 'Income' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}
                >
                  {transaction.type === 'Income' ? <ArrowUpCircle className="mr-1 h-3 w-3" /> : <ArrowDownCircle className="mr-1 h-3 w-3" />}
                  {transaction.type}
                </Badge>
              </TableCell>
              <TableCell className={`text-right font-bold ${transaction.type === 'Income' ? 'text-green-600' : 'text-red-600'}`}>
                {transaction.type === 'Income' ? '+' : '-'}₹{transaction.amount.toLocaleString()}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={transaction.type === 'Income' ? '/dashboard/payments' : '/dashboard/expenses'}>
                        View in {transaction.type === 'Income' ? 'Fees' : 'Expenses'}
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
