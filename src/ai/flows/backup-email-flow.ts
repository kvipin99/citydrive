'use server';
/**
 * @fileOverview This file implements a Genkit flow for simulating the delivery of a database backup via email.
 *
 * - sendBackupEmail - A function that "sends" the backup data to a specified email.
 * - BackupEmailInput - The input type for the sendBackupEmail function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const BackupEmailInputSchema = z.object({
  email: z.string().email().describe('The recipient email address for the backup.'),
  backupSummary: z.string().describe('A summary of the backup contents (record counts, etc.).'),
  timestamp: z.string().describe('The time the backup was generated.'),
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
    // In a production app, you would integrate with an email provider like SendGrid or Resend here.
    // For this prototype, we use the AI to generate a confirmation of the "sent" email.
    
    const response = await ai.generate({
      prompt: `Simulate sending a system backup email to ${input.email}. 
      The backup was generated at ${input.timestamp}.
      Summary of data: ${input.backupSummary}.
      Confirm that the data has been securely archived and "sent".`,
    });

    console.log(`[BACKUP AUTOMATION] Email "sent" to ${input.email} at ${new Date().toISOString()}`);

    return {
      success: true,
      message: response.text || "Backup email successfully processed and sent.",
    };
  }
);
