
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
import { DollarSign, Receipt, TrendingUp, RefreshCw, Layers, FileDown, Printer, MapPin, Filter, ListTree, PieChart, Calendar } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import placeholderData from '@/app/lib/placeholder-images.json';
import { DateSegmentedInput } from "@/components/ui/date-segmented-input";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  branch: string;
  category: string;
  receiptNo?: string;
  studentId?: string;
}

const toUI = (iso: string) => {
  if (!iso) return 'N/A';
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return iso;
};

export default function AccountingPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const appLogo = useMemo(() => placeholderData.placeholderImages.find(img => img.id === 'app-logo'), []);

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user?.uid]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  
  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';
  
  const [activeTab, setActiveTab] = useState<string>("daybook");
  const [selectedBranch, setSelectedBranch] = useState<string>("All");
  const [viewMode, setViewMode] = useState<'detailed' | 'summary'>('detailed');
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (profile && !isAdmin) {
      setSelectedBranch(profile.branch || "Branch 1");
    }
  }, [profile, isAdmin]);

  const paymentsQuery = useMemoFirebase(() => (db && user && profile ? collection(db, 'payments') : null), [db, user?.uid, profile]);
  const expensesQuery = useMemoFirebase(() => (db && user && profile ? collection(db, 'expenses') : null), [db, user?.uid, profile]);

  const { data: payments, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const { data: expenses, isLoading: isExpensesLoading } = useCollection(expensesQuery);

  const isFromBranch = useCallback((record: any, branchName: string) => {
    if (!branchName || branchName === "All" || branchName === "Full") return true;
    const normalize = (s: any) => s?.toString().toLowerCase().trim().replace(/\s+/g, '') || '';
    const rBranch = normalize(record.branch);
    const targetBranch = normalize(branchName);
    if (rBranch === targetBranch) return true;
    const tNum = branchName.match(/\d+/)?.[0];
    if (tNum) {
      const rid = normalize(record.id || '');
      const bPattern = new RegExp(`(^|[^a-z0-9])b${tNum}`, 'i');
      if (bPattern.test(rid)) return true;
    }
    return false;
  }, []);

  const parseSafeDate = (d: any) => {
    if (!d) return new Date();
    if (d.seconds) return new Date(d.seconds * 1000);
    const parsed = typeof d === 'string' ? parseISO(d) : new Date(d);
    return isValid(parsed) ? parsed : new Date();
  };

  const allTransactions = useMemo(() => {
    const income: Transaction[] = (payments || []).map(p => ({ id: p.id, date: parseSafeDate(p.date), description: p.category === "Course Fee" ? `Fee: ${p.studentName || 'Student'}` : `${p.category}: ${p.studentName || 'Misc'}`, amount: Number(p.amount) || 0, type: 'Income', branch: p.branch || 'Unknown', category: p.category || 'Other Income', receiptNo: p.receiptNo, studentId: p.studentId }));
    const outgo: Transaction[] = (expenses || []).map(e => ({ id: e.id, date: parseSafeDate(e.date), description: e.description || `${e.category} Expense`, amount: Number(e.amount) || 0, type: 'Expense', branch: e.branch || 'Unknown', category: e.category || 'Others' }));
    return [...income, ...outgo].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [payments, expenses]);

  const filteredTransactions = useMemo(() => {
    let result = allTransactions.filter(t => { const d = format(t.date, 'yyyy-MM-dd'); return d >= dateRange.from && d <= dateRange.to; });
    const currentBranchContext = isAdmin ? selectedBranch : (profile?.branch || "Branch 1");
    if (currentBranchContext !== "All" && currentBranchContext !== "Full") result = result.filter(t => isFromBranch(t, currentBranchContext));
    return result;
  }, [allTransactions, dateRange, isAdmin, selectedBranch, profile?.branch, isFromBranch]);

  const incomeTransactions = useMemo(() => filteredTransactions.filter(t => t.type === 'Income'), [filteredTransactions]);
  const expenseTransactions = useMemo(() => filteredTransactions.filter(t => t.type === 'Expense'), [filteredTransactions]);
  const totalIncome = incomeTransactions.reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = expenseTransactions.reduce((acc, t) => acc + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  const incomeCategorySummary = useMemo(() => {
    const s: Record<string, { count: number, total: number }> = {};
    incomeTransactions.forEach(t => { const cat = t.category || "Other Income"; if (!s[cat]) s[cat] = { count: 0, total: 0 }; s[cat].count++; s[cat].total += t.amount; });
    return Object.entries(s).sort((a, b) => b[1].total - a[1].total);
  }, [incomeTransactions]);

  const expenseCategorySummary = useMemo(() => {
    const s: Record<string, { count: number, total: number }> = {};
    expenseTransactions.forEach(t => { const cat = t.category || "Others"; if (!s[cat]) s[cat] = { count: 0, total: 0 }; s[cat].count++; s[cat].total += t.amount; });
    return Object.entries(s).sort((a, b) => b[1].total - a[1].total);
  }, [expenseTransactions]);

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) { toast({ variant: "destructive", title: "No Data" }); return; }
    const h = ["Date", "Type", "Category", "Description", "Details", "Branch", "Amount"];
    const rows = filteredTransactions.map(t => [format(t.date, 'yyyy-MM-dd'), t.type, t.category, t.description, t.receiptNo || t.studentId || '', t.branch, t.amount]);
    const csv = [h, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `accounting_${format(new Date(), 'yyyy-MM-dd')}.csv`; link.click();
    toast({ title: "Exported" });
  };

  const monthlySummary = useMemo(() => {
    const s: Record<string, { income: number, expense: number }> = {};
    const context = isAdmin ? selectedBranch : (profile?.branch || "Branch 1");
    allTransactions.filter(t => isFromBranch(t, context)).forEach(t => { const k = format(t.date, 'yyyy-MM'); if (!s[k]) s[k] = { income: 0, expense: 0 }; if (t.type === 'Income') s[k].income += t.amount; else s[k].expense += t.amount; });
    return Object.entries(s).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allTransactions, isAdmin, selectedBranch, profile?.branch, isFromBranch]);

  const yearlySummary = useMemo(() => {
    const s: Record<string, { income: number, expense: number }> = {};
    const context = isAdmin ? selectedBranch : (profile?.branch || "Branch 1");
    allTransactions.filter(t => isFromBranch(t, context)).forEach(t => { 
      const k = format(t.date, 'yyyy'); 
      if (!s[k]) s[k] = { income: 0, expense: 0 }; 
      if (t.type === 'Income') s[k].income += t.amount; 
      else s[k].expense += t.amount; 
    });
    return Object.entries(s).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allTransactions, isAdmin, selectedBranch, profile?.branch, isFromBranch]);

  const isLoading = isProfileLoading || isPaymentsLoading || isExpensesLoading;

  if (isProfileLoading) return <div className="flex flex-col items-center justify-center py-20 gap-4"><RefreshCw className="h-8 w-8 animate-spin text-primary" /><p className="text-sm">Loading accounting...</p></div>;

  return (
    <div className="space-y-6">
      <div className="print-only-header">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-3"><div className="relative h-12 w-12 bg-white flex items-center justify-center rounded-lg border-2 border-primary overflow-hidden">{appLogo && <Image src={appLogo.imageUrl} alt="Logo" fill className="object-contain p-1" data-ai-hint={appLogo.imageHint}/>}</div><div><h1 className="text-2xl font-black text-primary uppercase">Citydrive Systems</h1><p className="text-xs font-bold text-muted-foreground uppercase">Management Portal</p></div></div>
          <div className="text-right"><h2 className="text-lg font-bold uppercase">Financial Daybook</h2><p className="text-xs font-medium">Branch: {isAdmin ? selectedBranch : profile?.branch} | Period: {toUI(dateRange.from)} to {toUI(dateRange.to)}</p></div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print-hidden">
        <div className="grid gap-1"><h2 className="text-2xl font-bold tracking-tight">Financial Daybook</h2><p className="text-muted-foreground text-sm">{isAdmin ? "Consolidated school-wide accounts." : `Daily accounts for ${profile?.branch}.`}</p></div>
        <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Print</Button><Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-2"><FileDown className="h-4 w-4" /> CSV</Button><Separator orientation="vertical" className="h-8 mx-1 hidden sm:block" /><Button size="sm" asChild variant="outline"><Link href="/dashboard/expenses">New Expense</Link></Button><Button size="sm" asChild><Link href="/dashboard/payments">Collect Fee</Link></Button></div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 print-area">
        <Card className="md:col-span-1 shadow-sm border-primary/10 h-fit print-hidden"><CardHeader className="pb-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><Filter className="h-4 w-4" /> Filter Records</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5"><Label className="text-xs font-black uppercase text-primary tracking-widest">Branch View</Label><Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!isAdmin}><SelectTrigger className="h-9 font-bold"><SelectValue placeholder="Branch" /></SelectTrigger><SelectContent><SelectItem value="All">All Branches</SelectItem>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-3"><Label className="text-xs font-black uppercase text-primary tracking-widest">Date Range</Label><div className="space-y-2">
                <div className="grid gap-1"><span className="text-xs font-medium text-muted-foreground uppercase">From</span><DateSegmentedInput value={dateRange.from} onChange={(v) => setDateRange({...dateRange, from: v})} /></div>
                <div className="grid gap-1"><span className="text-xs font-medium text-muted-foreground uppercase">To</span><DateSegmentedInput value={dateRange.to} onChange={(v) => setDateRange({...dateRange, to: v})} /></div>
                <Button variant="outline" className="w-full h-8 text-[11px] font-bold border-primary/20 text-primary" onClick={() => setDateRange({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })}>Today</Button>
              </div></div>
          </CardContent></Card>

        <div className="md:col-span-3 space-y-6 print:col-span-4">
          <div className="grid gap-4 md:grid-cols-3 print-grid">
            <Card className="border-l-4 border-l-green-500 bg-green-50/10"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Total Income</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-black text-green-600">₹{totalIncome.toLocaleString()}</div></CardContent></Card>
            <Card className="border-l-4 border-l-red-500 bg-red-50/10"><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Total Expenses</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-black text-red-600">₹{totalExpenses.toLocaleString()}</div></CardContent></Card>
            <Card className={`border-l-4 ${netProfit >= 0 ? 'border-l-primary' : 'border-l-orange-500'} bg-primary/5`}><CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Net Balance</CardTitle></CardHeader><CardContent className="p-4 pt-0"><div className={`text-2xl font-black ${netProfit >= 0 ? 'text-primary' : 'text-orange-600'}`}>₹{netProfit.toLocaleString()}</div></CardContent></Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4"><TabsList className="grid w-full grid-cols-3 max-w-md bg-muted/50 border print-hidden"><TabsTrigger value="daybook">Daybook Log</TabsTrigger><TabsTrigger value="monthly">Monthly</TabsTrigger><TabsTrigger value="yearly">Yearly</TabsTrigger></TabsList>
              {activeTab === 'daybook' && (<div className="flex items-center gap-2 print-hidden"><Button size="sm" variant={viewMode === 'detailed' ? 'default' : 'outline'} onClick={() => setViewMode('detailed')} className="h-8 text-[11px] font-bold uppercase"><ListTree className="h-3 w-3 mr-1.5" />Itemized</Button><Button size="sm" variant={viewMode === 'summary' ? 'default' : 'outline'} onClick={() => setViewMode('summary')} className="h-8 text-[11px] font-bold uppercase"><PieChart className="h-3 w-3 mr-1.5" />Summary</Button></div>)}
            </div>
            <TabsContent value="daybook" className="mt-0">
              {isLoading ? <LoadingSpinner /> : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print-dual-table">
                  <Card className="border-green-100 overflow-hidden"><CardHeader className="bg-green-50/50 py-3"><CardTitle className="text-sm font-black text-green-700 uppercase flex items-center gap-2"><DollarSign className="h-4 w-4" /> Credit</CardTitle></CardHeader>
                    <CardContent className="p-0">{viewMode === 'detailed' ? <ItemizedTable transactions={incomeTransactions} colorClass="text-green-600" /> : <CategorySummaryTable data={incomeCategorySummary} colorClass="text-green-600" />}{incomeTransactions.length > 0 && (<div className="p-4 bg-green-50/30 border-t flex justify-between items-center"><span className="text-xs font-bold uppercase text-green-700">Total Credit</span><span className="text-lg font-black text-green-700">₹{totalIncome.toLocaleString()}</span></div>)}</CardContent></Card>
                  <Card className="border-red-100 overflow-hidden"><CardHeader className="bg-red-50/50 py-3"><CardTitle className="text-sm font-black text-red-700 uppercase flex items-center gap-2"><Receipt className="h-4 w-4" /> Debit</CardTitle></CardHeader>
                    <CardContent className="p-0">{viewMode === 'detailed' ? <ItemizedTable transactions={expenseTransactions} colorClass="text-red-600" /> : <CategorySummaryTable data={expenseCategorySummary} colorClass="text-red-600" />}{expenseTransactions.length > 0 && (<div className="p-4 bg-red-50/30 border-t flex justify-between items-center"><span className="text-xs font-bold uppercase text-red-700">Total Debit</span><span className="text-lg font-black text-red-700">₹{totalExpenses.toLocaleString()}</span></div>)}</CardContent></Card>
                </div>
              )}
            </TabsContent>
            <TabsContent value="monthly">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Monthly Summaries</CardTitle>
                  <CardDescription>Consolidated revenue and expenses by month.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? <LoadingSpinner /> : <SummaryTable data={monthlySummary} type="Month" />}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="yearly">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Yearly Summaries</CardTitle>
                  <CardDescription>Consolidated financial performance by fiscal year.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? <LoadingSpinner /> : <SummaryTable data={yearlySummary} type="Year" />}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <div className="print-footer">Generated via Citydrive Portal on {format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
    </div>
  );
}

