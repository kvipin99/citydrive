
"use client";

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Mail, MapPin, Calendar, Clock, CreditCard, Wallet, GraduationCap, User as UserIcon, BookOpen, Car, Fingerprint, FileText, Receipt as ReceiptIcon } from "lucide-react";
import { format, isValid } from "date-fns";
import { useMemo } from "react";

export default function StudentProfilePage() {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userProfileRef);

  const studentQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collection(db, "students"), where("userId", "==", user.uid));
  }, [db, user?.uid]);
  const { data: studentRecords, isLoading: isStudentLoading } = useCollection(studentQuery);
  const student = studentRecords?.[0];

  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    // CRITICAL: Students MUST query by studentUid to comply with security rules
    return query(collection(db, "attendance"), where("studentUid", "==", user.uid));
  }, [db, user?.uid]);
  const { data: attendance } = useCollection(attendanceQuery);

  const paidAmount = useMemo(() => {
    return student?.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
  }, [student?.payments]);

  const balance = (student?.amount || 0) - paidAmount;
  
  const hourStats = useMemo(() => {
    if (!attendance) return { practical: 0, theory: 0, total: 0 };
    return attendance.reduce((acc, curr) => {
      const h = Number(curr.duration) || 0;
      if (curr.type === 'Theory') acc.theory += h;
      else acc.practical += h;
      acc.total += h;
      return acc;
    }, { practical: 0, theory: 0, total: 0 });
  }, [attendance]);

  if (isStudentLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
        <h2 className="text-xl font-bold">Profile Not Found</h2>
        <p className="text-muted-foreground">Your student record could not be located.</p>
      </div>
    );
  }

  const formatSafeDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isValid(d) ? format(d, 'MMM dd, yyyy') : 'N/A';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center gap-6 p-8 bg-primary/5 rounded-3xl border border-primary/10">
        <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
          <AvatarImage src={student.photoUrl} alt={student.name} />
          <AvatarFallback className="text-4xl bg-primary text-white font-bold">
            {student.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="text-center md:text-left space-y-2">
          <h1 className="text-3xl font-black tracking-tight">{student.name}</h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-2">
            <Badge variant="secondary" className="font-mono font-bold">{student.id}</Badge>
            {student.registerNo && <Badge variant="outline" className="font-bold border-primary/20 text-primary">REG: {student.registerNo}</Badge>}
            <Badge variant="outline" className="uppercase font-bold text-[10px] tracking-widest">{student.branch}</Badge>
            <Badge variant={student.status === 'Active' ? 'default' : 'secondary'}>{student.status}</Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Practical Log" value={`${hourStats.practical.toFixed(1)}h`} icon={<Car className="text-blue-600" />} />
        <StatCard label="Theory Log" value={`${hourStats.theory.toFixed(1)}h`} icon={<BookOpen className="text-orange-600" />} />
        <StatCard label="Fees Paid" value={`₹${paidAmount.toLocaleString()}`} icon={<CreditCard className="text-green-600" />} />
        <StatCard label="Balance Due" value={`₹${balance.toLocaleString()}`} icon={<Clock className="text-destructive" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" />
                Personal & Licensing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DetailItem label="Mobile Number" value={student.phone} icon={<Phone />} />
                <DetailItem label="Date of Birth" value={formatSafeDate(student.dob)} icon={<Calendar />} />
                <DetailItem label="Register Number" value={student.registerNo} icon={<FileText className="text-primary/60" />} />
                <DetailItem label="Aadhar Number" value={student.aadharNo} icon={<Fingerprint />} />
                <DetailItem label="Online App ID" value={student.onlineAppNo} icon={<FileText />} />
                <DetailItem label="Admission Date" value={formatSafeDate(student.registrationDate)} icon={<Calendar />} />
                
                <Separator className="col-span-full my-2" />
                
                <DetailItem label="Learners License No." value={student.learnersNo} icon={<Fingerprint className="text-primary/60" />} />
                <DetailItem label="Learners Issue Date" value={formatSafeDate(student.learnersDate)} icon={<Calendar />} />
                
                <DetailItem label="Driving License No." value={student.drivingNo} icon={<Car className="text-green-600/60" />} />
                <DetailItem label="Driving Test Date" value={formatSafeDate(student.testDate)} icon={<Calendar />} />
              </div>
              <DetailItem label="Residential Address" value={student.address} icon={<MapPin />} />
            </CardContent>
          </Card>

          {/* Attendance Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Recent Training Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendance && attendance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...attendance].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5).map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm font-medium">{formatSafeDate(a.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {a.type === 'Practical' ? <Car className="h-3 w-3 mr-1 inline" /> : <BookOpen className="h-3 w-3 mr-1 inline" />}
                            {a.type || 'Practical'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.startTime} - {a.endTime} {a.vehicleReg && `• ${a.vehicleReg}`}
                        </TableCell>
                        <TableCell className="text-right font-bold">{a.duration}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground italic">No sessions logged yet.</div>
              )}
            </CardContent>
          </Card>

          {/* Receipts Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ReceiptIcon className="h-5 w-5 text-primary" />
                Fee Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {student.payments && student.payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Receipt No.</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...student.payments].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((p: any, i: number) => (
                      <TableRow key={p.id || i} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium">{formatSafeDate(p.date)}</TableCell>
                        <TableCell className="text-xs font-mono font-bold">#{p.receiptNo}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase">{p.method}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">₹{p.amount?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground italic">No fee receipts recorded yet.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Courses Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                My Courses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {student.courses?.map((c: string, i: number) => (
                <div key={i} className="p-3 rounded-xl border bg-muted/30 flex justify-between items-center">
                  <span className="font-medium text-sm">
                    {c === 'Others' ? (student.specialCourseName || 'Custom Course') : c}
                  </span>
                  <Badge variant="outline" className="bg-background">Enrolled</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Remarks Card */}
          {student.remarks && (
            <Card className="bg-orange-50/50 border-orange-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-orange-600 uppercase tracking-wider">Staff Remarks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-orange-800 italic leading-relaxed">{student.remarks}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{label}</CardTitle>
        <div className="h-4 w-4">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
        <span className="text-primary/50">{icon}</span>
        {label}
      </p>
      <p className="font-bold text-sm bg-muted/20 p-2.5 rounded-lg border border-transparent">
        {value || 'N/A'}
      </p>
    </div>
  );
}
