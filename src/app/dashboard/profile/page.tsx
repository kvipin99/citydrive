
"use client";

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Mail, MapPin, Calendar, Clock, CreditCard, Wallet, GraduationCap, User as UserIcon, BookOpen, Car } from "lucide-react";
import { format } from "date-fns";
import { useMemo } from "react";

export default function StudentProfilePage() {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);

  const studentQuery = useMemoFirebase(() => {
    if (!db || !profile?.studentId) return null;
    return query(collection(db, "students"), where("id", "==", profile.studentId));
  }, [db, profile]);
  const { data: studentRecords, isLoading: isStudentLoading } = useCollection(studentQuery);
  const student = studentRecords?.[0];

  const attendanceQuery = useMemoFirebase(() => {
    if (!db || !student?.id) return null;
    return query(collection(db, "attendance"), where("studentId", "==", student.id));
  }, [db, student]);
  const { data: attendance } = useCollection(attendanceQuery);

  const paidAmount = useMemo(() => {
    return student?.payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
  }, [student]);

  const balance = (student?.amount || 0) - paidAmount;
  const totalHours = attendance?.reduce((sum: number, a: any) => sum + (Number(a.duration) || 0), 0) || 0;

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
        <p className="text-muted-foreground">Your student record could not be located. Please contact the office.</p>
      </div>
    );
  }

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
            <Badge variant="outline" className="uppercase font-bold text-[10px] tracking-widest">{student.branch}</Badge>
            <Badge variant={student.status === 'Active' ? 'default' : 'secondary'}>{student.status}</Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Fee" value={`₹${student.amount?.toLocaleString()}`} icon={<Wallet className="text-primary" />} />
        <StatCard label="Fees Paid" value={`₹${paidAmount.toLocaleString()}`} icon={<CreditCard className="text-green-600" />} />
        <StatCard label="Balance Due" value={`₹${balance.toLocaleString()}`} icon={<Clock className="text-destructive" />} />
        <StatCard label="Training Hours" value={`${totalHours}h`} icon={<Clock className="text-blue-600" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DetailItem label="Mobile Number" value={student.phone} icon={<Phone />} />
                <DetailItem label="Aadhar Number" value={student.aadharNo} icon={<UserIcon />} />
                <DetailItem label="Online App ID" value={student.onlineAppNo} icon={<Clock />} />
                <DetailItem label="Admission Date" value={student.registrationDate} icon={<Calendar />} />
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
                    {attendance.slice(0, 5).map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm font-medium">{format(new Date(a.date), 'MMM dd, yyyy')}</TableCell>
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
                  <span className="font-medium text-sm">{c}</span>
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
      <p className="font-bold text-sm bg-muted/20 p-2.5 rounded-lg border border-transparent hover:border-primary/10 transition-colors">
        {value || 'N/A'}
      </p>
    </div>
  );
}
