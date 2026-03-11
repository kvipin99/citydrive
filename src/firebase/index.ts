'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// Robust initialization for App Router and Client side
export function initializeFirebase() {
  let app: FirebaseApp;
  
  const apps = getApps();
  if (apps.length === 0) {
    try {
      // Attempt to initialize using environmental defaults, fallback to manual config
      app = initializeApp(firebaseConfig);
    } catch (e) {
      // Handle race condition where another component initialized it simultaneously
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

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
