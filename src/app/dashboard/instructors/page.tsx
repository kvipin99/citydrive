
'use client';

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { MoreHorizontal, PlusCircle, Search, Trash2, Edit2, Phone, UserSquare, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";

interface Instructor {
  id: string; // SID01, SID02 etc
  userId: string;
  name: string;
  phone: string;
  status: 'Active' | 'Deactive';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Instructor>>({
    status: 'Active',
    name: '',
    phone: '',
  });

  const filteredInstructors = instructors?.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.phone.includes(searchQuery)
  ) || [];

  const createInstructorAuth = async (staffId: string) => {
    const email = `${staffId.toLowerCase()}@citydriving.in`;
    const password = "City123";
    const secondaryAppName = `staff-${staffId}-${Date.now()}`;
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

    setIsSubmitting(true);

    // Calculate initial SID base
    const lastIdNum = instructors?.reduce((max, inst) => {
      const numPart = inst.id.replace('SID', '');
      const num = parseInt(numPart, 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0) || 0;
    
    let currentIdNum = lastIdNum + 1;
    let success = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!success && attempts < maxAttempts) {
      const staffId = `SID${String(currentIdNum).padStart(2, '0')}`;
      try {
        toast({ title: "Registering Staff", description: `Attempting registration for ${staffId}...` });
        
        const authUid = await createInstructorAuth(staffId);
        
        const newInstructorData = {
          ...formData,
          id: staffId,
          userId: authUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user?.uid,
          avatarUrl: `https://picsum.photos/seed/${staffId}/40/40`
        };

        const instructorRef = doc(db, 'instructors', staffId);
        setDocumentNonBlocking(instructorRef, newInstructorData, { merge: true });

        setIsAddDialogOpen(false);
        setFormData({ status: 'Active', name: '', phone: '' });
        toast({ title: "Success", description: `Staff ${staffId} registered. Login: ${staffId.toLowerCase()}, Pass: City123` });
        success = true;
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          console.warn(`Collision detected for ${staffId}, skipping to next ID...`);
          currentIdNum++;
          attempts++;
        } else {
          console.error("Staff registration error:", error);
          let errorMsg = error.message || "Could not create account.";
          if (error.code === 'auth/operation-not-allowed') {
            errorMsg = "System configuration required: Please enable 'Email/Password' in Firebase Console > Authentication.";
          }
          toast({ variant: "destructive", title: "Registration Failed", description: errorMsg });
          break;
        }
      }
    }

    if (!success && attempts >= maxAttempts) {
      toast({ 
        variant: "destructive", 
        title: "Registration Error", 
        description: "Multiple Staff IDs are already in use in the authentication system. Please contact the administrator to clean up old accounts." 
      });
    }

    setIsSubmitting(false);
  };

  const handleDeleteInstructor = (id: string) => {
    const instructorRef = doc(db, 'instructors', id);
    deleteDocumentNonBlocking(instructorRef);
    toast({ 
      variant: "destructive", 
      title: "Staff Removed", 
      description: `Staff record ${id} has been deleted from the database.` 
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserSquare className="h-5 w-5 text-primary" />
                Staff & Instructors
              </CardTitle>
              <CardDescription>Manage IDs and statuses for your driving school staff.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search Name, ID, Mobile..."
                  className="pl-8 w-[200px] lg:w-[250px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Staff
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Staff Member</DialogTitle>
                    <DialogDescription>ID will be generated automatically. Default password: City123</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" placeholder="John Doe" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Mobile Number</Label>
                      <Input id="phone" placeholder="555-0101" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as any})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Deactive">Deactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddInstructor} className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Processing...
                        </div>
                      ) : "Create Staff Account"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center py-12">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID & Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstructors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      No staff records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInstructors.map((instructor) => (
                    <TableRow key={instructor.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={instructor.avatarUrl} alt={instructor.name} />
                            <AvatarFallback>{instructor.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="grid gap-0.5">
                            <span className="font-bold text-primary">{instructor.id}</span>
                            <span className="text-sm">{instructor.name}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {instructor.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                         <Badge variant={instructor.status === 'Active' ? 'default' : 'secondary'}>
                          {instructor.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Options</DropdownMenuLabel>
                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                            <DropdownMenuItem>Edit Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteInstructor(instructor.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Staff
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
    </div>
  );
}
