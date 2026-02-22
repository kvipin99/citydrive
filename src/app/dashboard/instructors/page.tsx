
'use client';

import { useState, useEffect, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCollection, useFirestore, useMemoFirebase, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { MoreHorizontal, PlusCircle, Search, Trash2, Edit2, Phone, UserSquare, RefreshCw, Eraser, AlertCircle, Eye, Mail, Calendar, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";
import { format } from "date-fns";

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewSheetOpen, setIsViewSheetOpen] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
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

  const createInstructorAuth = async (staffId: string, name: string) => {
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
        name: name,
        role: 'Instructor',
        staffId: staffId,
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
      toast({ title: "Registering Staff", description: `Creating login account for ${staffId} with default password City123...` });
      const authUid = await createInstructorAuth(staffId, formData.name!);
      
      const newInstructorData = {
        ...formData,
        id: staffId,
        userId: authUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid,
        avatarUrl: `https://picsum.photos/seed/${staffId}/100/100`
      };

      const instructorRef = doc(db, 'instructors', staffId);
      setDocumentNonBlocking(instructorRef, newInstructorData, { merge: true });

      setIsAddDialogOpen(false);
      setFormData({ id: '', status: 'Active', name: '', phone: '' });
      toast({ title: "Registration Successful", description: `Account ${staffId} created. Login: ${staffId.toLowerCase()}@citydriving.in / Password: City123` });
    } catch (error: any) {
      console.error("Staff registration error:", error);
      let errorMsg = error.message || "An unexpected error occurred.";
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = `Login ID "${staffId}" already exists in the security database. Use the "Force Delete Auth" tool to clear it before reusing.`;
      }
      toast({ variant: "destructive", title: "Registration Failed", description: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateInstructor = () => {
    if (!selectedInstructor || !formData.name || !formData.phone) {
      toast({ variant: "destructive", title: "Missing Information", description: "Name and Phone are required." });
      return;
    }

    const instructorRef = doc(db, 'instructors', selectedInstructor.id);
    const updatedData = {
      name: formData.name,
      phone: formData.phone,
      status: formData.status,
      updatedAt: serverTimestamp(),
    };

    updateDocumentNonBlocking(instructorRef, updatedData);
    
    // Also update primary user profile
    const userRef = doc(db, 'users', selectedInstructor.userId);
    updateDocumentNonBlocking(userRef, { name: formData.name, updatedAt: serverTimestamp() });

    setIsEditDialogOpen(false);
    setSelectedInstructor(null);
    toast({ title: "Profile Updated", description: "Instructor details have been saved." });
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
      try {
        const cred = await signInWithEmailAndPassword(secondaryAuth, email, password);
        await deleteUser(cred.user);
      } catch (authErr) {
        console.warn("Auth cleanup failed (possibly already deleted or password changed):", authErr);
      }

      deleteDocumentNonBlocking(doc(db, 'instructors', staffId));
      deleteDocumentNonBlocking(doc(db, 'users', instructor.userId));

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
    const staffId = cleanupId.trim().toUpperCase();
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
      toast({ title: "Cleanup Successful", description: `Login account for ${staffId} has been removed. You can now reuse this ID.` });
      setCleanupId("");
    } catch (error: any) {
      console.error("Cleanup error:", error);
      toast({ variant: "destructive", title: "Cleanup Failed", description: "Could not find or delete that login account. It may already be gone or uses a non-default password." });
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
              <CardDescription>Manage IDs and automated login accounts for your staff.</CardDescription>
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
                    <DialogDescription>Assign a unique ID. Accounts are automatically provisioned with password: <b>City123</b>.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="staffId">Staff ID (Editable)</Label>
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
                  <DialogFooter className="flex-col gap-4">
                    <Button onClick={handleAddInstructor} className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                      Confirm & Register
                    </Button>
                    
                    <div className="w-full pt-4 border-t mt-2">
                      <div className="flex items-center gap-1.5 mb-2 text-orange-600">
                        <AlertCircle className="h-3 w-3" />
                        <p className="text-[10px] font-bold uppercase tracking-tight">Fix SID Conflict Error</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-3 leading-tight">
                        If an ID was used previously, its login might still exist in the security database. Enter the ID below to force-clear it.
                      </p>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Orphaned ID (e.g. SID01)" 
                          className="text-xs h-9" 
                          value={cleanupId} 
                          onChange={(e) => setCleanupId(e.target.value)} 
                        />
                        <Button size="sm" variant="outline" className="h-9 text-[10px] px-3 font-bold" onClick={handleCleanupGhost} disabled={!cleanupId || isSubmitting}>
                          <Eraser className="h-3.5 w-3.5 mr-1.5" /> Force Delete Auth
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
                            <DropdownMenuItem onClick={() => { setSelectedInstructor(instructor); setIsViewSheetOpen(true); }}>
                              <Eye className="mr-2 h-4 w-4" /> View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { 
                              setSelectedInstructor(instructor); 
                              setFormData({ name: instructor.name, phone: instructor.phone, status: instructor.status });
                              setIsEditDialogOpen(true); 
                            }}>
                              <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive font-bold" 
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setSelectedInstructor(null);
          setFormData({ id: '', status: 'Active', name: '', phone: '' });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Instructor Profile</DialogTitle>
            <DialogDescription>Update the information for {selectedInstructor?.id}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input 
                id="edit-name" 
                value={formData.name || ''} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Mobile Number</Label>
              <Input 
                id="edit-phone" 
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
          <DialogFooter>
            <Button onClick={handleUpdateInstructor} className="w-full">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Profile Sheet */}
      <Sheet open={isViewSheetOpen} onOpenChange={(open) => { setIsViewSheetOpen(open); if (!open) setSelectedInstructor(null); }}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Instructor Profile</SheetTitle>
          </SheetHeader>
          {selectedInstructor && (
            <ScrollArea className="h-full mt-6 pr-4">
              <div className="space-y-6 pb-20">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 border-4 border-primary/20 mb-4">
                    <AvatarImage src={selectedInstructor.avatarUrl} alt={selectedInstructor.name} />
                    <AvatarFallback className="text-2xl">{selectedInstructor.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold">{selectedInstructor.name}</h2>
                  <Badge variant="outline" className="mt-1 font-mono">{selectedInstructor.id}</Badge>
                  <Badge className="mt-2" variant={selectedInstructor.status === 'Active' ? 'default' : 'secondary'}>
                    {selectedInstructor.status}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-4">
                  <section className="space-y-3">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <User className="h-4 w-4" /> Personal Information
                    </h3>
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" /> Mobile
                        </span>
                        <span className="font-medium">{selectedInstructor.phone}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" /> Login Email
                        </span>
                        <span className="font-medium lowercase text-xs">{selectedInstructor.id}@citydriving.in</span>
                      </div>
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> System Details
                    </h3>
                    <div className="grid gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Member Since</span>
                        <span>{selectedInstructor.createdAt?.seconds ? format(new Date(selectedInstructor.createdAt.seconds * 1000), 'MMM dd, yyyy') : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Updated</span>
                        <span>{selectedInstructor.updatedAt?.seconds ? format(new Date(selectedInstructor.updatedAt.seconds * 1000), 'MMM dd, yyyy') : 'Recently'}</span>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="pt-4">
                  <Button variant="outline" className="w-full" onClick={() => {
                    setIsViewSheetOpen(false);
                    setFormData({ name: selectedInstructor.name, phone: selectedInstructor.phone, status: selectedInstructor.status });
                    setIsEditDialogOpen(true);
                  }}>
                    <Edit2 className="mr-2 h-4 w-4" /> Edit Details
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
