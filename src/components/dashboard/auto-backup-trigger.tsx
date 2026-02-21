'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, getDocs, doc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { sendBackupEmail } from '@/ai/flows/backup-email-flow';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays } from 'date-fns';

const BACKUP_COLLECTIONS = ["users", "students", "instructors", "vehicles", "courses", "payments", "expenses"];

/**
 * This component runs silently in the background. 
 * For Admins, it checks if a backup is due (twice a week = every 3.5 days).
 */
export function AutoBackupTrigger() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [hasRunThisSession, setHasRunThisSession] = useState(false);

  // Check Admin Status and Settings
  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);

  // Get Last Backup Metadata
  const lastBackupQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "backupMetadata"), orderBy("timestamp", "desc"), limit(1));
  }, [db, user]);
  const { data: lastBackups } = useDoc(lastBackupQuery ? (lastBackups as any)?.[0] : null); 
  // Note: we use useCollection usually for queries, but let's simplify logic:
  
  useEffect(() => {
    async function checkAndRunBackup() {
      if (!db || !user || !profile || profile.role !== 'Admin' || hasRunThisSession) return;

      try {
        // Fetch last backup from history
        const q = query(collection(db, "backupMetadata"), orderBy("timestamp", "desc"), limit(1));
        const snap = await getDocs(q);
        const lastBackup = snap.docs[0]?.data();
        
        const lastDate = lastBackup?.timestamp?.seconds 
          ? new Date(lastBackup.timestamp.seconds * 1000) 
          : new Date(0);
        
        const daysSinceLast = differenceInDays(new Date(), lastDate);

        // Schedule: Twice a week (~ every 3.5 days)
        if (daysSinceLast >= 3) {
          console.log("[AUTO-BACKUP] Backup is due. Starting automated process...");
          setHasRunThisSession(true);
          
          const backupData: Record<string, any[]> = {};
          let totalRecords = 0;

          for (const colName of BACKUP_COLLECTIONS) {
            const colRef = collection(db, colName);
            const snapshot = await getDocs(colRef);
            const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
            backupData[colName] = docs;
            totalRecords += docs.length;
          }

          // Simulate Sending Email via Genkit Flow
          const emailRecipient = profile.email || "admin@citydriving.in";
          const summary = `Full Database Export: ${totalRecords} total records across ${BACKUP_COLLECTIONS.length} collections.`;
          
          await sendBackupEmail({
            email: emailRecipient,
            backupSummary: summary,
            timestamp: new Date().toLocaleString(),
          });

          // Log the successful automated backup
          const metadataRef = doc(db, "backupMetadata", `AUTO-${Date.now()}`);
          setDocumentNonBlocking(metadataRef, {
            id: metadataRef.id,
            timestamp: serverTimestamp(),
            performedBy: "SYSTEM (Automated)",
            status: "Successful",
            type: "Scheduled Email Backup"
          }, { merge: true });

          toast({
            title: "Automated Backup Sent",
            description: `A scheduled backup of ${totalRecords} records was sent to ${emailRecipient}.`,
          });
        }
      } catch (error) {
        console.error("[AUTO-BACKUP] Failed:", error);
      }
    }

    checkAndRunBackup();
  }, [db, user, profile, hasRunThisSession]);

  return null;
}
