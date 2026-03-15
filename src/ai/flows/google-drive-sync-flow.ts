'use server';
/**
 * @fileOverview A Genkit flow for backing up school data to Google Drive via OAuth2.
 * 
 * Features:
 * - ZIP compression of JSON data
 * - OAuth2 token management (Refresh flow)
 * - Auto-retention (deletes files older than 30 days)
 * - Dynamic folder creation ("Firebase Backups")
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import JSZip from 'jszip';
import { Readable } from 'stream';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const DriveSyncInputSchema = z.object({
  backupDataJson: z.string().describe('The full serialized database JSON.'),
  timestamp: z.string().describe('Readable timestamp for the filename.'),
});

const DriveSyncOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  fileId: z.string().optional(),
});

// Credentials provided by the user
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || "144251106401-7asi8iiqruhe8jq52drha3ct6pgkn4rq.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || "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";
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback` : "https://studio--studio-6224335835-298c7.us-central1.hosted.app/api/auth/google/callback";

/**
 * Generates the OAuth2 Auth URL for the user to connect their account.
 */
export async function getGoogleAuthUrl() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
}

/**
 * Main flow to sync data to Google Drive.
 */
export async function syncToGoogleDrive(input: z.infer<typeof DriveSyncInputSchema>) {
  return driveSyncFlow(input);
}

const driveSyncFlow = ai.defineFlow(
  {
    name: 'driveSyncFlow',
    inputSchema: DriveSyncInputSchema,
    outputSchema: DriveSyncOutputSchema,
  },
  async (input) => {
    const { firestore } = initializeFirebase();
    
    try {
      // 1. Fetch Tokens from Firestore
      const tokenRef = doc(firestore, 'settings', 'drive_tokens');
      const tokenSnap = await getDoc(tokenRef);
      
      if (!tokenSnap.exists()) {
        return {
          success: false,
          message: 'Google Drive not connected. Please go to Settings and click "Connect Google Account".',
        };
      }

      const tokens = tokenSnap.data();
      const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      oauth2Client.setCredentials(tokens);

      // Handle token refresh automatically
      oauth2Client.on('tokens', async (newTokens) => {
        await setDoc(tokenRef, newTokens, { merge: true });
      });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // 2. ZIP the data
      const zip = new JSZip();
      const folderName = `citydrive_backup_${input.timestamp.replace(/[/:\s]/g, '_')}`;
      zip.file(`${folderName}.json`, input.backupDataJson);
      
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

      // 3. Find or Create "Firebase Backups" folder
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
          requestBody: {
            name: 'Firebase Backups',
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });
        folderId = newFolder.data.id!;
      }

      // 4. Clean up old backups (30 days retention)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const oldFiles = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, createdTime)',
      });

      if (oldFiles.data.files) {
        for (const file of oldFiles.data.files) {
          if (file.createdTime && new Date(file.createdTime) < thirtyDaysAgo) {
            console.log(`[DRIVE SYNC] Deleting expired backup: ${file.name}`);
            await drive.files.delete({ fileId: file.id! });
          }
        }
      }

      // 5. Upload new ZIP
      const fileName = `backup-${input.timestamp.split(',')[0].trim().replace(/\//g, '-')}.zip`;
      
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId!],
        },
        media: {
          mimeType: 'application/zip',
          body: Readable.from(zipBuffer),
        },
        fields: 'id',
      });

      return {
        success: true,
        message: `Backup successfully synced to Google Drive folder 'Firebase Backups' as ${fileName}.`,
        fileId: response.data.id!,
      };
    } catch (error: any) {
      console.error('[DRIVE SYNC] Error:', error);
      return {
        success: false,
        message: `Sync failed: ${error.message || 'Unknown API error'}`,
      };
    }
  }
);
