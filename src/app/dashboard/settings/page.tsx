"use client";

import { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Mail, ShieldCheck, DatabaseBackup, Users, Key, Camera, User as UserIcon, RefreshCw, Search } from "lucide-react";
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase } from "@/firebase";
import { collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { formatDistanceToNow } from "date-fns";
import { setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function SettingsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data Fetching
  const usersQuery = useMemoFirebase(() => (db ? collection(db, "users") : null), [db]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection(usersQuery);

  const profileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);

  const settingsRef = useMemoFirebase(() => (db ? doc(db, "settings", "backup") : null), [db]);
  const { data: autoSettings } = useDoc(settingsRef);

  // Form States
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/jpeg') {
      toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a JPEG image." });
      return;
    }

    if (file.size > 200 * 1024) {
      toast({ variant: "destructive", title: "File Too Large", description: "Image must be less than 200 KB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (profileRef) {
        updateDocumentNonBlocking(profileRef, { avatarUrl: event.target?.result as string });
        toast({ title: "Photo Updated", description: "Your profile picture has been changed." });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetUserPassword = (targetUser: any) => {
    const targetRef = doc(db, "users", targetUser.id);
    // In a prototype environment, we simulate a password reset flag
    updateDocumentNonBlocking(targetRef, { 
      passwordResetRequested: true,
      updatedAt: serverTimestamp() 
    });
    
    toast({
      title: "Password Reset Queued",
      description: `${targetUser.email} will be reset to "City123" on their next login.`,
    });
  };

  const handleUpdatePassword = async () => {
    if (!user || !newPassword) return;
    setIsSaving(true);
    try {
      await updatePassword(user, newPassword);
      toast({ title: "Password Updated", description: "Your security credentials have been changed successfully." });
      setNewPassword("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAutomation = (values: { enabled?: boolean, email?: string }) => {
    if (!settingsRef) return;
    setDocumentNonBlocking(settingsRef, values, { merge: true });
    toast({ title: "Automation Saved", description: "Backup settings updated." });
  };

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    if (!userSearchTerm) return allUsers;
    const term = userSearchTerm.toLowerCase();
    return allUsers.filter(u => 
      u.email?.toLowerCase().includes(term) || 
      u.role?.toLowerCase().includes(term)
    );
  }, [allUsers, userSearchTerm]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="grid gap-1">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  User Control
                </CardTitle>
                <CardDescription>Manage staff accounts and monitor activity across all branches.</CardDescription>
              </div>
              <div className="relative w-full sm:w-[250px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search email or role..."
                  className="pl-8"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User / Role</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isUsersLoading ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-8">Loading users...</TableCell></TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">
                        No users found matching your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{u.email}</span>
                            <span className="text-[10px] uppercase text-muted-foreground font-bold">{u.role}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.updatedAt?.seconds 
                            ? formatDistanceToNow(new Date(u.updatedAt.seconds * 1000), { addSuffix: true }) 
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-xs h-8 text-primary"
                            onClick={() => handleResetUserPassword(u)}
                          >
                            <Key className="h-3 w-3 mr-1" /> Reset to Default
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-5">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Personal Info</CardTitle>
                <CardDescription>Update your public profile data.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 py-8">
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-primary/20">
                    <AvatarImage src={profile?.avatarUrl} alt="User" />
                    <AvatarFallback><UserIcon className="h-12 w-12 text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="absolute bottom-0 right-0 rounded-full shadow-lg"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-5 w-5" />
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/jpeg" 
                    onChange={handlePhotoUpload} 
                  />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="font-bold text-lg">{profile?.email?.split('@')[0]}</h3>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Change your login credentials.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input 
                    id="new-password" 
                    type="password" 
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <Button onClick={handleUpdatePassword} disabled={isSaving || newPassword.length < 6}>
                  {isSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update Password
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DatabaseBackup className="h-5 w-5 text-primary" />
                Backup Automation
              </CardTitle>
              <CardDescription>Configure automatic email snapshots of your entire database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4 bg-primary/5">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Auto-Backup</Label>
                  <p className="text-sm text-muted-foreground">Automatically send database reports twice a week.</p>
                </div>
                <Switch 
                  checked={autoSettings?.enabled ?? true} 
                  onCheckedChange={(checked) => handleSaveAutomation({ enabled: checked })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="backup-email">Destination Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="backup-email" 
                    type="email" 
                    className="pl-9" 
                    placeholder="ezydriveapp@gmail.com"
                    value={autoSettings?.email || "ezydriveapp@gmail.com"} 
                    onChange={(e) => handleSaveAutomation({ email: e.target.value })}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic">Default: ezydriveapp@gmail.com</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                Backup schedule is active. Data is aggregated every 3.5 days.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
