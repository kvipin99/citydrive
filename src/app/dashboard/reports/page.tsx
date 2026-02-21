
"use client"

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { FileDown, Printer, Filter, DollarSign, Users, Receipt, PieChart } from "lucide-react";
import { format, parseISO, isSameMonth, isSameYear } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

export default function ReportsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("financial");
  const [selectedBranch, setSelectedBranch] = useState<string>("Full");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("All");
  const [studentStatus, setStudentStatus] = useState<string>("All");
  const [paymentStatus, setPaymentStatus] = useState<string>("All");

  // Data Fetching
  const studentsQuery = useMemoFirebase(() => (db && user ? collection(db, 'students') : null), [db, user]);
  const paymentsQuery = useMemoFirebase(() => (db && user ? collection(db, 'payments') : null), [db, user]);
  const expensesQuery = useMemoFirebase(() => (db && user ? collection(db, 'expenses') : null), [db, user]);

  const { data: students, isLoading: isStudentsLoading } = useCollection(studentsQuery);
  const { data: payments, isLoading: isPaymentsLoading } = useCollection(paymentsQuery);
  const { data: expenses, isLoading: isExpensesLoading } = useCollection(expensesQuery);

  const isLoading = isStudentsLoading || isPaymentsLoading || isExpensesLoading;

  // --- REPORT LOGIC: FINANCIAL ---
  const financialData = useMemo(() => {
    if (!payments || !expenses) return [];
    
    let filteredPayments = [...payments];
    let filteredExpenses = [...expenses];

    if (selectedBranch !== "Full") {
      filteredPayments = filteredPayments.filter(p => p.branch === selectedBranch);
      filteredExpenses = filteredExpenses.filter(e => e.branch === selectedBranch);
    }

    // Grouping by Month for the table
    const months: Record<string, { income: number; expense: number }> = {};

    filteredPayments.forEach(p => {
      const date = p.date?.seconds ? new Date(p.date.seconds * 1000) : new Date();
      const key = format(date, 'yyyy-MM');
      if (!months[key]) months[key] = { income: 0, expense: 0 };
      months[key].income += Number(p.amount) || 0;
    });

    filteredExpenses.forEach(e => {
      const date = e.date ? new Date(e.date) : new Date();
      const key = format(date, 'yyyy-MM');
      if (!months[key]) months[key] = { income: 0, expense: 0 };
      months[key].expense += Number(e.amount) || 0;
    });

    return Object.entries(months)
      .map(([month, vals]) => ({
        period: month,
        income: vals.income,
        expense: vals.expense,
        profit: vals.income - vals.expense
      }))
      .sort((a, b) => b.period.localeCompare(a.period));
  }, [payments, expenses, selectedBranch]);

  // --- REPORT LOGIC: STUDENTS ---
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    let result = [...students];

    if (selectedBranch !== "Full") {
      result = result.filter(s => s.branch === selectedBranch);
    }

    if (studentStatus !== "All") {
      result = result.filter(s => s.status === studentStatus);
    }

    return result.sort((a, b) => (b.registrationDate || '').localeCompare(a.registrationDate || ''));
  }, [students, selectedBranch, studentStatus]);

  // --- REPORT LOGIC: PAYMENT DUES ---
  const paymentDuesData = useMemo(() => {
    if (!students) return [];
    
    const dues = students.map(s => {
      const totalAgreed = Number(s.amount) || 0;
      const totalPaid = s.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
      const balance = totalAgreed - totalPaid;
      
      let status = "Partial";
      if (totalPaid === 0) status = "No Fee Paid";
      else if (balance <= 0) status = "Full Paid";

      return { ...s, totalAgreed, totalPaid, balance, paymentStatus: status };
    });

    let result = dues;
    if (selectedBranch !== "Full") {
      result = result.filter(s => s.branch === selectedBranch);
    }

    if (paymentStatus !== "All") {
      result = result.filter(s => s.paymentStatus === paymentStatus);
    }

    return result.sort((a, b) => b.balance - a.balance);
  }, [students, selectedBranch, paymentStatus]);

  // --- EXPORT TOOLS ---
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
    <div className="space-y-6 print:p-0">
      {/* Header & Controls - Hidden on Print */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold tracking-tight">Business Reports</h2>
          <p className="text-muted-foreground">Generate and export financial and operational summaries.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Filter className="h-4 w-4" /> Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Branch View</label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full">Full School (All)</SelectItem>
                  {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {activeTab === 'students' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Student Status</label>
                <Select value={studentStatus} onValueChange={setStudentStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeTab === 'dues' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Payment Status</label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Students</SelectItem>
                    <SelectItem value="No Fee Paid">No Fee Paid</SelectItem>
                    <SelectItem value="Partial">Partial Paid</SelectItem>
                    <SelectItem value="Full Paid">Full Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="financial">Financial</TabsTrigger>
                <TabsTrigger value="students">Enrollment</TabsTrigger>
                <TabsTrigger value="dues">Dues</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-6">
              
              {/* FINANCIAL REPORT */}
              <TabsContent value="financial" className="m-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      Monthly Profit & Loss Statement
                    </h3>
                    <Badge variant="outline">{selectedBranch === 'Full' ? 'All Branches' : selectedBranch}</Badge>
                  </div>
                  
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Revenue (₹)</TableHead>
                          <TableHead className="text-right">Expenses (₹)</TableHead>
                          <TableHead className="text-right">Net Profit (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? <LoadingRows cols={4} /> : (
                          financialData.length === 0 ? <NoData colSpan={4} /> :
                          financialData.map((d) => (
                            <TableRow key={d.period}>
                              <TableCell className="font-medium">
                                {format(new Date(d.period + "-01"), 'MMMM yyyy')}
                              </TableCell>
                              <TableCell className="text-right text-green-600 font-medium">₹{d.income.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-red-600 font-medium">₹{d.expense.toLocaleString()}</TableCell>
                              <TableCell className={`text-right font-bold ${d.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                ₹{d.profit.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* ENROLLMENT REPORT */}
              <TabsContent value="students" className="m-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Student Registration Report
                    </h3>
                    <div className="flex gap-2">
                      <Badge variant="outline">{selectedBranch === 'Full' ? 'All Branches' : selectedBranch}</Badge>
                      <Badge variant="secondary">{studentStatus}</Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Student ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Reg Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Fee (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? <LoadingRows cols={5} /> : (
                          filteredStudents.length === 0 ? <NoData colSpan={5} /> :
                          filteredStudents.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-mono text-xs">{s.id}</TableCell>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{s.registrationDate}</TableCell>
                              <TableCell>
                                <Badge variant={s.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">
                                  {s.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">₹{s.amount?.toLocaleString()}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* PAYMENT DUES REPORT */}
              <TabsContent value="dues" className="m-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-orange-600" />
                      Payment Status & Dues Report
                    </h3>
                    <div className="flex gap-2">
                      <Badge variant="outline">{selectedBranch === 'Full' ? 'All Branches' : selectedBranch}</Badge>
                      <Badge variant="destructive">{paymentStatus === 'All' ? 'All Dues' : paymentStatus}</Badge>
                    </div>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead className="text-right">Agreed (₹)</TableHead>
                          <TableHead className="text-right">Paid (₹)</TableHead>
                          <TableHead className="text-right">Balance (₹)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? <LoadingRows cols={5} /> : (
                          paymentDuesData.length === 0 ? <NoData colSpan={5} /> :
                          paymentDuesData.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>
                                <div className="grid gap-0.5">
                                  <span className="font-medium text-sm">{s.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{s.id}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">₹{s.totalAgreed.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-green-600">₹{s.totalPaid.toLocaleString()}</TableCell>
                              <TableCell className={`text-right font-bold ${s.balance > 0 ? 'text-destructive' : 'text-green-700'}`}>
                                ₹{s.balance.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant={s.balance <= 0 ? 'outline' : 'destructive'} className="text-[10px]">
                                  {s.paymentStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Print View Styling */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print-hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {[1, 2, 3].map(i => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><div className="h-4 w-full animate-pulse bg-muted rounded" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function NoData({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground italic">
        No records found for the selected criteria.
      </TableCell>
    </TableRow>
  );
}
