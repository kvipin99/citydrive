'use client';

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { COURSE_PRICES, type Student } from "@/lib/mock-data";
import { MoreHorizontal, FileText, User, Phone, Calendar, Trash2, Edit2, Eye, MapPin, CreditCard, ClipboardList, Info, Building2, Receipt, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AVAILABLE_COURSES = Object.keys(COURSE_PRICES);
const BRANCHES = ["Branch 1", "Branch 2", "Branch 3", "Branch 4", "Branch 5"] as const;

export default function StudentsPage() {
  const db = useFirestore();
  const studentsQuery = useMemoFirebase(() => collection(db, 'students'), [db]);
  const { data: students, isLoading } = useCollection<Student>(studentsQuery);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<Student>>({});

  const filteredStudents = students?.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.id.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleUpdateStudent = () => {
    if (!selectedStudent) return;
    const studentRef = doc(db, 'students', selectedStudent.id);
    
    // Calculate new amount based on courses and discount
    const courses = formData.courses || [];
    const baseAmount = courses.reduce((sum, course) => sum + (COURSE_PRICES[course] || 0), 0);
    const finalAmount = Math.max(0, baseAmount - (Number(formData.discount) || 0));

    const updatedData = { ...formData, amount: finalAmount };
    
    updateDocumentNonBlocking(studentRef, updatedData);
    setIsEditDialogOpen(false);
    toast({ title: "Student Updated", description: "The student profile has been updated in Firestore." });
  };

  const handleDeleteStudent = (id: string) => {
    const studentRef = doc(db, 'students', id);
    deleteDocumentNonBlocking(studentRef);
    toast({ variant: "destructive", title: "Student Deleted", description: "The student record has been removed." });
  };

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student);
    setFormData({ ...student });
    setIsEditDialogOpen(true);
  };

  const openProfile = (student: Student) => {
    setSelectedStudent(student);
    setIsProfileOpen(true);
  };

  const handleCourseToggle = (course: string) => {
    const currentCourses = formData.courses || [];
    if (currentCourses.includes(course)) {
      setFormData({ ...formData, courses: currentCourses.filter(c => c !== course) });
    } else {
      setFormData({ ...formData, courses: [...currentCourses, course] });
    }
  };

  const handleExportCSV = () => {
    if (!students) return;
    const headers = ["ID", "Name", "Email", "Phone", "Status", "Branch", "Registration Date", "Address", "Guardian", "Aadhar", "Courses", "Total Fee", "Discount", "Balance Payable"];
    const csvRows = [
      headers.join(','),
      ...students.map(s => [
        s.id,
        `"${s.name}"`,
        s.email,
        s.phone,
        s.status,
        s.branch,
        s.registrationDate,
        `"${s.address || ''}"`,
        `"${s.guardianName || ''}"`,
        s.aadharNo || '',
        `"${s.courses.join('; ')}"`,
        (s.amount || 0) + (s.discount || 0),
        s.discount || 0,
        s.amount || 0
      ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `students_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast({ title: "Report Exported", description: "The CSV file has been downloaded." });
  };

  const calculatePaidAmount = (student: Student) => {
    return student.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  };

  const calculateBalanceDue = (student: Student) => {
    return Math.max(0, (student.amount || 0) - calculatePaidAmount(student));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Students Database</CardTitle>
              <CardDescription>Real-time student management synchronized with Cloud Firestore.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search students..."
                  className="pl-8 w-[200px] lg:w-[300px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={handleExportCSV}>
                <FileText className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center py-8">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Fee (₹)</TableHead>
                  <TableHead>Balance Due (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No student records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={student.avatarUrl} alt={student.name} />
                            <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="grid gap-0.5">
                            <span className="font-medium">{student.name}</span>
                            <span className="text-xs font-mono text-muted-foreground">{student.id}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{student.branch}</TableCell>
                      <TableCell>
                        <Badge variant={student.status === 'Active' ? 'default' : 'secondary'}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell>₹{(student.amount || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className={`text-sm font-bold ${calculateBalanceDue(student) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          ₹{calculateBalanceDue(student).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openProfile(student)}>
                              <Eye className="mr-2 h-4 w-4" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(student)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteStudent(student.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog & Profile Sheet remain same as functional implementation but using updated handlers */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Student Profile</DialogTitle>
            <DialogDescription>Update the information for {selectedStudent?.name}. Changes will sync instantly.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-branch">Branch</Label>
                    <Select value={formData.branch} onValueChange={(v) => setFormData({...formData, branch: v as any})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRANCHES.map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as any})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-guardian">Parent/Guardian Name</Label>
                    <Input id="edit-guardian" value={formData.guardianName} onChange={(e) => setFormData({...formData, guardianName: e.target.value})} />
                  </div>
                </div>
                {/* ... other form fields ... */}
                <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
                  <Label className="font-bold">Courses Selection</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {AVAILABLE_COURSES.map(course => (
                      <div key={course} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`edit-course-${course}`} 
                          checked={formData.courses?.includes(course)} 
                          onCheckedChange={() => handleCourseToggle(course)}
                        />
                        <Label htmlFor={`edit-course-${course}`} className="text-sm cursor-pointer">{course}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-discount">Discount (₹)</Label>
                    <Input id="edit-discount" type="number" value={formData.discount} onChange={(e) => setFormData({...formData, discount: Number(e.target.value)})} />
                  </div>
                </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={handleUpdateStudent}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          {/* Detailed view rendered using selectedStudent data */}
          {selectedStudent && (
            <ScrollArea className="h-full mt-6 pr-4">
              <div className="space-y-8 pb-10">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Avatar className="h-28 w-28">
                    <AvatarImage src={selectedStudent.avatarUrl} />
                    <AvatarFallback>{selectedStudent.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedStudent.name}</h3>
                    <p className="text-sm font-mono text-muted-foreground">{selectedStudent.id}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</h4>
                  <p className="text-sm">{selectedStudent.branch} - {selectedStudent.address || 'No address'}</p>
                </div>
                <div className="space-y-4">
                   <h4 className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Financials</h4>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 border rounded-lg bg-muted/20">
                        <p className="text-xs text-muted-foreground">Total Fee</p>
                        <p className="font-bold">₹{(selectedStudent.amount || 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 border rounded-lg bg-muted/20">
                        <p className="text-xs text-muted-foreground">Balance Due</p>
                        <p className="font-bold text-destructive">₹{calculateBalanceDue(selectedStudent).toLocaleString()}</p>
                      </div>
                   </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
