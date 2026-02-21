'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, getDocs, doc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { sendBackupEmail } from '@/ai/flows/backup-email-flow';
import { useToast } from '@/hooks/use-toast';
import { startOfWeek } from 'date-fns';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const BACKUP_COLLECTIONS = ["users", "students", "instructors", "vehicles", "courses", "payments", "expenses", "classes"];

/**
 * This component runs silently in the background. 
 * For Admins, it checks if a backup is due (Every Sunday 12:00 AM).
 */
export function AutoBackupTrigger() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [hasRunThisSession, setHasRunThisSession] = useState(false);

  // Check Admin Status
  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user]);
  const { data: profile } = useDoc(userProfileRef);

  // Fetch Automation Settings
  const settingsRef = useMemoFirebase(() => (db ? doc(db, "settings", "backup") : null), [db]);
  const { data: autoSettings } = useDoc(settingsRef);
  
  useEffect(() => {
    async function checkAndRunBackup() {
      // Logic checks
      if (!db || !user || !profile || profile.role !== 'Admin' || hasRunThisSession) return;
      if (autoSettings?.enabled === false) return;

      try {
        const q = query(collection(db, "backupMetadata"), orderBy("timestamp", "desc"), limit(1));
        const snap = await getDocs(q);
        const lastBackup = snap.docs[0]?.data();
        
        const lastDate = lastBackup?.timestamp?.seconds 
          ? new Date(lastBackup.timestamp.seconds * 1000) 
          : new Date(0);
        
        // Schedule: Every Sunday at 12:00 AM
        const currentSunday = startOfWeek(new Date(), { weekStartsOn: 0 }); // Current week's Sunday midnight

        // If the last recorded backup was BEFORE this Sunday, and we are ON or AFTER this Sunday, trigger it.
        if (lastDate < currentSunday) {
          console.log("[AUTO-BACKUP] New weekly backup is due. Starting automated process...");
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
          const summary = `Weekly Sunday Database Export: ${totalRecords} total records across ${BACKUP_COLLECTIONS.length} collections.`;
          
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
              performedBy: "SYSTEM (Automated Sunday)",
              status: "Successful",
              type: "Scheduled Email Backup"
            }, { merge: true });

            toast({
              title: "Weekly Backup Sent",
              description: `The Sunday automated backup was successfully sent to ${emailRecipient}.`,
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
  }, [db, user, profile, autoSettings, hasRunThisSession, toast]);

  return null;
}
