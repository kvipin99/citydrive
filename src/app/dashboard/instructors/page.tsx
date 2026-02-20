
'use client';

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { MoreHorizontal, PlusCircle, File, Search, Trash2, Edit2, UserPlus, Phone, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";

interface Instructor {
  id: string;
  userId: string;
  name: string;
  phone: string;
  salaryType: 'Fixed' | 'Per Student';
  salaryAmount: number;
  status: 'Active' | 'On Leave' | 'Inactive';
  vehicle?: string;
  avatarUrl?: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export default function InstructorsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const instructorsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'instructors');
  }, [db, user]);
  
  const { data: instructors, isLoading } = useCollection<Instructor>(instructorsQuery);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Instructor>>({
    salaryType: 'Fixed',
    status: 'Active',
    salaryAmount: 0,
  });

  const filteredInstructors = instructors?.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.id.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const createInstructorAuth = async (instructorId: string) => {
    const email = `${instructorId.toLowerCase()}@citydriving.in`;
    const password = "City123";
    const secondaryAppName = `inst-${instructorId}-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;
      
      // Create User role doc for security rules
      const userRef = doc(db, 'users', uid);
      setDocumentNonBlocking(userRef, {
        id: uid,
        email: email,
        role: 'Instructor',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid
      }, { merge: true });

      await deleteApp(secondaryApp);
      return uid;
    } catch (error: any) {
      try { await deleteApp(secondaryApp); } catch {}
      throw error;
    }
  };

  const handleAddInstructor = async () => {
    if (!formData.name || !formData.phone) {
      toast({ variant: "destructive", title: "Missing Information", description: "Name and Phone are required." });
      return;
    }

    const nextIdNumber = (instructors?.length || 0) + 1;
    const instructorId = `I${String(nextIdNumber).padStart(4, '0')}`;
    
    try {
      toast({ title: "Registering Instructor", description: `Setting up ID ${instructorId}...` });
      
      const authUid = await createInstructorAuth(instructorId);
      
      const newInstructorData = {
        ...formData,
        id: instructorId,
        userId: authUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid,
        avatarUrl: `https://picsum.photos/seed/${instructorId}/40/40`
      };

      const instructorRef = doc(db, 'instructors', instructorId);
      setDocumentNonBlocking(instructorRef, newInstructorData, { merge: true });

      setIsAddDialogOpen(false);
      setFormData({ salaryType: 'Fixed', status: 'Active', salaryAmount: 0 });
      toast({ title: "Success", description: `Instructor ${instructorId} registered. Login: ${instructorId.toLowerCase()}, Pass: City123` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration Failed", description: error.message || "Could not create instructor." });
    }
  };

  const handleDeleteInstructor = (id: string) => {
    const instructorRef = doc(db, 'instructors', id);
    deleteDocumentNonBlocking(instructorRef);
    toast({ variant: "destructive", title: "Removed", description: "Instructor has been decommissioned." });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Instructors Fleet</CardTitle>
            <CardDescription>Manage your certified driving instructors and payroll structure.</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8 w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline">
              <File className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Instructor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Instructor</DialogTitle>
                  <DialogDescription>Credentials will be generated automatically.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="John Doe" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" placeholder="+91 XXXX-XXXXXX" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Salary Type</Label>
                      <Select value={formData.salaryType} onValueChange={(v) => setFormData({...formData, salaryType: v as any})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Fixed">Fixed Monthly</SelectItem>
                          <SelectItem value="Per Student">Per Student</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Amount (₹)</Label>
                      <Input type="number" value={formData.salaryAmount} onChange={(e) => setFormData({...formData, salaryAmount: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Assigned Vehicle (Optional)</Label>
                    <Input placeholder="e.g. MH-12-AB-1234" value={formData.vehicle || ''} onChange={(e) => setFormData({...formData, vehicle: e.target.value})} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddInstructor}>Create Account</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                <TableHead>Instructor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payroll</TableHead>
                <TableHead>Assigned Vehicle</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInstructors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No instructors found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInstructors.map((instructor) => (
                  <TableRow key={instructor.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={instructor.avatarUrl} alt={instructor.name} />
                          <AvatarFallback>{instructor.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <span className="font-bold text-primary">{instructor.id}</span>
                          <span className="text-sm font-medium">{instructor.name}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {instructor.phone}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                       <Badge variant={instructor.status === 'Active' ? 'default' : 'secondary'}>
                        {instructor.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="grid text-sm">
                        <span className="font-medium">₹{instructor.salaryAmount?.toLocaleString()}</span>
                        <span className="text-xs text-muted-foreground">{instructor.salaryType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        {instructor.vehicle || 'None'}
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
                          <DropdownMenuItem>View Schedule</DropdownMenuItem>
                          <DropdownMenuItem>Edit Profile</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteInstructor(instructor.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
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
  );
}
