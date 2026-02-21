
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { PlusCircle, Edit2, Trash2, Tags } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Course {
  id: string;
  name: string;
  amount: number;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export default function CoursesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const coursesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'courses');
  }, [db, user]);

  const { data: courses, isLoading } = useCollection<Course>(coursesQuery);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({ name: '', amount: 0 });

  const handleOpenDialog = (course: Course | null = null) => {
    setSelectedCourse(course);
    setFormData(course ? { name: course.name, amount: course.amount } : { name: '', amount: 0 });
    setIsDialogOpen(true);
  };

  const handleSaveCourse = () => {
    if (!formData.name || formData.amount < 0) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Please provide a valid name and amount." });
      return;
    }

    const courseId = selectedCourse ? selectedCourse.id : `C-${Date.now()}`;
    const courseRef = doc(db, 'courses', courseId);

    const data = {
      ...formData,
      id: courseId,
      updatedAt: serverTimestamp(),
      ...(selectedCourse ? {} : { createdAt: serverTimestamp(), createdBy: user?.uid })
    };

    setDocumentNonBlocking(courseRef, data, { merge: true });
    setIsDialogOpen(false);
    toast({ title: selectedCourse ? "Course Updated" : "Course Created", description: `${formData.name} is now available.` });
  };

  const handleDeleteCourse = (id: string) => {
    const courseRef = doc(db, 'courses', id);
    deleteDocumentNonBlocking(courseRef);
    toast({ variant: "destructive", title: "Course Removed", description: "The course has been deleted from the master list." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                Course Catalog
              </CardTitle>
              <CardDescription>Manage your driving school's offerings and standard pricing (Admin Only).</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Course
            </Button>
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
                  <TableHead>Course Name</TableHead>
                  <TableHead>Standard Fee (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No courses defined. Add your first course to start registering students.
                    </TableCell>
                  </TableRow>
                ) : (
                  courses?.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.name}</TableCell>
                      <TableCell>₹{course.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(course)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteCourse(course.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCourse ? 'Edit Course' : 'New Course'}</DialogTitle>
            <DialogDescription>Define the name and pricing for the course.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="courseName">Course Name</Label>
              <Input
                id="courseName"
                placeholder="e.g. Basic Car (4-Wheeler)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="courseAmount">Standard Fee (₹)</Label>
              <Input
                id="courseAmount"
                type="number"
                placeholder="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCourse}>Save Course</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
