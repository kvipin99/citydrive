"use client"

import { transactions } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, MoreHorizontal, PlusCircle, Receipt, TrendingUp } from "lucide-react";

export default function AccountingPage() {
  const income = transactions.filter(t => t.type === 'Income');
  const expenses = transactions.filter(t => t.type === 'Expense');
  const totalIncome = income.reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = expenses.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalIncome.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+15.2% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+10.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalIncome - totalExpenses).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+20.5% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline">Export</Button>
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </div>
        </div>
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <CardDescription>A list of all recent financial transactions.</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={transactions} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="income">
           <Card>
            <CardHeader>
              <CardTitle>Income</CardTitle>
              <CardDescription>A list of all recent income.</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={income} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="expenses">
           <Card>
            <CardHeader>
              <CardTitle>Expenses</CardTitle>
              <CardDescription>A list of all recent expenses.</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={expenses} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TransactionTable({ transactions }: { transactions: typeof import('@/lib/mock-data').transactions }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
            <TableCell className="font-medium">{transaction.description}</TableCell>
            <TableCell>
              <Badge variant={transaction.type === 'Income' ? 'default' : 'secondary'} className={transaction.type === 'Income' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}>{transaction.type}</Badge>
            </TableCell>
            <TableCell>
               <Badge variant="outline" className={
                transaction.status === 'Paid' ? 'text-green-700 border-green-200' : 
                transaction.status === 'Pending' ? 'text-yellow-700 border-yellow-200' : 'text-red-700 border-red-200'
               }>{transaction.status}</Badge>
            </TableCell>
            <TableCell className="text-right">${transaction.amount.toFixed(2)}</TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>View Details</DropdownMenuItem>
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
