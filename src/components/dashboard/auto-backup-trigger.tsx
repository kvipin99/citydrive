
'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, getDocs, doc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { sendBackupEmail } from '@/ai/flows/backup-email-flow';
import { useToast } from '@/hooks/use-toast';
import { startOfDay } from 'date-fns';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

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

const DEFAULT_BACKUP_EMAIL = "ezydriveapp@gmail.com";

/**
 * This component runs silently in the background of the dashboard layout.
 * It checks if a daily backup has been performed and triggers one if needed.
 */
export function AutoBackupTrigger() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  // Identify if current user is an Admin
  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, "users", user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userProfileRef);
  const isAdmin = profile?.role === 'Admin' || user?.email === 'master@citydriving.in';

  // Fetch specific backup settings
  const settingsRef = useMemoFirebase(() => (db && isAdmin ? doc(db, "settings", "backup") : null), [db, isAdmin]);
  const { data: autoSettings } = useDoc(settingsRef);
  
  useEffect(() => {
    async function executeDailyCheck() {
      // Security & State Checks
      if (!db || !user || !isAdmin || isProcessing) return;
      
      // Allow disabling via settings, but default to enabled
      if (autoSettings?.enabled === false) return;

      try {
        // Query the last successful backup log
        const q = query(collection(db, "backupMetadata"), orderBy("timestamp", "desc"), limit(1));
        const snap = await getDocs(q);
        const lastBackup = snap.docs[0]?.data();
        
        const lastBackupDate = lastBackup?.timestamp?.seconds 
          ? new Date(lastBackup.timestamp.seconds * 1000) 
          : new Date(0);
        
        const startOfTodayDate = startOfDay(new Date());

        // If the last backup was performed BEFORE today, we trigger a new one.
        if (lastBackupDate < startOfTodayDate) {
          console.log("[CITYDRIVE] Daily Google Drive sync sequence initiated...");
          setIsProcessing(true);
          
          const backupData: Record<string, any[]> = {};
          let totalRecords = 0;

          // Aggregate all specified collections
          for (const colName of BACKUP_COLLECTIONS) {
            try {
              const colRef = collection(db, colName);
              const snapshot = await getDocs(colRef);
              const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
              backupData[colName] = docs;
              totalRecords += docs.length;
            } catch (e) {
              console.warn(`[BACKUP] Skipping collection ${colName} due to permissions or absence.`);
            }
          }

          const recipient = autoSettings?.email || DEFAULT_BACKUP_EMAIL;
          const summary = `Automated Daily Drive Sync: ${totalRecords} records across modules.`;
          
          const result = await sendBackupEmail({
            email: recipient,
            backupSummary: summary,
            timestamp: new Date().toLocaleString('en-IN'),
            backupDataJson: JSON.stringify(backupData, null, 2),
          });

          if (result.success) {
            // Record the successful automated run
            const metadataRef = doc(db, "backupMetadata", `DRIVE-SYNC-AUTO-${Date.now()}`);
            setDocumentNonBlocking(metadataRef, {
              id: metadataRef.id,
              timestamp: serverTimestamp(),
              performedBy: "System Drive Automation",
              status: "Successful",
              type: "Daily Google Drive Sync"
            }, { merge: true });

            toast({
              title: "Backup Synced to Drive",
              description: `Database snapshot has been successfully synced to your Google Drive via ${recipient}.`,
            });
          }
        }
      } catch (error) {
        console.error("[CITYDRIVE] Auto-backup Drive sync error:", error);
      } finally {
        // Processing set to false
      }
    }

    // Run the check with a small delay after dashboard mount to prioritize UI rendering
    const timer = setTimeout(() => executeDailyCheck(), 5000);
    return () => clearTimeout(timer);
  }, [db, user?.uid, isAdmin, autoSettings, isProcessing, toast]);

  return null;
}
