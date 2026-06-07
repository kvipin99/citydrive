import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * Robust initialization for App Router (Server & Client side).
 * This file is directive-less to allow isomorphic usage.
 */
export function initializeFirebase() {
  const apps = getApps();
  // Simplified initialization to ensure idempotent behavior
  const firebaseApp = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);

  /**
   * To fix connectivity issues often encountered in restricted network environments,
   * we force Firestore to use long-polling when running in the browser.
   */
  let firestore;
  if (typeof window !== 'undefined') {
    try {
      // Use initializeFirestore to enable experimental settings on the client
      firestore = initializeFirestore(firebaseApp, {
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      // Fallback if already initialized (common during Fast Refresh)
      firestore = getFirestore(firebaseApp);
    }
  } else {
    // Standard gRPC connection is used on the server
    firestore = getFirestore(firebaseApp);
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore,
    storage: getStorage(firebaseApp)
  };
}
