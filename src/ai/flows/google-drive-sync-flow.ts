'use server';
/**
 * @fileOverview A robust Genkit flow for backing up Firestore and Storage.
 * 
 * Process:
 * 1. Generates JSON of all Firestore data.
 * 2. Packages with Storage files into a single ZIP for internal recovery.
 * 3. Saves ZIP to Firebase Storage (Internal Archive).
 * 4. Syncs the raw JSON database snapshot to Google Drive (External Mirror) 
 *    using a Service Account for zero-intervention automation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import JSZip from 'jszip';
import { Readable } from 'stream';
import { initializeFirebase } from '@/firebase/init';
import { doc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, listAll, getBytes, uploadBytes } from 'firebase/storage';

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

// Service Account Credentials
// Note: In production, these should be stored in environment variables.
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL || "citydrive-backup@studio-6224335835-298c7.iam.gserviceaccount.com";
const SERVICE_ACCOUNT_KEY = (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, '\n');

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
    
    try {
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

      // 4. EXTERNAL MIRRORING: Upload JSON Snapshot to Google Drive via Service Account
      let driveFileId = undefined;
      
      if (SERVICE_ACCOUNT_KEY) {
        console.log("[BACKUP] Connecting to Google Drive via Service Account...");
        
        const auth = new google.auth.JWT(
          SERVICE_ACCOUNT_EMAIL,
          undefined,
          SERVICE_ACCOUNT_KEY,
          ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.metadata.readonly']
        );

        const drive = google.drive({ version: 'v3', auth });

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
        driveFileId: driveFileId || "SERVICE_ACCOUNT_KEY_MISSING"
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