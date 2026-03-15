'use server';
/**
 * @fileOverview A self-contained Genkit flow for backing up Firestore and Storage to Google Drive.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import JSZip from 'jszip';
import { Readable } from 'stream';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, listAll, getBytes } from 'firebase/storage';
import { headers } from 'next/headers';

const BACKUP_COLLECTIONS = [
  "users", "students", "instructors", "vehicles", 
  "courses", "payments", "expenses", "classes",
  "attendance", "resources", "quizLinks", "settings"
];

const DriveSyncInputSchema = z.object({
  secret: z.string().optional().describe('Security key for cron triggers'),
});

const DriveSyncOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  fileId: z.string().optional(),
});

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || "144251106401-7asi8iiqruhe8jq52drha3ct6pgkn4rq.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || "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";

async function getRedirectUri() {
  const headerList = await headers();
  const host = headerList.get('host') || 'localhost:9002';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/api/auth/google/callback`;
}

export async function getGoogleAuthUrl() {
  const redirectUri = await getRedirectUri();
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
}

export async function runFullDriveBackup() {
  return driveSyncFlow({});
}

const driveSyncFlow = ai.defineFlow(
  {
    name: 'driveSyncFlow',
    inputSchema: DriveSyncInputSchema,
    outputSchema: DriveSyncOutputSchema,
  },
  async (input) => {
    const { firestore, firebaseApp } = initializeFirebase();
    const storage = getStorage(firebaseApp);
    const redirectUri = await getRedirectUri();
    const timestamp = new Date().toLocaleString('en-IN');
    
    try {
      const tokenRef = doc(firestore, 'settings', 'drive_tokens');
      const tokenSnap = await getDoc(tokenRef);
      
      if (!tokenSnap.exists()) {
        return { success: false, message: 'Google Drive not connected in Settings.' };
      }

      const tokens = tokenSnap.data();
      const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
      oauth2Client.setCredentials(tokens);

      oauth2Client.on('tokens', async (newTokens) => {
        await setDoc(tokenRef, { ...newTokens, updatedAt: new Date().toISOString() }, { merge: true });
      });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const zip = new JSZip();

      // 1. DATA AGGREGATION: Firestore
      const dbData: Record<string, any[]> = {};
      for (const colName of BACKUP_COLLECTIONS) {
        try {
          const snap = await getDocs(collection(firestore, colName));
          dbData[colName] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch (e) { console.warn(`Skipped ${colName}`); }
      }
      zip.file("database.json", JSON.stringify(dbData, null, 2));

      // 2. DATA AGGREGATION: Storage (Top-level files)
      try {
        const storageRef = ref(storage, '/');
        const listResult = await listAll(storageRef);
        for (const item of listResult.items) {
          const bytes = await getBytes(item);
          zip.file(`storage/${item.name}`, bytes);
        }
      } catch (e) { console.warn("Storage backup limited or empty."); }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });

      // 3. FOLDER MANAGEMENT
      let folderId: string | null = null;
      const folderSearch = await drive.files.list({
        q: "name = 'Firebase Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id)',
        spaces: 'drive',
      });

      if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id!;
      } else {
        const newFolder = await drive.files.create({
          requestBody: { name: 'Firebase Backups', mimeType: 'application/vnd.google-apps.folder' },
          fields: 'id',
        });
        folderId = newFolder.data.id!;
      }

      // 4. RETENTION: Delete files > 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const oldFiles = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, createdTime)',
      });

      if (oldFiles.data.files) {
        for (const file of oldFiles.data.files) {
          if (file.createdTime && new Date(file.createdTime) < thirtyDaysAgo) {
            await drive.files.delete({ fileId: file.id! });
          }
        }
      }

      // 5. UPLOAD
      const fileName = `backup-${new Date().toISOString().split('T')[0]}.zip`;
      const response = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId!] },
        media: { mimeType: 'application/zip', body: Readable.from(zipBuffer) },
        fields: 'id',
      });

      // 6. LOGGING
      const metadataRef = doc(firestore, "backupMetadata", `AUTO-${Date.now()}`);
      await setDoc(metadataRef, {
        id: metadataRef.id,
        timestamp: serverTimestamp(),
        status: "Successful",
        type: "Scheduled Drive ZIP Sync",
        fileName
      });

      return { success: true, message: `Backup uploaded as ${fileName}.`, fileId: response.data.id! };
    } catch (error: any) {
      console.error('[BACKUP ERROR]', error);
      return { success: false, message: `Backup failed: ${error.message}` };
    }
  }
);
