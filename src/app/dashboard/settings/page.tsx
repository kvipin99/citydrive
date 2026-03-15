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
import { Mail, ShieldCheck, DatabaseBackup, Users, Key, Camera, User as UserIcon, RefreshCw, Search, Send, Loader2, Trash2, UserCircle, Lock, MapPin, AlertTriangle, Eraser, Clock, HardDrive, FileArchive, Link as LinkIcon, CheckCircle2, AlertCircle, Info, Copy } from "lucide-react";
import { useFirestore, useUser, useCollection, useDoc, useMemoFirebase, deleteDocumentNonBlocking, useAuth } from "@/firebase";
import { collection, doc, serverTimestamp, getDocs, query, where, writeBatch } from "firebase/firestore";
import { updatePassword, sendPasswordResetEmail } from "firebase/auth";
import { formatDistanceToNow } from "date-fns";
import { setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { syncToGoogleDrive, getGoogleAuthUrl } from "@/ai/flows/google-drive-sync-flow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BACKUP_COLLECTIONS = [
  "users", 
  "students", 
  "instructors", 
  "vehicles", 
  "courses", 
  "payments", 
  "expenses", 
  "classes",
  "attendance",
  "resources",
  "quizLinks",
  "settings"
];

function SettingsContent() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("profile");
  const [currentOrigin, setCurrentOrigin] = useState("");

  const profileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(profileRef);
  
  const isMaster = user?.email === 'master@citydriving.in';
  const isAdmin = profile?.role === 'Admin' || isMaster;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }

    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    } else if (profile) {
      setActiveTab(isAdmin ? "general" : "profile");
    }

    const success = searchParams.get("success");
    if (success === "connected") {
      toast({ title: "Google Drive Connected", description: "The backup system is now linked to your account." });
    }
    
    const error = searchParams.get("error");
    if (error === "auth_failed") {
      toast({ variant: "destructive", title: "Connection Failed", description: "The Google authorization flow was interrupted or failed." });
    }
  }, [searchParams, profile, isAdmin, toast]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/dashboard/settings?tab=${value}`);
  };

  const usersQuery = useMemoFirebase(() => (db && isAdmin ? collection(db, "users") : null), [db, isAdmin]);
  const { data: allUsers, isLoading: isUsersLoading } = useCollection(usersQuery);

  const settingsRef = useMemoFirebase(() => (db && isAdmin ? doc(db, "settings", "backup") : null), [db, isAdmin]);
  const { data: autoSettings } = useDoc(settingsRef);

  const tokensRef = useMemoFirebase(() => (db && isAdmin ? doc(db, "settings", "drive_tokens") : null), [db, isAdmin]);
  const { data: driveTokens } = useDoc(tokensRef);

  const controlsRef = useMemoFirebase(() => (db && isAdmin ? doc(db, "settings", "controls") : null), [db, isAdmin]);
  const { data: controls } = useDoc(controlsRef);

  const [displayName, setDisplayName] = useState("");
  const [isBackingUpManual, setIsBackingUpManual] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  useEffect(() => {
    if (profile?.name) setDisplayName(profile.name);
  }, [profile]);

  const handleConnectDrive = async () => {
    try {
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleCopyUri = () => {
    const uri = `${currentOrigin}/api/auth/google/callback`;
    navigator.clipboard.writeText(uri);
    toast({ title: "Copied", description: "Redirect URI copied to clipboard." });
  };

  const handleManualBackupTrigger = async () => {
    if (!db || !user) return;
    setIsBackingUpManual(true);
    toast({ title: "ZIP Syncing to Drive", description: "Compressing and uploading full school database to Drive..." });

    try {
      const backupData: Record<string, any[]> = {};
      for (const colName of BACKUP_COLLECTIONS) {
        try {
          const snapshot = await getDocs(collection(db, colName));
          backupData[colName] = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch (e) {}
      }
      
      const result = await syncToGoogleDrive({
        backupDataJson: JSON.stringify(backupData, null, 2),
        timestamp: new Date().toLocaleString('en-IN'),
      });

      if (result.success) {
        const metadataRef = doc(db, "backupMetadata", `DRIVE-SYNC-MANUAL-${Date.now()}`);
        setDocumentNonBlocking(metadataRef, { 
          id: metadataRef.id, 
          timestamp: serverTimestamp(), 
          performedBy: user.email, 
          status: "Successful", 
          type: "Manual Google Drive ZIP Sync" 
        }, { merge: true });
        toast({ title: "Sync Successful", description: result.message });
      } else {
        toast({ variant: "destructive", title: "Sync Failed", description: result.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Internal Error", description: error.message });
    } finally {
      setIsBackingUpManual(false);
    }
  };

  const performModularReset = async (category: string, collections: string[]) => {
    if (!db || !isMaster) return;
    setIsResetting(true);
    toast({ title: "Reset Started", description: `Wiping ${category} data...` });

    try {
      for (const colName of collections) {
        const snapshot = await getDocs(collection(db, colName));
        snapshot.docs.forEach(d => {
          if (colName === 'users') {
            const userData = d.data();
            if (userData.role === 'Admin' || d.id === user?.uid || userData.email?.includes('master')) return;
          }
          deleteDocumentNonBlocking(doc(db, colName, d.id));
        });
      }
      toast({ title: "Wipe Complete", description: `${category} has been cleared.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Reset Failed", description: error.message });
    } finally {
      setIsResetting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    const unique: any[] = [];
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
                  <CardDescription>Manage password resets and system access.</CardDescription>
                </div>
                <div className="relative w-full sm:w-[250px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search user..." className="pl-8" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>User / Role</TableHead>    <TableHead>Last Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {isUsersLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8">Loading...</TableCell></TableRow> : filteredUsers.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 italic">No matches.</TableCell></TableRow> : filteredUsers.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell><div className="flex flex-col"><span className="font-medium">{u.name || u.email}</span><span className="text-[10px] uppercase font-bold text-muted-foreground">{u.role}</span></div></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.updatedAt?.seconds ? formatDistanceToNow(new Date(u.updatedAt.seconds * 1000), { addSuffix: true }) : 'Never'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold" onClick={() => sendPasswordResetEmail(auth!, u.email)}>
                              <Key className="h-3 w-3 mr-1" /> Reset Pwd
                            </Button>
                            {isMaster && u.id !== user?.uid && (
                              <Button variant="ghost" size="sm" className="text-destructive h-8 text-[10px] font-bold" onClick={() => { if(window.confirm('Delete user?')) deleteDocumentNonBlocking(doc(db, "users", u.id)); }}>
                                <Trash2 className="h-3 w-3 mr-1" /> Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {isMaster && (
              <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    <CardTitle>Advanced System Reset</CardTitle>
                  </div>
                  <CardDescription className="text-destructive/80">Irreversible master data wipe.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ResetAction title="Students" onReset={() => performModularReset("Students", ["students", "users"])} disabled={isResetting} />
                  <ResetAction title="Financials" onReset={() => performModularReset("Financials", ["payments", "expenses"])} disabled={isResetting} />
                  <ResetAction title="Vehicles" onReset={() => performModularReset("Vehicles", ["vehicles"])} disabled={isResetting} />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20"><AvatarImage src={profile?.avatarUrl} /><AvatarFallback><UserIcon className="h-10 w-10" /></AvatarFallback></Avatar>
                <div>
                  <h3 className="font-bold">{profile?.name}</h3>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
              </div>
              <div className="grid gap-4 max-w-md">
                <div className="grid gap-2"><Label>Display Name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
                <Button onClick={() => updateDocumentNonBlocking(profileRef!, { name: displayName })}>Update Profile</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="automation" className="space-y-6 mt-6">
            <Card className="border-orange-200 bg-orange-50/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  Operational Guardrails
                </CardTitle>
                <CardDescription>Branch entry policies.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border p-4 bg-background">
                  <div className="space-y-0.5">
                    <Label className="text-base">Lock Entry Date (Today Only)</Label>
                    <p className="text-sm text-muted-foreground">Restrict branches to current date entries.</p>
                  </div>
                  <Switch checked={controls?.lockDateEntry ?? false} onCheckedChange={(checked) => setDocumentNonBlocking(controlsRef!, { lockDateEntry: checked }, { merge: true })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-primary" />
                  Google Drive Backup Sync
                </CardTitle>
                <CardDescription>Daily database ZIP snapshots.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="bg-primary/5 border-primary/20">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Final Configuration Checklist</AlertTitle>
                  <AlertDescription className="text-xs space-y-3 mt-2">
                    <p>To avoid <b>Error 400 (redirect_uri_mismatch)</b> and <b>403 (Forbidden)</b>, verify these settings in your <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline text-blue-600">Google Cloud Console</a>:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>
                        <b>Test Users:</b> Under "OAuth Consent Screen", ensure your email <b>{user?.email}</b> is added to "Test Users".
                      </li>
                      <li>
                        <b>Redirect URI:</b> Under "Credentials" {"->"} "OAuth 2.0 Client IDs", add the following URI to <b>"Authorized redirect URIs"</b>:
                        <div className="flex items-center gap-2 mt-1 p-2 bg-muted rounded font-mono text-[10px] break-all">
                          <span>{currentOrigin}/api/auth/google/callback</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopyUri}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-4 bg-primary/5">
                    <div className="space-y-0.5">
                      <Label className="text-base">Connection Status</Label>
                      <p className="text-sm text-muted-foreground">
                        {driveTokens ? 'Linked to Google Drive' : 'Drive access not authorized.'}
                      </p>
                    </div>
                    {driveTokens ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 gap-1.5 font-bold">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={handleConnectDrive} className="text-xs">Reconnect</Button>
                      </div>
                    ) : (
                      <Button onClick={handleConnectDrive} size="sm" className="gap-2">
                        <LinkIcon className="h-4 w-4" /> Connect Google Account
                      </Button>
                    )}
                  </div>

                  {driveTokens && (
                    <div className="flex items-center justify-between rounded-lg border p-4 bg-background">
                      <div className="space-y-0.5">
                        <Label className="text-base">Enable Daily ZIP Sync</Label>
                        <p className="text-sm text-muted-foreground">Automatic 24h interval snapshots.</p>
                      </div>
                      <Switch checked={autoSettings?.enabled ?? true} onCheckedChange={(checked) => setDocumentNonBlocking(settingsRef!, { enabled: checked }, { merge: true })} />
                    </div>
                  )}
                </div>
                
                {driveTokens && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border bg-accent/5">
                    <div className="grid gap-1">
                      <p className="text-sm font-bold flex items-center gap-2">
                        <FileArchive className="h-4 w-4 text-primary" />
                        Sync ZIP Snapshot Now
                      </p>
                      <p className="text-xs text-muted-foreground">Manually trigger a compressed upload.</p>
                    </div>
                    <Button size="sm" onClick={handleManualBackupTrigger} disabled={isBackingUpManual}>
                      {isBackingUpManual ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Sync Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function ResetAction({ title, onReset, disabled }: any) {
  return (
    <div className="p-4 rounded-xl border bg-white space-y-3">
      <h4 className="text-sm font-black uppercase">{title}</h4>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full text-destructive border-destructive/20" disabled={disabled}>Wipe</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Wipe {title}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onReset}>Wipe</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>}><SettingsContent /></Suspense>;
}
