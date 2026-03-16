
'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, getDocs, doc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { runFullDriveBackup } from '@/ai/flows/google-drive-sync-flow';
import { useToast } from '@/hooks/use-toast';
import { startOfDay } from 'date-fns';

/**
 * This component runs silently in the background of the dashboard layout.
 * It checks if a daily backup has been performed and triggers a ZIP sync to Drive if needed.
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
          console.log("[CITYDRIVE] Daily Google Drive ZIP sync sequence initiated...");
          setIsProcessing(true);
          
          // Call the server-side flow directly
          const result = await runFullDriveBackup();

          if (result.success) {
            toast({
              title: "Daily Backup Synced",
              description: result.message,
            });
          }
        }
      } catch (error) {
        console.error("[CITYDRIVE] Auto-backup Drive sync error:", error);
      } finally {
        setIsProcessing(false);
      }
    }

    // Run the check with a small delay after dashboard mount
    const timer = setTimeout(() => executeDailyCheck(), 5000);
    return () => clearTimeout(timer);
  }, [db, user?.uid, isAdmin, autoSettings, isProcessing, toast]);

  return null;
}
