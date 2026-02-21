'use server';
/**
 * @fileOverview This file implements a Genkit flow for sending database backups via email using Resend.
 *
 * - sendBackupEmail - A function that handles the email delivery process.
 * - BackupEmailInput - The input type for the sendBackupEmail function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Resend } from 'resend';

const BackupEmailInputSchema = z.object({
  email: z.string().email().describe('The recipient email address for the backup.'),
  backupSummary: z.string().describe('A summary of the backup contents (record counts, etc.).'),
  timestamp: z.string().describe('The time the backup was generated.'),
  backupDataJson: z.string().optional().describe('The serialized JSON data of the entire database.'),
});
export type BackupEmailInput = z.infer<typeof BackupEmailInputSchema>;

const BackupEmailOutputSchema = z.object({
  success: z.boolean().describe('Whether the email was successfully sent.'),
  message: z.string().describe('Confirmation message or error details.'),
});

export async function sendBackupEmail(input: BackupEmailInput) {
  return backupEmailFlow(input);
}

const backupEmailFlow = ai.defineFlow(
  {
    name: 'backupEmailFlow',
    inputSchema: BackupEmailInputSchema,
    outputSchema: BackupEmailOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey || apiKey === 're_123') {
      console.error('[BACKUP FLOW] RESEND_API_KEY is missing or invalid.');
      return {
        success: false,
        message: "Missing API Key: Please add RESEND_API_KEY to your .env file to enable real email delivery.",
      };
    }

    try {
      const resend = new Resend(apiKey);
      
      const { data, error } = await resend.emails.send({
        from: 'Citydrive Backup <onboarding@resend.dev>',
        to: [input.email],
        subject: `[BACKUP] Citydrive Data - ${input.timestamp}`,
        text: `${input.backupSummary}\n\nGenerated: ${input.timestamp}\n\nThis is an automated backup. Please find the database snapshot attached as a JSON file.`,
        attachments: input.backupDataJson ? [
          {
            filename: `citydrive_snapshot_${input.timestamp.replace(/[/:\s]/g, '_')}.json`,
            content: Buffer.from(input.backupDataJson).toString('base64'),
          }
        ] : [],
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log(`[BACKUP FLOW] Email sent successfully to ${input.email}. ID: ${data?.id}`);

      return {
        success: true,
        message: `Backup successfully emailed to ${input.email}.`,
      };
    } catch (err: any) {
      console.error('[BACKUP FLOW] Error sending email:', err);
      return {
        success: false,
        message: `Failed to send email: ${err.message}`,
      };
    }
  }
);