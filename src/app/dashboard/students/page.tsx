"use client"

import { useState } from "react";
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
import { students as initialStudents, type Student } from "@/lib/mock-data";
import { MoreHorizontal, PlusCircle, File, User, Mail, Phone, Calendar, Trash2, Edit2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    status: 'Active'
  });

  const handleAddStudent = () => {
    const newStudent: Student = {
      id: `S${(students.length + 1).toString().padStart(3, '0')}`,
      name: formData.name || '',
      email: formData.email || '',
      phone: formData.phone || '',
      status: (formData.status as any) || 'Active',
      registrationDate: new Date().toISOString().split('T')[0],
      avatarUrl: `https://picsum.photos/seed/${Math.random()}/40/40`
    };
    setStudents([...students, newStudent]);
    setIsAddDialogOpen(false);
    setFormData({ name: '', email: '', phone: '', status: 'Active' });
    toast({ title: "Student Added", description: `${newStudent.name} has been successfully registered.` });
  };

  const handleEditStudent = () => {
    if (!selectedStudent) return;
    const updatedStudents = students.map(s => 
      s.id === selectedStudent.id ? { ...s, ...formData } : s
    );
    setStudents(updatedStudents);
    setIsEditDialogOpen(false);
    toast({ title: "Student Updated", description: "The student information has been saved." });
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
    toast({ variant: "destructive", title: "Student Deleted", description: "The student record has been removed." });
  };

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student);
    setFormData({ name: student.name, email: student.email, phone: student.phone, status: student.status });
    setIsEditDialogOpen(true);
  };

  const openProfile = (student: Student) => {
    setSelectedStudent(student);
    setIsProfileOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>Manage your students and their progress.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <File className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Register New Student</DialogTitle>
                    <DialogDescription>Fill in the details to add a new student to Citydrive.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="John Doe" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="john@example.com" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="555-0000" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddStudent}>Add Student</Button>
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
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Registration Date</TableHead>
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
                    <div className="grid text-sm">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {student.email}</span>
                      <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {student.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(student.registrationDate).toLocaleDateString()}</TableCell>
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student Profile</DialogTitle>
            <DialogDescription>Update the information for {selectedStudent?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
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
          <DialogFooter>
            <Button onClick={handleEditStudent}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Sheet */}
      <Sheet open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Student Profile</SheetTitle>
            <SheetDescription>Detailed view of student registration and progress.</SheetDescription>
          </SheetHeader>
          {selectedStudent && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={selectedStudent.avatarUrl} />
                  <AvatarFallback>{selectedStudent.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                  <p className="text-sm text-muted-foreground">ID: {selectedStudent.id}</p>
                  <Badge className="mt-2">{selectedStudent.status}</Badge>
                </div>
              </div>
              <div className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="grid gap-0.5">
                    <p className="text-sm font-medium">Email Address</p>
                    <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div className="grid gap-0.5">
                    <p className="text-sm font-medium">Phone Number</p>
                    <p className="text-sm text-muted-foreground">{selectedStudent.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div className="grid gap-0.5">
                    <p className="text-sm font-medium">Registration Date</p>
                    <p className="text-sm text-muted-foreground">{new Date(selectedStudent.registrationDate).toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
                  </div>
                </div>
              </div>
              <div className="border-t pt-6">
                <h4 className="font-semibold mb-4">Course Progress</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <p className="text-2xl font-bold">12</p>
                    <p className="text-xs text-muted-foreground">Hours Done</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <p className="text-2xl font-bold">8</p>
                    <p className="text-xs text-muted-foreground">Hours Left</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
