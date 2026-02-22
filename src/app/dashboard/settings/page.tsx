
"use client";

import { useState, useRef, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Mail, ShieldCheck, DatabaseBackup, Users, Key, Camera, User as UserIcon, RefreshCw, Search, Send, Loader2, Trash2, UserCircle } from "lucide-react";
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, getDocs } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { formatDistanceToNow } from "date-fns";
import { setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { sendBackupEmail } from "@/ai/flows/backup-email-flow";

const BACKUP_COLLECTIONS = ["users", "students", "instructors", "vehicles", "courses", "payments", "expenses", "classes"];

function SettingsContent() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab Sync Logic
  const [activeTab, setActiveTab] = useState("profile");

  // Data Fetching - Profile first to determine role
  const profileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);
  const isAdmin = profile?.role === 'Admin';

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    } else if (profile) {
      // Default view based on role
      setActiveTab(isAdmin ? "general" : "profile");
    }
  }, [searchParams, profile, isAdmin]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/dashboard/settings?tab=${value}`);
  };

  // Sensitive data queries only run for Admins
  const usersQuery = useMemoFirebase(() => (db && isAdmin ? collection(db, "users") : null), [db, isAdmin]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection(usersQuery);

  const settingsRef = useMemoFirebase(() => (db && isAdmin ? doc(db, "settings", "backup") : null), [db, isAdmin]);
  const { data: autoSettings } = useDoc(settingsRef);

  // Form States
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUpManual, setIsBackingUpManual] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  useEffect(() => {
    if (profile?.name) {
      setDisplayName(profile.name);
    }
  }, [profile]);

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

  const handleUpdateProfile = () => {
    if (!profileRef || !displayName) return;
    updateDocumentNonBlocking(profileRef, { 
      name: displayName,
      updatedAt: serverTimestamp() 
    });
    toast({ title: "Profile Updated", description: "Your display name has been saved." });
  };

  const handleResetUserPassword = (targetUser: any) => {
    const targetRef = doc(db, "users", targetUser.id);
    updateDocumentNonBlocking(targetRef, { 
      passwordResetRequested: true,
      updatedAt: serverTimestamp() 
    });
    
    toast({
      title: "Password Reset Queued",
      description: `${targetUser.email} will be reset to "City123" on their next login.`,
    });
  };

  const handleDeleteUserRecord = (targetUser: any) => {
    const targetRef = doc(db, "users", targetUser.id);
    deleteDocumentNonBlocking(targetRef);
    toast({
      variant: "destructive",
      title: "Account Removed",
      description: `${targetUser.email} has been deleted from the login database.`,
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

  const handleManualBackupTrigger = async () => {
    if (!db || !user) return;
    setIsBackingUpManual(true);
    toast({ title: "Processing Backup", description: "Aggregating system data for email delivery..." });

    try {
      const backupData: Record<string, any[]> = {};
      let totalRecords = 0;

      for (const colName of BACKUP_COLLECTIONS) {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        backupData[colName] = docs;
        totalRecords += docs.length;
      }

      const emailRecipient = autoSettings?.email || "ezydriveapp@gmail.com";
      const summary = `Manual Database Export: ${totalRecords} total records across ${BACKUP_COLLECTIONS.length} collections.`;
      
      const result = await sendBackupEmail({
        email: emailRecipient,
        backupSummary: summary,
        timestamp: new Date().toLocaleString(),
        backupDataJson: JSON.stringify(backupData, null, 2),
      });

      if (result.success) {
        const metadataRef = doc(db, "backupMetadata", `MANUAL-${Date.now()}`);
        setDocumentNonBlocking(metadataRef, {
          id: metadataRef.id,
          timestamp: serverTimestamp(),
          performedBy: user.email,
          status: "Successful",
          type: "Manual Email Backup"
        }, { merge: true });

        toast({ title: "Backup Sent", description: result.message });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Email Error", 
          description: result.message 
        });
      }
    } catch (error: any) {
      console.error("Manual backup failed:", error);
      toast({ variant: "destructive", title: "Internal Error", description: "Failed to process backup request." });
    } finally {
      setIsBackingUpManual(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    
    const uniqueUsers: any[] = [];
    const seenEmails = new Set();
    
    allUsers.forEach((u: any) => {
      const emailKey = u.email?.toLowerCase() || u.id?.toLowerCase();
      if (!seenEmails.has(emailKey)) {
        seenEmails.add(emailKey);
        uniqueUsers.push(u);
      }
    });

    if (!userSearchTerm) return uniqueUsers;
    const term = userSearchTerm.toLowerCase();
    return uniqueUsers.filter(u => 
      u.email?.toLowerCase().includes(term) || 
      u.role?.toLowerCase().includes(term) ||
      u.id?.toLowerCase().includes(term) ||
      u.name?.toLowerCase().includes(term)
    );
  }, [allUsers, userSearchTerm]);

  if (!profile) return (
    <div className="flex justify-center py-12">
      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'} max-w-md`}>
          {isAdmin && <TabsTrigger value="general">General</TabsTrigger>}
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {isAdmin && <TabsTrigger value="automation">Automation</TabsTrigger>}
        </TabsList>

        {isAdmin && (
          <TabsContent value="general" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="grid gap-1">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    User Control
                  </CardTitle>
                  <CardDescription>Manage login accounts and clean up orphaned records.</CardDescription>
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
                              <span className="font-medium">{u.name || u.email || u.id}</span>
                              <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-tight">
                                {u.role || 'Unassigned Role'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.updatedAt?.seconds 
                              ? formatDistanceToNow(new Date(u.updatedAt.seconds * 1000), { addSuffix: true }) 
                              : 'Never'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[10px] h-8 text-primary"
                                onClick={() => handleResetUserPassword(u)}
                              >
                                <Key className="h-3 w-3 mr-1" /> Reset
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[10px] h-8 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteUserRecord(u)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

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
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <UserIcon className="h-12 w-12" />
                    </AvatarFallback>
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
                  <h3 className="font-bold text-lg">{profile?.name || profile?.email?.split('@')[0]}</h3>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
                <CardDescription>
                  Update your security credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isAdmin && (
                  <>
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="display-name">Display Name</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <UserCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input 
                              id="display-name" 
                              placeholder="Enter your full name"
                              className="pl-9"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                            />
                          </div>
                          <Button variant="outline" onClick={handleUpdateProfile}>Update Name</Button>
                        </div>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                <div className="space-y-4">
                  <Label>Security</Label>
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
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isAdmin && (
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
                    <p className="text-sm text-muted-foreground">Automatically send database reports every Sunday at 12:00 AM.</p>
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

                <Separator />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border bg-accent/5">
                  <div className="grid gap-1">
                    <p className="text-sm font-bold">Manual Email Backup</p>
                    <p className="text-xs text-muted-foreground">Need a snapshot right now? Trigger a report manually.</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleManualBackupTrigger} 
                    disabled={isBackingUpManual}
                    className="w-full sm:w-auto"
                  >
                    {isBackingUpManual ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {isBackingUpManual ? "Sending..." : "Send Backup Now"}
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                  Backup schedule is active. Data is aggregated every Sunday.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
