
"use client";

import { useEffect, useRef } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";

/**
 * UsageHeartbeat Component
 * Logs a presence heartbeat to Firestore every 10 minutes.
 */
export function UsageHeartbeat() {
  const { user } = useUser();
  const db = useFirestore();
  
  const userProfileRef = useMemoFirebase(() => (db && user ? doc(db, 'users', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userProfileRef);

  const lastLogRef = useRef<number>(0);
  const INTERVAL_MS = 10 * 60 * 1000; // 10 Minutes

  useEffect(() => {
    if (!db || !user || !profile) return;

    const logHeartbeat = async () => {
      const now = Date.now();
      
      // Prevent rapid firing
      if (now - lastLogRef.current < INTERVAL_MS - 5000) return;

      try {
        const usageRef = collection(db, "usageLogs");
        await addDoc(usageRef, {
          userId: user.uid,
          userName: profile.name || user.email || "Unknown User",
          role: profile.role || "User",
          branch: profile.branch || "HeadOffice",
          date: format(new Date(), 'yyyy-MM-dd'),
          timestamp: serverTimestamp()
        });
        
        lastLogRef.current = now;
        console.log("[USAGE] Heartbeat logged at " + new Date().toLocaleTimeString());
      } catch (e) {
        console.error("[USAGE] Failed to log heartbeat:", e);
      }
    };

    // Initial log
    logHeartbeat();

    // Recurring interval
    const timer = setInterval(logHeartbeat, INTERVAL_MS);
    
    return () => clearInterval(timer);
  }, [db, user, profile, INTERVAL_MS]);

  return null;
}
