
'use server';
/**
 * @fileOverview A Genkit flow for backing up school data to Google Drive.
 * 
 * Features:
 * - ZIP compression of JSON data
 * - Folder management (creates "Firebase Backups" if missing)
 * - Auto-retention (deletes files older than 30 days)
 * - Service Account OAuth2 authentication
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { google } from 'googleapis';
import JSZip from 'jszip';
import { Readable } from 'stream';

const DriveSyncInputSchema = z.object({
  backupDataJson: z.string().describe('The full serialized database JSON.'),
  timestamp: z.string().describe('Readable timestamp for the filename.'),
});

const DriveSyncOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  fileId: z.string().optional(),
});

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
    const clientEmail = process.env.DRIVE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
      console.error('[DRIVE SYNC] Missing credentials in environment variables.');
      return {
        success: false,
        message: 'Google Drive credentials not configured. Please set DRIVE_SERVICE_ACCOUNT_EMAIL and DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY.',
      };
    }

    try {
      // 1. Authenticate
      const auth = new google.auth.JWT(
        clientEmail,
        undefined,
        privateKey,
        ['https://www.googleapis.com/auth/drive.file']
      );

      const drive = google.drive({ version: 'v3', auth });

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
      let folderId = process.env.DRIVE_FOLDER_ID;
      if (!folderId) {
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
