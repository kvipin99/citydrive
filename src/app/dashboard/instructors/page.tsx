
'use client';

import { useState, useEffect, useMemo } from "react";
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
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { MoreHorizontal, PlusCircle, Search, Trash2, Edit2, Phone, UserSquare, RefreshCw, Eraser } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from "firebase/auth";
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
  const [cleanupId, setCleanupId] = useState("");
  
  const [formData, setFormData] = useState<Partial<Instructor>>({
    id: '',
    status: 'Active',
    name: '',
    phone: '',
  });

  const nextAvailableId = useMemo(() => {
    const lastIdNum = instructors?.reduce((max, inst) => {
      const numPart = inst.id.replace('SID', '');
      const num = parseInt(numPart, 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0) || 0;
    return `SID${String(lastIdNum + 1).padStart(2, '0')}`;
  }, [instructors]);

  useEffect(() => {
    if (isAddDialogOpen && !formData.id) {
      setFormData(prev => ({ ...prev, id: nextAvailableId }));
    }
  }, [isAddDialogOpen, nextAvailableId, formData.id]);

  const filteredInstructors = instructors?.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.phone.includes(searchQuery)
  ) || [];

  const createInstructorAuth = async (staffId: string) => {
    const email = `${staffId.toLowerCase()}@citydriving.in`;
    const password = "City123";
    const secondaryAppName = `create-${staffId}-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;
      
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
    const staffId = formData.id?.trim().toUpperCase();
    if (!staffId || !formData.name || !formData.phone) {
      toast({ variant: "destructive", title: "Missing Information", description: "ID, Name, and Phone are required." });
      return;
    }

    setIsSubmitting(true);

    try {
      toast({ title: "Registering Staff", description: `Creating system account for ${staffId}...` });
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
      setFormData({ id: '', status: 'Active', name: '', phone: '' });
      toast({ title: "Registration Successful", description: `Account ${staffId} created. Password: City123` });
    } catch (error: any) {
      console.error("Staff registration error:", error);
      let errorMsg = error.message || "An unexpected error occurred.";
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = `ID "${staffId}" is still in the system login database. Use "Cleanup Ghost Account" below to clear it.`;
      }
      toast({ variant: "destructive", title: "Registration Failed", description: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInstructor = async (instructor: Instructor) => {
    const staffId = instructor.id;
    const email = `${staffId.toLowerCase()}@citydriving.in`;
    const password = "City123";

    setIsSubmitting(true);
    toast({ title: "Removing Staff", description: `Cleaning up ${staffId} from database and login system...` });

    const secondaryAppName = `del-${staffId}-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      // 1. Try to delete from Auth
      try {
        const cred = await signInWithEmailAndPassword(secondaryAuth, email, password);
        await deleteUser(cred.user);
      } catch (authErr) {
        console.warn("Auth cleanup failed (possibly already deleted):", authErr);
      }

      // 2. Delete Firestore records
      await deleteDoc(doc(db, 'instructors', staffId));
      await deleteDoc(doc(db, 'users', instructor.userId));

      await deleteApp(secondaryApp);
      toast({ title: "Staff Removed", description: `Records and login account for ${staffId} have been permanently deleted.` });
    } catch (error: any) {
      console.error("Deletion error:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to complete deletion process." });
      try { await deleteApp(secondaryApp); } catch {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCleanupGhost = async () => {
    if (!cleanupId) return;
    const staffId = cleanupId.toUpperCase();
    const email = `${staffId.toLowerCase()}@citydriving.in`;
    const password = "City123";

    setIsSubmitting(true);
    toast({ title: "Cleanup Started", description: `Attempting to force-delete login account for ${staffId}...` });

    const secondaryAppName = `cleanup-${staffId}-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await signInWithEmailAndPassword(secondaryAuth, email, password);
      await deleteUser(cred.user);
      await deleteApp(secondaryApp);
      toast({ title: "Cleanup Successful", description: `Login account for ${staffId} has been removed.` });
      setCleanupId("");
    } catch (error: any) {
      console.error("Cleanup error:", error);
      toast({ variant: "destructive", title: "Cleanup Failed", description: "Could not find or delete that login account. It may already be gone." });
      try { await deleteApp(secondaryApp); } catch {}
    } finally {
      setIsSubmitting(false);
    }
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
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) {
                  setFormData({ id: '', status: 'Active', name: '', phone: '' });
                  setCleanupId("");
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Staff
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Staff Member</DialogTitle>
                    <DialogDescription>Assign a unique ID. Account deletion is now permanent.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="staffId">Staff ID</Label>
                      <Input 
                        id="staffId" 
                        placeholder="e.g. SID01" 
                        value={formData.id || ''} 
                        onChange={(e) => setFormData({...formData, id: e.target.value.toUpperCase()})} 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input 
                        id="name" 
                        placeholder="Enter full name" 
                        value={formData.name || ''} 
                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Mobile Number</Label>
                      <Input 
                        id="phone" 
                        placeholder="e.g. 9876543210" 
                        value={formData.phone || ''} 
                        onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                      />
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
                  <DialogFooter className="flex-col gap-2">
                    <Button onClick={handleAddInstructor} className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                      Confirm & Register
                    </Button>
                    <div className="w-full pt-4 border-t mt-4">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Cleanup Ghost Accounts (SID01, SID02 etc)</p>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Enter orphaned ID" 
                          className="text-xs h-8" 
                          value={cleanupId} 
                          onChange={(e) => setCleanupId(e.target.value)} 
                        />
                        <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={handleCleanupGhost} disabled={!cleanupId || isSubmitting}>
                          <Eraser className="h-3 w-3 mr-1" /> Force Delete Auth
                        </Button>
                      </div>
                    </div>
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
                            <DropdownMenuLabel>Staff Actions</DropdownMenuLabel>
                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                            <DropdownMenuItem>Edit Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive" 
                              onClick={() => handleDeleteInstructor(instructor)}
                              disabled={isSubmitting}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Staff & Login
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
