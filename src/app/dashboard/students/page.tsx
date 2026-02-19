"use client"

import { useState, useMemo, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { students as initialStudents, type Student, COURSE_PRICES } from "@/lib/mock-data";
import { MoreHorizontal, PlusCircle, File, User, Mail, Phone, Calendar, Trash2, Edit2, Eye, MapPin, CreditCard, ClipboardList, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AVAILABLE_COURSES = Object.keys(COURSE_PRICES);

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const { toast } = useToast();

  // Form State
  const [formData, setFormData] = useState<Partial<Student>>({
    name: '',
    email: '',
    phone: '',
    status: 'Active',
    address: '',
    guardianName: '',
    aadharNo: '',
    courses: [],
    amount: 0,
    discount: 0,
    onlineAppNo: '',
    learnersDate: '',
    testDate: '',
    remarks: ''
  });

  // Automatically calculate amount when courses or discount change
  useEffect(() => {
    const courses = formData.courses || [];
    const baseAmount = courses.reduce((sum, course) => sum + (COURSE_PRICES[course] || 0), 0);
    const finalAmount = Math.max(0, baseAmount - (Number(formData.discount) || 0));
    
    if (formData.amount !== finalAmount) {
      setFormData(prev => ({ ...prev, amount: finalAmount }));
    }
  }, [formData.courses, formData.discount]);

  const handleAddStudent = () => {
    const newStudent: Student = {
      id: `S${(students.length + 1).toString().padStart(3, '0')}`,
      name: formData.name || '',
      email: formData.email || '',
      phone: formData.phone || '',
      status: (formData.status as any) || 'Active',
      registrationDate: new Date().toISOString().split('T')[0],
      avatarUrl: `https://picsum.photos/seed/${Math.random()}/100/100`,
      address: formData.address,
      guardianName: formData.guardianName,
      aadharNo: formData.aadharNo,
      courses: formData.courses || [],
      amount: formData.amount || 0,
      discount: formData.discount || 0,
      onlineAppNo: formData.onlineAppNo,
      learnersDate: formData.learnersDate,
      testDate: formData.testDate,
      remarks: formData.remarks
    };
    setStudents([...students, newStudent]);
    setIsAddDialogOpen(false);
    resetForm();
    toast({ title: "Student Registered", description: `${newStudent.name} has been successfully registered.` });
  };

  const handleEditStudent = () => {
    if (!selectedStudent) return;
    const updatedStudents = students.map(s => 
      s.id === selectedStudent.id ? { ...s, ...formData } as Student : s
    );
    setStudents(updatedStudents);
    setIsEditDialogOpen(false);
    toast({ title: "Student Updated", description: "The student profile has been updated." });
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
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

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      status: 'Active',
      address: '',
      guardianName: '',
      aadharNo: '',
      courses: [],
      amount: 0,
      discount: 0,
      onlineAppNo: '',
      learnersDate: '',
      testDate: '',
      remarks: ''
    });
  };

  const handleCourseToggle = (course: string) => {
    const currentCourses = formData.courses || [];
    if (currentCourses.includes(course)) {
      setFormData({ ...formData, courses: currentCourses.filter(c => c !== course) });
    } else {
      setFormData({ ...formData, courses: [...currentCourses, course] });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>Manage your students and their registration details.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <File className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>Register New Student</DialogTitle>
                    <DialogDescription>Fill in the comprehensive details to register a new student.</DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
                    <div className="grid gap-6 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="John Doe" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="guardianName">Parent/Guardian Name</Label>
                          <Input id="guardianName" value={formData.guardianName} onChange={(e) => setFormData({...formData, guardianName: e.target.value})} placeholder="Robert Doe" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="john@example.com" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="phone">Mobile Number</Label>
                          <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="555-0000" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="address">Address</Label>
                        <Input id="address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="123 Street Name, City" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="aadharNo">Aadhar Number</Label>
                          <Input id="aadharNo" value={formData.aadharNo} onChange={(e) => setFormData({...formData, aadharNo: e.target.value})} placeholder="XXXX-XXXX-XXXX" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="onlineAppNo">Online Application No.</Label>
                          <Input id="onlineAppNo" value={formData.onlineAppNo} onChange={(e) => setFormData({...formData, onlineAppNo: e.target.value})} placeholder="APP-12345" />
                        </div>
                      </div>
                      
                      <div className="grid gap-4 p-4 border rounded-lg bg-muted/50">
                        <Label className="font-bold">Courses Selection</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {AVAILABLE_COURSES.map(course => (
                            <div key={course} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`course-${course}`} 
                                checked={formData.courses?.includes(course)} 
                                onCheckedChange={() => handleCourseToggle(course)}
                              />
                              <Label htmlFor={`course-${course}`} className="text-sm cursor-pointer">{course} (${COURSE_PRICES[course]})</Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="discount">Discount Amount ($)</Label>
                          <Input id="discount" type="number" value={formData.discount} onChange={(e) => setFormData({...formData, discount: Number(e.target.value)})} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="amount">Total Amount ($) - Auto Calculated</Label>
                          <Input id="amount" type="number" value={formData.amount} readOnly className="bg-muted" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="learnersDate">Learners License Date</Label>
                          <Input id="learnersDate" type="date" value={formData.learnersDate} onChange={(e) => setFormData({...formData, learnersDate: e.target.value})} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="testDate">Test Date</Label>
                          <Input id="testDate" type="date" value={formData.testDate} onChange={(e) => setFormData({...formData, testDate: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="remarks">Remarks</Label>
                        <Textarea id="remarks" value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})} placeholder="Any additional notes..." />
                      </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter>
                    <Button onClick={handleAddStudent}>Register Student</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={student.avatarUrl} alt={student.name} />
                        <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="grid gap-0.5">
                        <span className="font-medium">{student.name}</span>
                        <span className="text-xs text-muted-foreground">{student.id}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={student.status === 'Active' ? 'default' : 'secondary'} className={
                        student.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        student.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        student.status === 'Completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                     }>
                      {student.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {student.courses.map(c => (
                        <Badge key={c} variant="outline" className="text-[10px] py-0">{c}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p className="font-medium">${student.amount}</p>
                      {student.discount > 0 && <p className="text-xs text-muted-foreground line-through">${student.amount + student.discount}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openProfile(student)}>
                          <Eye className="mr-2 h-4 w-4" /> View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(student)}>
                          <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteStudent(student.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Student
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog - Reuse the structure of Add Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Student Profile</DialogTitle>
            <DialogDescription>Update the information for {selectedStudent?.name}.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="grid gap-6 py-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Mobile No.</Label>
                    <Input id="edit-phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
                {/* ... (Other fields can be added here mirroring the add dialog) */}
                <div className="grid gap-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-aadhar">Aadhar No.</Label>
                    <Input id="edit-aadhar" value={formData.aadharNo} onChange={(e) => setFormData({...formData, aadharNo: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-appno">Online App No.</Label>
                    <Input id="edit-appno" value={formData.onlineAppNo} onChange={(e) => setFormData({...formData, onlineAppNo: e.target.value})} />
                  </div>
                </div>
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
                    <Label htmlFor="edit-discount">Discount ($)</Label>
                    <Input id="edit-discount" type="number" value={formData.discount} onChange={(e) => setFormData({...formData, discount: Number(e.target.value)})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-amount">Total ($)</Label>
                    <Input id="edit-amount" type="number" value={formData.amount} readOnly className="bg-muted" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-remarks">Remarks</Label>
                  <Textarea id="edit-remarks" value={formData.remarks} onChange={(e) => setFormData({...formData, remarks: e.target.value})} />
                </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={handleEditStudent}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Sheet */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Student Detailed Profile</SheetTitle>
            <SheetDescription>Comprehensive view of student records.</SheetDescription>
          </SheetHeader>
          {selectedStudent && (
            <ScrollArea className="h-[calc(100vh-100px)] mt-6 pr-4">
              <div className="space-y-8">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Avatar className="h-28 w-28 border-4 border-primary/10 shadow-lg">
                    <AvatarImage src={selectedStudent.avatarUrl} />
                    <AvatarFallback className="text-2xl">{selectedStudent.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-2xl font-bold">{selectedStudent.name}</h3>
                    <p className="text-sm text-muted-foreground">ID: {selectedStudent.id}</p>
                    <Badge className="mt-2">{selectedStudent.status}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" /> Personal Info
                    </h4>
                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Guardian Name</p>
                        <p className="text-sm font-medium">{selectedStudent.guardianName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Aadhar Number</p>
                        <p className="text-sm font-mono">{selectedStudent.aadharNo || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Contact Info
                    </h4>
                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Mobile No.</p>
                        <p className="text-sm font-medium">{selectedStudent.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">{selectedStudent.email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Address
                  </h4>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedStudent.address || 'No address provided.'}</p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" /> Course Enrollment
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedStudent.courses.map(c => (
                      <Badge key={c} variant="secondary" className="px-3 py-1">{c}</Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="rounded-lg border bg-card p-3 shadow-sm">
                      <p className="text-xs text-muted-foreground">Total Fee</p>
                      <p className="text-lg font-bold text-primary">${selectedStudent.amount}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3 shadow-sm">
                      <p className="text-xs text-muted-foreground">Discount Applied</p>
                      <p className="text-lg font-bold text-green-600">${selectedStudent.discount}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Important Dates
                    </h4>
                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Registration</p>
                        <p className="text-sm font-medium">{new Date(selectedStudent.registrationDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Learners License</p>
                        <p className="text-sm font-medium">{selectedStudent.learnersDate || 'Pending'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Practical Test</p>
                        <p className="text-sm font-medium">{selectedStudent.testDate || 'Not Scheduled'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Administration
                    </h4>
                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Online App No.</p>
                        <p className="text-sm font-medium">{selectedStudent.onlineAppNo || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pb-10">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4" /> Remarks
                  </h4>
                  <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-900/10 p-4">
                    <p className="text-sm italic leading-relaxed text-foreground/80">
                      "{selectedStudent.remarks || 'No remarks added yet.'}"
                    </p>
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
