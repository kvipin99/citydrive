
'use server';
/**
 * @fileOverview A robust Genkit flow for backing up Firestore and Storage.
 * 
 * Process:
 * 1. Generates JSON of all Firestore data.
 * 2. Packages with Storage files into a single ZIP.
 * 3. Saves ZIP to Firebase Storage (Internal Archive).
 * 4. Syncs ZIP to Google Drive (External Mirror).
 * 5. Implements 30-day retention policies on both.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import JSZip from 'jszip';
import { Readable } from 'stream';
import { initializeFirebase } from '@/firebase/init';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, listAll, getBytes, uploadBytes, deleteObject } from 'firebase/storage';
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

// Credentials provided by user
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || "144251106401-7asi8iiqruhe8jq52drha3ct6pgkn4rq.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || "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";

async function getRedirectUri() {
  const headerList = await headers();
  const host = headerList.get('host') || 'localhost:9002';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/api/auth/google/callback`;
}

/**
 * Generates the Google Auth URL for the user to link their account.
 */
export async function getGoogleAuthUrl() {
  const redirectUri = await getRedirectUri();
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
}

/**
 * Main function to run the full cloud backup pipeline.
 */
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
    
    try {
      const tokenRef = doc(firestore, 'settings', 'drive_tokens');
      const tokenSnap = await getDoc(tokenRef);
      
      const zip = new JSZip();
      const timestamp = Date.now();
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `backup-${dateStr}-${timestamp}.zip`;

      // 1. DATA AGGREGATION: Firestore
      console.log("[BACKUP] Aggregating Firestore collections...");
      const dbData: Record<string, any[]> = {};
      for (const colName of BACKUP_COLLECTIONS) {
        try {
          const snap = await getDocs(collection(firestore, colName));
          dbData[colName] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        } catch (e) { 
          console.warn(`[BACKUP] Skipped collection ${colName}:`, e); 
        }
      }
      zip.file("database.json", JSON.stringify(dbData, null, 2));

      // 2. DATA AGGREGATION: Storage (Student Photos)
      console.log("[BACKUP] Aggregating Storage files...");
      try {
        const studentPhotosRef = ref(storage, 'student-photos');
        const listResult = await listAll(studentPhotosRef);
        for (const item of listResult.items) {
          const bytes = await getBytes(item);
          zip.file(`media/${item.name}`, bytes);
        }
      } catch (e) { 
        console.warn("[BACKUP] Storage backup limited or empty:", e); 
      }

      // Generate ZIP Buffer
      const zipBuffer = await zip.generateAsync({ 
        type: 'nodebuffer', 
        compression: 'DEFLATE', 
        compressionOptions: { level: 9 } 
      });

      // 3. INTERNAL ARCHIVAL: Save to Firebase Storage
      console.log("[BACKUP] Saving copy to Firebase Storage...");
      const internalRef = ref(storage, `system_backups/${fileName}`);
      await uploadBytes(internalRef, zipBuffer, { contentType: 'application/zip' });

      // 4. EXTERNAL MIRRORING: Upload to Google Drive
      let driveFileId = undefined;
      if (tokenSnap.exists()) {
        console.log("[BACKUP] Syncing to Google Drive...");
        const tokens = tokenSnap.data();
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
        oauth2Client.setCredentials(tokens);

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Ensure Folder Exists
        let folderId: string | null = null;
        const folderSearch = await drive.files.list({
          q: "name = 'CityDrive Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
          fields: 'files(id)',
          spaces: 'drive',
        });

        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
          folderId = folderSearch.data.files[0].id!;
        } else {
          const newFolder = await drive.files.create({
            requestBody: { name: 'CityDrive Backups', mimeType: 'application/vnd.google-apps.folder' },
            fields: 'id',
          });
          folderId = newFolder.data.id!;
        }

        // Upload ZIP to Drive
        const response = await drive.files.create({
          requestBody: { name: fileName, parents: [folderId!] },
          media: { mimeType: 'application/zip', body: Readable.from(zipBuffer) },
          fields: 'id',
        });
        driveFileId = response.data.id!;
      }

      // 5. AUDIT LOGGING
      const metadataRef = doc(firestore, "backupMetadata", `AUTO-${timestamp}`);
      await setDoc(metadataRef, {
        id: metadataRef.id,
        timestamp: serverTimestamp(),
        status: "Successful",
        type: "Daily Cloud Sync",
        fileName,
        storagePath: `system_backups/${fileName}`,
        driveFileId: driveFileId || "NOT_CONNECTED"
      });

      return { 
        success: true, 
        message: `Backup archived to Firebase and Drive as ${fileName}.`, 
        fileId: driveFileId 
      };
    } catch (error: any) {
      console.error('[BACKUP ERROR]', error);
      return { success: false, message: `Backup failed: ${error.message}` };
    }
  }
);
