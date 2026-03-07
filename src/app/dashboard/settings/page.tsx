
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, ShieldCheck, DatabaseBackup, Users, Key, Camera, User as UserIcon, RefreshCw, Search, Send, Loader2, Trash2, UserCircle, Lock, MapPin } from "lucide-react";
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
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

  const [activeTab, setActiveTab] = useState("profile");

  const profileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);
  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';
  const isBranchManager = profile?.role === 'BranchManager';

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    } else if (profile) {
      setActiveTab(isAdmin ? "general" : "profile");
    }
  }, [searchParams, profile, isAdmin]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/dashboard/settings?tab=${value}`);
  };

  const usersQuery = useMemoFirebase(() => (db && isAdmin ? collection(db, "users") : null), [db, isAdmin]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection(usersQuery);

  const settingsRef = useMemoFirebase(() => (db && isAdmin ? doc(db, "settings", "backup") : null), [db, isAdmin]);
  const { data: autoSettings } = useDoc(settingsRef);

  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUpManual, setIsBackingUpManual] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  useEffect(() => {
    if (profile?.name) setDisplayName(profile.name);
    if (profile?.branchName) setBranchName(profile.branchName);
    else if (profile?.branch) setBranchName(profile.branch);
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
    updateDocumentNonBlocking(profileRef, { name: displayName, updatedAt: serverTimestamp() });
    toast({ title: "Profile Updated" });
  };

  const handleUpdateBranch = () => {
    if (!profileRef || !branchName) return;
    updateDocumentNonBlocking(profileRef, { branchName: branchName, updatedAt: serverTimestamp() });
    toast({ title: "Branch Updated" });
  };

  const handleUpdatePassword = async () => {
    if (!user || !newPassword) return;
    setIsSaving(true);
    try {
      await updatePassword(user, newPassword);
      toast({ title: "Password Updated" });
      setNewPassword("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualBackupTrigger = async () => {
    if (!db || !user) return;
    setIsBackingUpManual(true);
    toast({ title: "Processing Backup" });

    try {
      const backupData: Record<string, any[]> = {};
      let total = 0;
      for (const colName of BACKUP_COLLECTIONS) {
        const snapshot = await getDocs(collection(db, colName));
        const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        backupData[colName] = docs;
        total += docs.length;
      }
      const recipient = autoSettings?.email || "ezydriveapp@gmail.com";
      const result = await sendBackupEmail({
        email: recipient,
        backupSummary: `Manual Export: ${total} records.`,
        timestamp: new Date().toLocaleString(),
        backupDataJson: JSON.stringify(backupData, null, 2),
      });
      if (result.success) {
        const metadataRef = doc(db, "backupMetadata", `MANUAL-${Date.now()}`);
        setDocumentNonBlocking(metadataRef, { id: metadataRef.id, timestamp: serverTimestamp(), performedBy: user.email, status: "Successful", type: "Manual Email Backup" }, { merge: true });
        toast({ title: "Backup Sent" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Internal Error" });
    } finally {
      setIsBackingUpManual(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    const unique = [];
    const seen = new Set();
    allUsers.forEach((u: any) => {
      const key = u.email?.toLowerCase() || u.id?.toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(u); }
    });
    if (!userSearchTerm) return unique;
    const term = userSearchTerm.toLowerCase();
    return unique.filter(u => u.email?.toLowerCase().includes(term) || u.role?.toLowerCase().includes(term) || u.name?.toLowerCase().includes(term));
  }, [allUsers, userSearchTerm]);

  if (!profile) return <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-1 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Settings & Identity</h2>
        <p className="text-muted-foreground text-sm">Manage your personal and system configurations.</p>
      </div>

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
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />User Control</CardTitle>
                  <CardDescription>Manage login accounts and cleanup records.</CardDescription>
                </div>
                <div className="relative w-full sm:w-[250px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search user..." className="pl-8" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>User / Role</TableHead><TableHead>Last Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isUsersLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8">Loading...</TableCell></TableRow> : filteredUsers.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 italic">No matches.</TableCell></TableRow> : filteredUsers.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell><div className="flex flex-col"><span className="font-medium">{u.name || u.email}</span><span className="text-[10px] uppercase font-bold text-muted-foreground">{u.role}</span></div></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.updatedAt?.seconds ? formatDistanceToNow(new Date(u.updatedAt.seconds * 1000), { addSuffix: true }) : 'Never'}</TableCell>
                        <TableCell className="text-right">
                          {(u.role === 'Admin' || u.id === user?.uid) ? <Badge variant="secondary">Protected</Badge> : <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => { if(window.confirm('Delete this login?')) deleteDocumentNonBlocking(doc(db, "users", u.id)); }}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="profile" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-5">
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center gap-6 py-8">
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-primary/20"><AvatarImage src={profile?.avatarUrl} /><AvatarFallback><UserIcon className="h-12 w-12" /></AvatarFallback></Avatar>
                  <Button size="icon" variant="secondary" className="absolute bottom-0 right-0 rounded-full shadow-lg" onClick={() => fileInputRef.current?.click()}><Camera className="h-5 w-5" /></Button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg" onChange={handlePhotoUpload} />
                </div>
                <div className="text-center"><h3 className="font-bold text-lg">{profile?.name}</h3><p className="text-sm text-muted-foreground">{profile?.email}</p></div>
              </CardContent>
            </Card>
            <Card className="md:col-span-3">
              <CardHeader><CardTitle>Account Details</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4">
                  <div className="grid gap-2"><Label>Display Name</Label><div className="flex gap-2"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /><Button variant="outline" onClick={handleUpdateProfile}>Update</Button></div></div>
                  {isBranchManager && <div className="grid gap-2"><Label>Branch Identity</Label><div className="flex gap-2"><Input value={branchName} onChange={(e) => setBranchName(e.target.value)} /><Button variant="outline" onClick={handleUpdateBranch}>Update</Button></div></div>}
                </div>
                <Separator />
                <div className="space-y-4">
                  <Label>Security</Label>
                  <div className="grid gap-2"><Label>New Password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
                  <Button onClick={handleUpdatePassword} disabled={isSaving || newPassword.length < 6}>{isSaving && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}Update Password</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="automation" className="space-y-6 mt-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><DatabaseBackup className="h-5 w-5 text-primary" />Backup Automation</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4 bg-primary/5">
                  <div className="space-y-0.5"><Label className="text-base">Enable Auto-Backup</Label><p className="text-sm text-muted-foreground">Daily database snapshots at 12:00 AM.</p></div>
                  <Switch checked={autoSettings?.enabled ?? true} onCheckedChange={(checked) => setDocumentNonBlocking(settingsRef, { enabled: checked }, { merge: true })} />
                </div>
                <div className="grid gap-2"><Label>Destination Email</Label><Input value={autoSettings?.email || "ezydriveapp@gmail.com"} onChange={(e) => setDocumentNonBlocking(settingsRef, { email: e.target.value }, { merge: true })} /></div>
                <Separator />
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border bg-accent/5">
                  <div className="grid gap-1"><p className="text-sm font-bold">Manual Email Backup</p><p className="text-xs text-muted-foreground">Trigger a report manually.</p></div>
                  <Button size="sm" onClick={handleManualBackupTrigger} disabled={isBackingUpManual}>{isBackingUpManual ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send Now</Button>
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
  return <Suspense fallback={<div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>}><SettingsContent /></Suspense>;
}
