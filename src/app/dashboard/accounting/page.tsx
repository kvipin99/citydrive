
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { DollarSign, Receipt, TrendingUp, Calendar as CalendarIcon, RefreshCw, Layers, FileDown, Printer, MapPin, Filter, Car } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

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
  const [selectedBranch, setSelectedBranch] = useState<string>("All");
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (profile && !isAdmin) {
      setSelectedBranch(profile.branch || "Branch 1");
    }
  }, [profile, isAdmin]);

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

  // Precise Matching Logic (Regex Boundary System)
  const isFromBranch = useCallback((record: any, branchName: string) => {
    if (!branchName || branchName === "All" || branchName === "Full") return true;
    
    const normalize = (s: any) => s?.toString().toLowerCase().trim() || '';
    const rBranch = normalize(record.branch);
    const targetBranch = normalize(branchName);
    
    // 1. Direct Name Match
    if (rBranch && rBranch === targetBranch) return true;

    // 2. Numeric Extraction Match
    const tNum = branchName.match(/\d+/)?.[0];
    const rNum = record.branch?.match(/\d+/)?.[0];
    if (tNum && rNum && tNum === rNum) return true;

    // 3. ID Based Match (EXP-B1 / REC-B1)
    if (tNum) {
      const rid = normalize(record.id || '');
      const sid = normalize(record.studentId || '');
      const bPattern = new RegExp(`(^|[^a-z0-9])b${tNum}([^a-z0-9]|$)`, 'i');
      if (bPattern.test(rid) || bPattern.test(sid)) return true;
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
    
    const currentBranchContext = isAdmin ? selectedBranch : (profile?.branch || "Branch 1");
    if (currentBranchContext !== "All" && currentBranchContext !== "Full") {
      result = result.filter(t => isFromBranch(t, currentBranchContext));
    }
    
    return result;
  }, [allTransactions, dateRange, isAdmin, selectedBranch, profile?.branch, isFromBranch]);

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
    const context = isAdmin ? selectedBranch : (profile?.branch || "Branch 1");
    const sourceData = allTransactions.filter(t => isFromBranch(t, context));
    
    sourceData.forEach(t => {
      const monthKey = format(t.date, 'yyyy-MM');
      if (!summary[monthKey]) summary[monthKey] = { income: 0, expense: 0 };
      if (t.type === 'Income') summary[monthKey].income += t.amount;
      else summary[monthKey].expense += t.amount;
    });
    return Object.entries(summary).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allTransactions, isAdmin, selectedBranch, profile?.branch, isFromBranch]);

  const yearlySummary = useMemo(() => {
    const summary: Record<string, { income: number, expense: number }> = {};
    const context = isAdmin ? selectedBranch : (profile?.branch || "Branch 1");
    const sourceData = allTransactions.filter(t => isFromBranch(t, context));
    
    sourceData.forEach(t => {
      const yearKey = format(t.date, 'yyyy');
      if (!summary[yearKey]) summary[yearKey] = { income: 0, expense: 0 };
      if (t.type === 'Income') summary[yearKey].income += t.amount;
      else summary[yearKey].expense += t.amount;
    });
    return Object.entries(summary).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allTransactions, isAdmin, selectedBranch, profile?.branch, isFromBranch]);

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
          /* Hide interactive and background elements */
          .print-hidden, header, aside, .sidebar-provider, .fixed-header, nav, button { 
            display: none !important; 
          }
          
          /* Full width layout for print */
          .print-area, body, main { 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important; 
          }
          
          .card { 
            border: 1px solid #eee !important; 
            box-shadow: none !important; 
            margin-bottom: 20px !important;
          }

          /* Force background colors in PDF */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Show the hidden header */
          .print-only-header {
            display: block !important;
            margin-bottom: 30px;
            border-bottom: 4px solid hsl(var(--primary));
            padding-bottom: 15px;
          }

          .print-footer {
            display: block !important;
            position: fixed;
            bottom: 0;
            width: 100%;
            text-align: center;
            font-size: 10px;
            color: #666;
            padding: 10px 0;
            border-top: 1px solid #eee;
          }

          /* Grid adjustments for standard A4 */
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 15px !important;
          }
          
          .print-dual-table {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 20px !important;
          }

          h2, h3 { color: black !important; }
        }

        .print-only-header, .print-footer {
          display: none;
        }
      `}</style>

      {/* PRINT-ONLY HEADER */}
      <div className="print-only-header">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-primary flex items-center justify-center rounded-lg text-white">
              <Car className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-primary uppercase">Citydrive Systems</h1>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Driving School Management Portal</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold uppercase">Financial Daybook Report</h2>
            <p className="text-xs font-medium">Branch: <span className="font-bold">{isAdmin ? selectedBranch : profile?.branch}</span></p>
            <p className="text-xs font-medium">Period: <span className="font-bold">{dateRange.from} to {dateRange.to}</span></p>
          </div>
        </div>
      </div>

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
              <CalendarIcon className="h-4 w-4" /> Filter Records
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Branch View</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!isAdmin}>
                <SelectTrigger className="h-9 font-bold">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Branches</SelectItem>
                  {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              {!isAdmin && (
                <div className="mt-2 p-2 rounded-md bg-muted/50 border flex items-center gap-2 text-xs font-medium">
                  <MapPin className="h-3 w-3 text-primary" /> {profile?.branch}
                </div>
              )}
            </div>

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
          <div className="grid gap-4 md:grid-cols-3 print-grid">
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
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print-dual-table">
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
                        <div className="p-4 bg-red-50/30 border-t flex justify-between items-center">
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
                    Aggregated performance by month for {isAdmin ? (selectedBranch === 'All' ? 'Full School' : selectedBranch) : profile?.branch}.
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

      <div className="print-footer">
        Generated by Citydrive Management Portal on {format(new Date(), 'MMM dd, yyyy HH:mm')}
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
