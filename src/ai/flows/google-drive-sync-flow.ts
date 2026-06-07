'use server';
/**
 * @fileOverview A robust Genkit flow for backing up Firestore and Storage.
 * 
 * Process:
 * 1. Generates JSON of all Firestore data.
 * 2. Packages with Storage files into a single ZIP for internal recovery.
 * 3. Saves ZIP to Firebase Storage (Internal Archive).
 * 4. Syncs the raw JSON database snapshot to Google Drive (External Mirror) 
 *    in the "CityDrive Backups" folder.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import JSZip from 'jszip';
import { Readable } from 'stream';
import { initializeFirebase } from '@/firebase/init';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, listAll, getBytes, uploadBytes } from 'firebase/storage';
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
      const zipFileName = `full-archive-${dateStr}-${timestamp}.zip`;
      const driveFileName = `citydrive_backup_${dateStr}.json`;

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
      const jsonDatabaseString = JSON.stringify(dbData, null, 2);
      zip.file("database.json", jsonDatabaseString);

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

      // Generate ZIP Buffer for internal archival
      const zipBuffer = await zip.generateAsync({ 
        type: 'nodebuffer', 
        compression: 'DEFLATE', 
        compressionOptions: { level: 9 } 
      });

      // 3. INTERNAL ARCHIVAL: Save Full ZIP to Firebase Storage
      console.log("[BACKUP] Saving recovery ZIP to Firebase Storage...");
      const internalRef = ref(storage, `system_backups/${zipFileName}`);
      await uploadBytes(internalRef, zipBuffer, { contentType: 'application/zip' });

      // 4. EXTERNAL MIRRORING: Upload JSON Snapshot to Google Drive
      let driveFileId = undefined;
      if (tokenSnap.exists()) {
        console.log("[BACKUP] Mirroring JSON snapshot to Google Drive...");
        const tokens = tokenSnap.data();
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
        oauth2Client.setCredentials(tokens);

        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Ensure "CityDrive Backups" Folder Exists
        let folderId: string | null = null;
        const folderSearch = await drive.files.list({
          q: "name = 'CityDrive Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
          fields: 'files(id)',
          spaces: 'drive',
        });

        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
          folderId = folderSearch.data.files[0].id!;
        } else {
          console.log("[BACKUP] Creating 'CityDrive Backups' folder on Drive...");
          const newFolder = await drive.files.create({
            requestBody: { name: 'CityDrive Backups', mimeType: 'application/vnd.google-apps.folder' },
            fields: 'id',
          });
          folderId = newFolder.data.id!;
        }

        // Upload JSON Snapshot to Drive
        const response = await drive.files.create({
          requestBody: { name: driveFileName, parents: [folderId!] },
          media: { mimeType: 'application/json', body: Readable.from(jsonDatabaseString) },
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
        fileName: driveFileName,
        storagePath: `system_backups/${zipFileName}`,
        driveFileId: driveFileId || "NOT_CONNECTED"
      });

      return { 
        success: true, 
        message: `Snapshot mirrored to Google Drive as ${driveFileName}. Full recovery ZIP archived internally.`, 
        fileId: driveFileId 
      };
    } catch (error: any) {
      console.error('[BACKUP ERROR]', error);
      return { success: false, message: `Backup pipeline failed: ${error.message}` };
    }
  }
);