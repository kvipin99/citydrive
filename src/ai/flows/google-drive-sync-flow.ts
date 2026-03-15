'use server';
/**
 * @fileOverview A Genkit flow for backing up school data to Google Drive via OAuth2.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import JSZip from 'jszip';
import { Readable } from 'stream';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { headers } from 'next/headers';

const DriveSyncInputSchema = z.object({
  backupDataJson: z.string().describe('The full serialized database JSON.'),
  timestamp: z.string().describe('Readable timestamp for the filename.'),
});

const DriveSyncOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  fileId: z.string().optional(),
});

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID || "144251106401-7asi8iiqruhe8jq52drha3ct6pgkn4rq.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || "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";

/**
 * Robustly determines the Redirect URI based on the current host.
 */
async function getRedirectUri() {
  const headerList = await headers();
  const host = headerList.get('host') || 'localhost:9002';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/api/auth/google/callback`;
}

/**
 * Generates the OAuth2 Auth URL for the user to connect their account.
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
    const redirectUri = await getRedirectUri();
    
    try {
      const tokenRef = doc(firestore, 'settings', 'drive_tokens');
      const tokenSnap = await getDoc(tokenRef);
      
      if (!tokenSnap.exists()) {
        return {
          success: false,
          message: 'Google Drive not connected. Please go to Settings and click "Connect Google Account".',
        };
      }

      const tokens = tokenSnap.data();
      const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
      oauth2Client.setCredentials(tokens);

      oauth2Client.on('tokens', async (newTokens) => {
        await setDoc(tokenRef, {
          ...newTokens,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const zip = new JSZip();
      const timestampClean = input.timestamp.replace(/[/:\s]/g, '_');
      zip.file(`citydrive_backup_${timestampClean}.json`, input.backupDataJson);
      
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

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

      const fileName = `backup-${input.timestamp.split(',')[0].trim().replace(/\//g, '-')}-${Date.now()}.zip`;
      
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
