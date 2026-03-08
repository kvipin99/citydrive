
"use client"

import { useMemo, useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { DollarSign, Receipt, TrendingUp, Calendar as CalendarIcon, RefreshCw, Layers, FileDown, Printer, MapPin } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  branch: string;
  category?: string;
  receiptNo?: string;
  studentId?: string;
}

export default function AccountingPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user?.uid]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  
  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';
  
  const [activeTab, setActiveTab] = useState<string>("daybook");
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    return collection(db, 'payments');
  }, [db, user?.uid, profile]);

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    return collection(db, 'expenses');
  }, [db, user?.uid, profile]);

  const { data: payments, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const { data: expenses, isLoading: isExpensesLoading } = useCollection(expensesQuery);

  // Synchronized robust matching logic
  const isFromBranch = useCallback((record: any, branchName: string) => {
    if (!branchName || branchName === "All" || branchName === "Full") return true;
    
    const normalize = (s: any) => s?.toString().replace(/\s+/g, '').toLowerCase() || '';
    const rBranch = normalize(record.branch || '');
    const targetBranch = normalize(branchName);
    
    // Direct match
    if (rBranch && rBranch === targetBranch) return true;

    // Numeric match (matches "B1" to "Branch 1")
    const rNum = rBranch.match(/\d+/)?.[0];
    const tNum = targetBranch.match(/\d+/)?.[0];
    if (rNum && tNum && rNum === tNum) return true;

    // ID prefix match
    const rid = normalize(record.id || '');
    const branchNum = tNum || targetBranch.replace(/[^0-9]/g, '');
    if (branchNum) {
      const bCode = `b${branchNum}`;
      const patterns = [bCode, `-${bCode}-`, `exp-${bCode}`, `rec-${bCode}`, `misc-${bCode}`];
      if (patterns.some(p => rid.includes(p))) return true;
      if (rid.startsWith(bCode)) return true;
    }
    
    return false;
  }, []);

  const parseSafeDate = (d: any) => {
    if (!d) return new Date();
    if (d.seconds) return new Date(d.seconds * 1000);
    const parsed = typeof d === 'string' ? parseISO(d) : new Date(d);
    return isValid(parsed) ? parsed : new Date();
  };

  const isWithinRange = (date: Date) => {
    const dStr = format(date, 'yyyy-MM-dd');
    return dStr >= dateRange.from && dStr <= dateRange.to;
  };

  const allTransactions = useMemo(() => {
    const income: Transaction[] = (payments || []).map(p => ({
      id: p.id,
      date: parseSafeDate(p.date),
      description: p.category === "Course Fee" ? `Fee: ${p.studentName || 'Student'}` : `${p.category}: ${p.studentName || 'Misc'}`,
      amount: Number(p.amount) || 0,
      type: 'Income',
      branch: p.branch || 'Unknown',
      receiptNo: p.receiptNo,
      studentId: p.studentId
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
    let result = allTransactions.filter(t => isWithinRange(t.date));
    
    // Admins see all consolidated, Managers see branch only
    const currentBranchContext = isAdmin ? "All" : (profile?.branch || "Branch 1");
    if (currentBranchContext !== "All" && currentBranchContext !== "Full") {
      result = result.filter(t => isFromBranch(t, currentBranchContext));
    }
    
    return result;
  }, [allTransactions, dateRange, isAdmin, profile?.branch, isFromBranch]);

  const incomeTransactions = useMemo(() => filteredTransactions.filter(t => t.type === 'Income'), [filteredTransactions]);
  const expenseTransactions = useMemo(() => filteredTransactions.filter(t => t.type === 'Expense'), [filteredTransactions]);

  const totalIncome = incomeTransactions.reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce((acc, t) => acc + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      toast({ variant: "destructive", title: "No Data", description: "There are no records to export for the selected period." });
      return;
    }

    const headers = ["Date", "Type", "Description", "Details", "Branch", "Amount (INR)"];
    const rows = filteredTransactions.map(t => {
      const details = t.receiptNo ? `REC:${t.receiptNo}` : (t.studentId ? `ID:${t.studentId}` : (t.category ? `CAT:${t.category}` : ''));
      return [
        format(t.date, 'yyyy-MM-dd'),
        t.type,
        t.description,
        details,
        t.branch,
        t.amount
      ];
    });

    const csvContent = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `citydrive_accounting_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "CSV Exported", description: "The accounting report has been downloaded." });
  };

  const handlePrint = () => {
    window.print();
  };

  const monthlySummary = useMemo(() => {
    const summary: Record<string, { income: number, expense: number }> = {};
    const context = isAdmin ? "All" : (profile?.branch || "Branch 1");
    const sourceData = allTransactions.filter(t => isFromBranch(t, context));
    
    sourceData.forEach(t => {
      const monthKey = format(t.date, 'yyyy-MM');
      if (!summary[monthKey]) summary[monthKey] = { income: 0, expense: 0 };
      if (t.type === 'Income') summary[monthKey].income += t.amount;
      else summary[monthKey].expense += t.amount;
    });
    return Object.entries(summary).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allTransactions, isAdmin, profile?.branch, isFromBranch]);

  const yearlySummary = useMemo(() => {
    const summary: Record<string, { income: number, expense: number }> = {};
    const context = isAdmin ? "All" : (profile?.branch || "Branch 1");
    const sourceData = allTransactions.filter(t => isFromBranch(t, context));
    
    sourceData.forEach(t => {
      const yearKey = format(t.date, 'yyyy');
      if (!summary[yearKey]) summary[yearKey] = { income: 0, expense: 0 };
      if (t.type === 'Income') summary[yearKey].income += t.amount;
      else summary[yearKey].expense += t.amount;
    });
    return Object.entries(summary).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allTransactions, isAdmin, profile?.branch, isFromBranch]);

  const isLoading = isProfileLoading || isPaymentsLoading || isExpensesLoading;

  if (isProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading accounting...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          .print-hidden { display: none !important; }
          .print-area { width: 100% !important; padding: 0 !important; margin: 0 !important; }
          body { background: white !important; }
          header, aside, .sidebar-provider, .fixed-header { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; width: 100% !important; }
          .card { border: none !important; box-shadow: none !important; }
          .tabs-list { display: none !important; }
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print-hidden">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Financial Daybook</h2>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? "Consolidated school-wide intake and expenditure accounts." : `Daily intake and expenditure accounts for ${profile?.branch}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-2">
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Separator orientation="vertical" className="h-8 mx-1 hidden sm:block" />
          <Button size="sm" asChild variant="outline">
            <Link href="/dashboard/expenses">New Expense</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/payments">Collect Fee</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 print-area">
        <Card className="md:col-span-1 shadow-sm border-primary/10 h-fit print-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" /> Period Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isAdmin && (
              <div className="p-3 rounded-lg bg-muted/50 border border-primary/10">
                <p className="text-[10px] font-black uppercase text-primary mb-1">Current Branch</p>
                <p className="text-sm font-bold flex items-center gap-2"><MapPin className="h-3 w-3" /> {profile?.branch}</p>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Date Range</Label>
              <div className="space-y-2">
                <div className="grid gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">From</span>
                  <Input 
                    type="date" 
                    className="h-9 text-xs" 
                    value={dateRange.from} 
                    onChange={(e) => setDateRange({...dateRange, from: e.target.value})} 
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">To</span>
                  <Input 
                    type="date" 
                    className="h-9 text-xs" 
                    value={dateRange.to} 
                    onChange={(e) => setDateRange({...dateRange, to: e.target.value})} 
                  />
                </div>
                <Button 
                  variant="outline" 
                  className="w-full h-8 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5"
                  onClick={() => setDateRange({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })}
                >
                  <CalendarIcon className="h-3 w-3 mr-1.5" />
                  Today
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-3 space-y-6 print:col-span-4">
          <div className="grid gap-4 md:grid-cols-3 print:grid-cols-3">
            <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Income</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500 print-hidden" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-green-600">₹{totalIncome.toLocaleString()}</div>
                <p className="text-[9px] text-muted-foreground font-medium">Selected period collections</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500 shadow-sm bg-red-50/10">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Expenses</CardTitle>
                <Receipt className="h-4 w-4 text-red-500 print-hidden" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-red-600">₹{totalExpenses.toLocaleString()}</div>
                <p className="text-[9px] text-muted-foreground font-medium">Selected period outgoings</p>
              </CardContent>
            </Card>
            <Card className={`border-l-4 shadow-sm bg-primary/5 ${netProfit >= 0 ? 'border-l-primary' : 'border-l-orange-500'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Net Balance</CardTitle>
                <TrendingUp className={`h-4 w-4 print-hidden ${netProfit >= 0 ? 'text-primary' : 'text-orange-500'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-black ${netProfit >= 0 ? 'text-primary' : 'text-orange-600'}`}>
                  ₹{netProfit.toLocaleString()}
                </div>
                <p className="text-[9px] text-muted-foreground font-medium">Closing balance for period</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/50 border print-hidden">
              <TabsTrigger value="daybook">Daybook Log</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
            
            <TabsContent value="daybook" className="mt-4">
              {isLoading ? <LoadingSpinner /> : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:grid-cols-2">
                  <Card className="border-green-100 shadow-sm overflow-hidden">
                    <CardHeader className="bg-green-50/50 py-3 border-b border-green-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-black text-green-700 uppercase tracking-widest flex items-center gap-2">
                          <DollarSign className="h-4 w-4" /> Income / Credit
                        </CardTitle>
                        <Badge variant="outline" className="bg-white text-green-700 border-green-200 print-hidden">{incomeTransactions.length} Items</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ItemizedTable transactions={incomeTransactions} colorClass="text-green-600" />
                      {incomeTransactions.length > 0 && (
                        <div className="p-4 bg-green-50/30 border-t flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase text-green-700">Total Credit</span>
                          <span className="text-lg font-black text-green-700">₹{totalIncome.toLocaleString()}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-red-100 shadow-sm overflow-hidden">
                    <CardHeader className="bg-red-50/50 py-3 border-b border-red-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-black text-red-700 uppercase tracking-widest flex items-center gap-2">
                          <Receipt className="h-4 w-4" /> Expenses / Debit
                        </CardTitle>
                        <Badge variant="outline" className="bg-white text-red-700 border-red-200 print-hidden">{expenseTransactions.length} Items</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ItemizedTable transactions={expenseTransactions} colorClass="text-red-600" />
                      {expenseTransactions.length > 0 && (
                        <div className="p-4 bg-green-50/30 border-t flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase text-red-700">Total Debit</span>
                          <span className="text-lg font-black text-red-700">₹{totalExpenses.toLocaleString()}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="monthly">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Summaries</CardTitle>
                  <CardDescription>
                    Aggregated performance by month for {isAdmin ? 'Full School' : profile?.branch}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? <LoadingSpinner /> : (
                    <SummaryTable data={monthlySummary} type="Month" />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="yearly">
              <Card>
                <CardHeader>
                  <CardTitle>Annual Overview</CardTitle>
                  <CardDescription>Consolidated yearly financials.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? <LoadingSpinner /> : (
                    <SummaryTable data={yearlySummary} type="Year" />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <RefreshCw className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ItemizedTable({ transactions, colorClass }: { transactions: Transaction[], colorClass: string }) {
  return (
    <Table>
      <TableHeader className="bg-muted/20">
        <TableRow>
          <TableHead className="w-[100px] pl-4">Date</TableHead>
          <TableHead>Details</TableHead>
          <TableHead className="text-right pr-4">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-center py-16 text-muted-foreground italic">
              <div className="flex flex-col items-center gap-2 opacity-40">
                <Layers className="h-8 w-8" />
                <p className="text-xs">No records for this side.</p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          transactions.map((t) => (
            <TableRow key={t.id} className="hover:bg-muted/10 group">
              <TableCell className="pl-4 text-[10px] font-medium text-muted-foreground">
                {format(t.date, 'MMM dd')}
              </TableCell>
              <TableCell>
                <div className="grid gap-0.5">
                  <span className="font-bold text-xs group-hover:text-primary transition-colors">{t.description}</span>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground uppercase font-mono">
                    {t.branch && <span className="text-primary font-bold">{t.branch}</span>}
                    {t.receiptNo && <span>#REC:{t.receiptNo}</span>}
                    {t.category && <span>CAT:{t.category}</span>}
                    {t.studentId && <span>ID:{t.studentId}</span>}
                  </div>
                </div>
              </TableCell>
              <TableCell className={`text-right font-black pr-4 text-sm ${colorClass}`}>
                ₹{t.amount.toLocaleString()}
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
  type
}: { 
  data: [string, { income: number, expense: number }][], 
  type: string
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{type}</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Expenses</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No data recorded.</TableCell>
          </TableRow>
        ) : (
          data.map(([period, values]) => {
            const profit = values.income - values.expense;
            return (
              <TableRow key={period} className="hover:bg-muted/50">
                <TableCell className="font-bold">
                  {type === 'Month' ? format(new Date(period + "-01"), 'MMMM yyyy') : period}
                </TableCell>
                <TableCell className="text-right text-green-600 font-medium">₹{values.income.toLocaleString()}</TableCell>
                <TableCell className="text-right text-red-600 font-medium">₹{values.expense.toLocaleString()}</TableCell>
                <TableCell className={`text-right font-black ${profit >= 0 ? 'text-primary' : 'text-red-700'}`}>
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
