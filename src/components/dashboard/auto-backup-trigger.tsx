
'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, getDocs, doc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { sendBackupEmail } from '@/ai/flows/backup-email-flow';
import { useToast } from '@/hooks/use-toast';
import { startOfDay } from 'date-fns';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const BACKUP_COLLECTIONS = ["users", "students", "instructors", "vehicles", "courses", "payments", "expenses", "classes"];

/**
 * This component runs silently in the background. 
 * For Admins, it checks if a backup is due (Every Day at 12:00 AM).
 */
export function AutoBackupTrigger() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [hasRunThisSession, setHasRunThisSession] = useState(false);

  // Check Admin Status
  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin';

  // Fetch Automation Settings - Only if the user is an Admin to avoid permission errors
  const settingsRef = useMemoFirebase(() => (db && isAdmin ? doc(db, "settings", "backup") : null), [db, isAdmin]);
  const { data: autoSettings } = useDoc(settingsRef);
  
  useEffect(() => {
    async function checkAndRunBackup() {
      // Logic checks - only Admins can run the backup check
      if (!db || !user || !profile || !isAdmin || hasRunThisSession) return;
      if (autoSettings?.enabled === false) return;

      try {
        const q = query(collection(db, "backupMetadata"), orderBy("timestamp", "desc"), limit(1));
        const snap = await getDocs(q);
        const lastBackup = snap.docs[0]?.data();
        
        const lastDate = lastBackup?.timestamp?.seconds 
          ? new Date(lastBackup.timestamp.seconds * 1000) 
          : new Date(0);
        
        // Schedule: Every Day at 12:00 AM (midnight)
        const currentDay = startOfDay(new Date());

        // If the last recorded backup was BEFORE today midnight, trigger it.
        if (lastDate < currentDay) {
          console.log("[AUTO-BACKUP] New daily backup is due. Starting automated process...");
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

          const emailRecipient = autoSettings?.email || "ezydriveapp@gmail.com";
          const summary = `Daily Database Export: ${totalRecords} total records across ${BACKUP_COLLECTIONS.length} collections.`;
          
          const result = await sendBackupEmail({
            email: emailRecipient,
            backupSummary: summary,
            timestamp: new Date().toLocaleString(),
            backupDataJson: JSON.stringify(backupData, null, 2),
          });

          if (result.success) {
            // Log the successful automated backup
            const metadataRef = doc(db, "backupMetadata", `AUTO-${Date.now()}`);
            setDocumentNonBlocking(metadataRef, {
              id: metadataRef.id,
              timestamp: serverTimestamp(),
              performedBy: "SYSTEM (Daily Automated)",
              status: "Successful",
              type: "Scheduled Email Backup"
            }, { merge: true });

            toast({
              title: "Daily Backup Sent",
              description: `The daily automated backup was successfully sent to ${emailRecipient}.`,
            });
          } else {
            console.error("[AUTO-BACKUP] Email failed:", result.message);
          }
        }
      } catch (error) {
        console.error("[AUTO-BACKUP] Error during check:", error);
      }
    }

    checkAndRunBackup();
  }, [db, user, profile, isAdmin, autoSettings, hasRunThisSession, toast]);

  return null;
}