function LoadingSpinner() { return <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>; }

function ItemizedTable({ transactions, colorClass }: { transactions: Transaction[], colorClass: string }) {
  return (
    <Table><TableHeader className="bg-muted/20"><TableRow><TableHead className="w-[100px] pl-4">Date</TableHead><TableHead>Details</TableHead><TableHead className="text-right pr-4">Amount</TableHead></TableRow></TableHeader>
      <TableBody>{transactions.length === 0 ? (<TableRow><TableCell colSpan={3} className="text-center py-16 text-muted-foreground italic">No records.</TableCell></TableRow>) : transactions.map((t) => (
        <TableRow key={t.id} className="hover:bg-muted/10 group"><TableCell className="pl-4 text-xs font-medium text-muted-foreground">{format(t.date, 'dd/MM')}</TableCell><TableCell><div className="grid gap-0.5"><span className="font-bold text-xs group-hover:text-primary transition-colors">{t.description}</span><div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase font-mono">{t.branch && <span className="text-primary font-bold">{t.branch}</span>}{t.category && <span className="bg-muted px-1 rounded-sm text-[10px] font-black">{t.category}</span>}</div></div></TableCell><TableCell className={`text-right font-black pr-4 text-sm ${colorClass}`}>₹{t.amount.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table>
  );
}

function CategorySummaryTable({ data, colorClass }: { data: [string, { count: number, total: number }][], colorClass: string }) {
  return (
    <Table><TableHeader className="bg-muted/20"><TableRow><TableHead className="pl-4">Category</TableHead><TableHead className="text-center">Entries</TableHead><TableHead className="text-right pr-4">Total</TableHead></TableRow></TableHeader>
      <TableBody>{data.length === 0 ? (<TableRow><TableCell colSpan={3} className="text-center py-16 text-muted-foreground italic">No entries.</TableCell></TableRow>) : data.map(([cat, vals]) => (
        <TableRow key={cat} className="hover:bg-muted/10 group"><TableCell className="pl-4"><span className="font-bold text-xs uppercase">{cat}</span></TableCell><TableCell className="text-center"><Badge variant="secondary" className="text-xs py-0">{vals.count}</Badge></TableCell><TableCell className={`text-right font-black pr-4 text-sm ${colorClass}`}>₹{vals.total.toLocaleString()}</TableCell></TableRow>))}</TableBody></Table>
  );
}

function SummaryTable({ data, type }: { data: [string, { income: number, expense: number }][], type: string }) {
  return (
    <Table><TableHeader><TableRow><TableHead>{type}</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Expenses</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
      <TableBody>{data.length === 0 ? (<TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No data.</TableCell></TableRow>) : data.map(([period, values]) => { const profit = values.income - values.expense; return (<TableRow key={period} className="hover:bg-muted/50"><TableCell className="font-bold">{type === 'Month' ? format(new Date(period + "-01"), 'MMMM yyyy') : period}</TableCell><TableCell className="text-right text-green-600 font-medium">₹{values.income.toLocaleString()}</TableCell><TableCell className="text-right text-red-600 font-medium">₹{values.expense.toLocaleString()}</TableCell><TableCell className={`text-right font-black ${profit >= 0 ? 'text-primary' : 'text-red-700'}`}>₹{profit.toLocaleString()}</TableCell></TableRow>); })}</TableBody></Table>
  );
}
