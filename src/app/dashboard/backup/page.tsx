"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { DownloadCloud, UploadCloud, History as HistoryIcon, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import { useFirestore, useUser, useDoc, useCollection, useMemoFirebase, setDocumentNonBlocking } from "@/firebase";
import { collection, getDocs, doc, serverTimestamp, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const BACKUP_COLLECTIONS = [
  "users",
  "students",
  "instructors",
  "vehicles",
  "courses",
  "payments",
  "expenses",
  "classes"
];

export default function BackupPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Check Admin Status
  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === "Admin";

  // Fetch Backup History
  const historyQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "backupMetadata"), orderBy("timestamp", "desc"), limit(10));
  }, [db, user]);
  const { data: history, isLoading: isHistoryLoading } = useCollection(historyQuery);

  const handleBackup = async () => {
    if (!isAdmin) {
      toast({ variant: "destructive", title: "Access Denied", description: "Only administrators can perform backups." });
      return;
    }

    setIsBackingUp(true);
    toast({ title: "Backup Started", description: "Aggregating all school records..." });

    try {
      const backupData: Record<string, any[]> = {};

      for (const colName of BACKUP_COLLECTIONS) {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        backupData[colName] = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      }

      // Create Download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `citydrive_backup_${format(new Date(), "yyyy-MM-dd_HHmm")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Log to Metadata
      const metadataRef = doc(db, "backupMetadata", `BK-${Date.now()}`);
      setDocumentNonBlocking(metadataRef, {
        id: metadataRef.id,
        timestamp: serverTimestamp(),
        performedBy: user?.email,
        status: "Successful",
        type: "Manual Export"
      }, { merge: true });

      toast({ title: "Backup Successful", description: "Data has been downloaded to your computer." });
    } catch (error: any) {
      console.error("Backup failed:", error);
      toast({ variant: "destructive", title: "Backup Failed", description: error.message || "Could not complete the data export." });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setIsRestoring(true);
        toast({ title: "Restore Started", description: "Writing data to the database. Do not close this window." });

        let restoredCount = 0;

        for (const [colName, docs] of Object.entries(data)) {
          if (!Array.isArray(docs)) continue;
          
          for (const docData of docs) {
            if (!docData.id) continue;
            const docRef = doc(db, colName, docData.id);
            // We use setDocumentNonBlocking to avoid awaiting every single doc for speed
            // but in a restore we might actually want to track progress
            setDocumentNonBlocking(docRef, docData, { merge: true });
            restoredCount++;
          }
        }

        toast({ 
          title: "Restore Complete", 
          description: `Successfully processed ${restoredCount} records across the system.` 
        });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Restore Failed", description: "Invalid backup file format." });
      } finally {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  if (!isAdmin && profile) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center space-y-4">
        <ShieldAlert className="h-16 w-16 text-destructive opacity-50" />
        <h2 className="text-2xl font-bold">Unauthorized Access</h2>
        <p className="text-muted-foreground max-w-md">
          The Backup and Restore module is restricted to system administrators only. 
          Please contact the head office if you believe this is an error.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DownloadCloud className="h-5 w-5 text-primary" />
              Database Export
            </CardTitle>
            <CardDescription>
              Create a snapshots of your entire school data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This includes students, instructors, vehicles, fee collections, and expenses. The backup is downloaded as a JSON file.
            </p>
            <Button className="w-full" onClick={handleBackup} disabled={isBackingUp}>
              {isBackingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
              {isBackingUp ? "Generating Backup..." : "Create Full Backup"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-destructive" />
              Restore System
            </CardTitle>
            <CardDescription>
              Revert database state using a backup file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive font-medium flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Warning: This may overwrite existing data.
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".json" 
              onChange={handleRestore} 
            />
            <Button variant="outline" className="w-full border-destructive/20 text-destructive hover:bg-destructive hover:text-white" onClick={() => fileInputRef.current?.click()} disabled={isRestoring}>
              {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {isRestoring ? "Restoring Data..." : "Upload & Restore"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-muted-foreground" />
              Backup History
            </CardTitle>
            <CardDescription>Recent successful data export operations.</CardDescription>
          </CardHeader>
          <CardContent>
            {isHistoryLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic">
                        No backup logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history?.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {log.timestamp?.seconds ? format(new Date(log.timestamp.seconds * 1000), "MMM dd, yyyy HH:mm") : "Just now"}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{log.performedBy}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 gap-1.5 py-0.5">
                            <CheckCircle2 className="h-3 w-3" /> {log.status}
                          </Badge>
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
    </div>
  );
}
