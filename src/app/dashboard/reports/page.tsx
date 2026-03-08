"use client"

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, doc, query, where } from "firebase/firestore";
import { FileDown, Printer, Filter, DollarSign, Users, Receipt, RefreshCw, Calendar as CalendarIcon, Car } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

export default function ReportsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';

  const [activeTab, setActiveTab] = useState("financial");
  const [selectedBranch, setSelectedBranch] = useState<string>("Full");
  const [studentStatus, setStudentStatus] = useState<string>("All");
  const [paymentStatus, setPaymentStatus] = useState<string>("All");
  
  const [dateRange, setDateRange] = useState({
    from: format(new Date(), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (profile && !isAdmin) {
      setSelectedBranch(profile.branch || "Branch 1");
    }
  }, [profile, isAdmin]);

  const studentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    return collection(db, 'students');
  }, [db, user, profile]);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    return collection(db, 'payments');
  }, [db, user, profile]);

  const expensesQuery = useMemoFirebase(() => {
    if (!db || !user || !profile) return null;
    return collection(db, 'expenses');
  }, [db, user, profile]);

  const { data: students, isLoading: isStudentsLoading } = useCollection(studentsQuery);
  const { data: payments, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const { data: expenses, isLoading: isExpensesLoading } = useCollection(expensesQuery);

  const isActuallyLoading = isProfileLoading || isStudentsLoading || isPaymentsLoading || isExpensesLoading;

  const isFromBranch = (record: any, branchName: string) => {
    if (branchName === "Full" || branchName === "All") return true;
    if (record.branch === branchName) return true;
    const branchNum = branchName.match(/\d+/)?.[0];
    if (branchNum) {
      const prefix = `B${branchNum}`;
      if (record.id?.startsWith(prefix)) return true;
      if (record.studentId?.startsWith(prefix)) return true;
    }
    return false;
  };

  const isWithinRange = (dateVal: any) => {
    if (!dateVal) return false;
    let d: Date;
    if (dateVal.seconds) d = new Date(dateVal.seconds * 1000);
    else if (typeof dateVal === 'string') d = parseISO(dateVal);
    else d = new Date(dateVal);
    if (!isValid(d)) return false;
    const dStr = format(d, 'yyyy-MM-dd');
    return dStr >= dateRange.from && dStr <= dateRange.to;
  };

  const financialData = useMemo(() => {
    if (!payments || !expenses) return [];
    let filteredPayments = (payments || []).filter(p => isWithinRange(p.date));
    let filteredExpenses = (expenses || []).filter(e => isWithinRange(e.date));
    const currentBranchContext = isAdmin ? selectedBranch : (profile?.branch || "Branch 1");
    if (currentBranchContext !== "Full") {
      filteredPayments = filteredPayments.filter(p => isFromBranch(p, currentBranchContext));
      filteredExpenses = filteredExpenses.filter(e => isFromBranch(e, currentBranchContext));
    }
    const months: Record<string, { income: number; expense: number }> = {};
    filteredPayments.forEach(p => {
      const date = p.date?.seconds ? new Date(p.date.seconds * 1000) : (typeof p.date === 'string' ? parseISO(p.date) : new Date(p.date));
      if (!isValid(date)) return;
      const key = format(date, 'yyyy-MM');
      if (!months[key]) months[key] = { income: 0, expense: 0 };
      months[key].income += Number(p.amount) || 0;
    });
    filteredExpenses.forEach(e => {
      const date = e.date ? parseISO(e.date) : new Date();
      if (!isValid(date)) return;
      const key = format(date, 'yyyy-MM');
      if (!months[key]) months[key] = { income: 0, expense: 0 };
      months[key].expense += Number(e.amount) || 0;
    });
    return Object.entries(months).map(([month, vals]) => ({
      period: month,
      income: vals.income,
      expense: vals.expense,
      profit: vals.income - vals.expense
    })).sort((a, b) => b.period.localeCompare(a.period));
  }, [payments, expenses, selectedBranch, isAdmin, dateRange, profile]);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    let result = students.filter(s => isWithinRange(s.registrationDate));
    const currentBranchContext = isAdmin ? selectedBranch : (profile?.branch || "Branch 1");
    if (currentBranchContext !== "Full") result = result.filter(s => isFromBranch(s, currentBranchContext));
    if (studentStatus !== "All") result = result.filter(s => s.status === studentStatus);
    return result.sort((a, b) => (b.registrationDate || '').localeCompare(a.registrationDate || ''));
  }, [students, selectedBranch, studentStatus, isAdmin, dateRange, profile]);

  const paymentDuesData = useMemo(() => {
    if (!students) return [];
    let result = students.filter(s => isWithinRange(s.registrationDate));
    const currentBranchContext = isAdmin ? selectedBranch : (profile?.branch || "Branch 1");
    if (currentBranchContext !== "Full") result = result.filter(s => isFromBranch(s, currentBranchContext));
    const dues = result.map(s => {
      const totalAgreed = Number(s.amount) || 0;
      const totalPaid = s.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
      const balance = totalAgreed - totalPaid;
      let status = "Partial";
      if (totalPaid === 0) status = "No Fee Paid";
      else if (balance <= 0) status = "Full Paid";
      return { ...s, totalAgreed, totalPaid, balance, paymentStatus: status };
    });
    if (paymentStatus !== "All") return dues.filter(s => s.paymentStatus === paymentStatus).sort((a, b) => b.balance - a.balance);
    return dues.sort((a, b) => b.balance - a.balance);
  }, [students, selectedBranch, paymentStatus, isAdmin, dateRange, profile]);

  const handleExportCSV = (type: string) => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `report_${type}_${new Date().toISOString().split('T')[0]}.csv`;
    if (type === 'financial') {
      headers = ["Period", "Revenue (₹)", "Expenses (₹)", "Net Profit (₹)"];
      rows = financialData.map(d => [format(new Date(d.period + "-01"), 'MMMM yyyy'), d.income, d.expense, d.profit]);
    } else if (type === 'students') {
      headers = ["ID", "Name", "Branch", "Status", "Reg Date", "Agreed Fee"];
      rows = filteredStudents.map(s => [s.id, s.name, s.branch, s.status, s.registrationDate, s.amount]);
    } else if (type === 'dues') {
      headers = ["ID", "Name", "Branch", "Agreed Fee", "Paid", "Balance", "Status"];
      rows = paymentDuesData.map(s => [s.id, s.name, s.branch, s.totalAgreed, s.totalPaid, s.balance, s.paymentStatus]);
    }
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export Started", description: `Downloading ${filename}...` });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          .print-hidden, 
          nav, 
          header, 
          aside,
          [data-sidebar="sidebar"],
          .sidebar-provider,
          .sidebar-wrapper,
          [data-sidebar="trigger"],
          [data-sidebar="rail"],
          button, 
          .tabs-list { 
            display: none !important; 
          }
          body, main, .print-area { 
            width: 100% !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            background: white !important; 
            left: 0 !important;
            position: relative !important;
          }
          .card { border: 1px solid #eee !important; box-shadow: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-only-header { display: block !important; margin-bottom: 25px; border-bottom: 3px solid hsl(var(--primary)); padding-bottom: 10px; }
          .print-footer { display: block !important; position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding: 10px 0; }
        }
        .print-only-header, .print-footer { display: none; }
      `}</style>

      {/* PRINT HEADER */}
      <div className="print-only-header">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary flex items-center justify-center rounded-lg text-white">
              <Car className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-primary uppercase">Citydrive Systems</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Performance Analysis Report</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-md font-bold uppercase">{activeTab === 'financial' ? 'P&L Statement' : activeTab === 'students' ? 'Enrollment Report' : 'Dues & Outstanding'}</h2>
            <p className="text-[10px]">Branch: {isAdmin ? selectedBranch : profile?.branch} | Period: {dateRange.from} to {dateRange.to}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Business Reports</h2>
          <p className="text-muted-foreground">{isAdmin ? 'Generate financial and operational summaries.' : `Performance reports for ${profile?.branchName || profile?.branch || 'your branch'}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print / PDF
          </Button>
          <Button size="sm" onClick={() => handleExportCSV(activeTab)}>
            <FileDown className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print-area">
        <Card className="md:col-span-1 print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="h-4 w-4" /> Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Date Range</Label>
              <div className="space-y-2">
                <div className="grid gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">From</span>
                  <Input type="date" className="h-9 text-xs" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} />
                </div>
                <div className="grid gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">To</span>
                  <Input type="date" className="h-9 text-xs" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} />
                </div>
                <Button variant="outline" className="w-full h-8 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5" onClick={() => setDateRange({ from: format(new Date(), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') })}>
                  <CalendarIcon className="h-3 w-3 mr-1.5" /> Today
                </Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase text-[10px] tracking-widest text-muted-foreground">Branch View</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!isAdmin}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Full">Full School (All)</SelectItem>{BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 print:col-span-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="pb-0 print:hidden">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="students">Enrollment</TabsTrigger>
                <TabsTrigger value="dues">Dues</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-6">
              <TabsContent value="financial" className="m-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-600" />Profit & Loss Statement</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50"><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Expenses</TableHead><TableHead className="text-right">Net Profit</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {isActuallyLoading ? <LoadingRows cols={4} /> : (financialData.length === 0 ? <NoData colSpan={4} /> : financialData.map((d) => (
                          <TableRow key={d.period}><TableCell className="font-medium">{format(new Date(d.period + "-01"), 'MMMM yyyy')}</TableCell><TableCell className="text-right text-green-600 font-medium">₹{d.income.toLocaleString()}</TableCell><TableCell className="text-right text-red-600 font-medium">₹{d.expense.toLocaleString()}</TableCell><TableCell className={`text-right font-bold ${d.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{d.profit.toLocaleString()}</TableCell></TableRow>
                        )))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="students" className="m-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Registration Report</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50"><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead>Reg Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Fee</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {isActuallyLoading ? <LoadingRows cols={5} /> : (filteredStudents.length === 0 ? <NoData colSpan={5} /> : filteredStudents.map((s) => (
                          <TableRow key={s.id}><TableCell className="font-mono text-xs">{s.id}</TableCell><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-xs text-muted-foreground">{s.registrationDate}</TableCell><TableCell><Badge variant={s.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">{s.status}</Badge></TableCell><TableCell className="text-right">₹{s.amount?.toLocaleString()}</TableCell></TableRow>
                        )))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="dues" className="m-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2"><Receipt className="h-5 w-5 text-orange-600" />Fee Status & Dues</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50"><TableRow><TableHead>Student</TableHead><TableHead className="text-right">Agreed</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {isActuallyLoading ? <LoadingRows cols={5} /> : (paymentDuesData.length === 0 ? <NoData colSpan={5} /> : paymentDuesData.map((s) => (
                          <TableRow key={s.id}><TableCell><div className="grid gap-0.5"><span className="font-medium text-sm">{s.name}</span><span className="text-[10px] text-muted-foreground">{s.id}</span></div></TableCell><TableCell className="text-right">₹{s.totalAgreed.toLocaleString()}</TableCell><TableCell className="text-right text-green-600">₹{s.totalPaid.toLocaleString()}</TableCell><TableCell className={`text-right font-bold ${s.balance > 0 ? 'text-destructive' : 'text-green-700'}`}>₹{s.balance.toLocaleString()}</TableCell><TableCell><Badge variant={s.balance <= 0 ? 'outline' : 'destructive'} className="text-[10px]">{s.paymentStatus}</Badge></TableCell></TableRow>
                        )))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
      <div className="print-footer">Report generated via Citydrive Systems on {format(new Date(), 'MMM dd, yyyy HH:mm')}</div>
    </div>
  );
}

function LoadingRows({ cols }: { cols: number }) {
  return (<>{[1, 2, 3].map(i => (<TableRow key={i}>{Array.from({ length: cols }).map((_, j) => (<TableCell key={j}><div className="h-4 w-full animate-pulse bg-muted rounded" /></TableCell>))}</TableRow>))}</>);
}

function NoData({ colSpan }: { colSpan: number }) {
  return (<TableRow><TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground italic">No records found for the selected period.</TableCell></TableRow>);
}
