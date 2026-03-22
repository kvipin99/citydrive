
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore'

/**
 * Robust initialization for App Router (Server & Client side).
 * This file is directive-less to allow isomorphic usage.
 */
export function initializeFirebase() {
  let app: FirebaseApp;
  
  const apps = getApps();
  if (apps.length === 0) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
      const checkApps = getApps();
      if (checkApps.length > 0) {
        app = checkApps[0];
      } else {
        console.error("Firebase initialization failed:", e);
        app = initializeApp(firebaseConfig);
      }
    }
  } else {
    app = apps[0];
  }

  /**
   * To fix connectivity issues ("unavailable" / "Could not reach Cloud Firestore backend")
   * often encountered in restricted network environments or cloud proxies,
   * we force Firestore to use long-polling when running in the browser.
   */
  let firestore;
  if (typeof window !== 'undefined') {
    try {
      // Use initializeFirestore to enable experimental settings on the client
      firestore = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      // If Firestore was already initialized (e.g., via getFirestore elsewhere), 
      // fallback to getFirestore to avoid "Firestore already initialized" errors.
      firestore = getFirestore(app);
    }
  } else {
    // Standard gRPC connection is used on the server for better performance.
    firestore = getFirestore(app);
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: firestore
  };
}
