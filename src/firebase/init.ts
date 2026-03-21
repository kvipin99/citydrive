
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

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

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app)
  };
}
