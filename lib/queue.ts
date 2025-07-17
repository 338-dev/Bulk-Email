/// <reference types="node" />

import { Recipient, StatusMap, SendStatus } from '../types';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { emailQueueStorage } from './jsonStorage';

// This file acts as our persistent database and service layer using JSON files.

// --- Nodemailer Setup ---
// Credentials and paths are loaded from environment variables for security.
// IMPORTANT: Ensure you have a .env.local file with GMAIL_USER, GMAIL_PASS, and RESUME_PATH.
const { GMAIL_USER, GMAIL_PASS, RESUME_PATH = '' } = process.env;

let transporter: nodemailer.Transporter;

if (!GMAIL_USER || !GMAIL_PASS) {
  console.error("----------------------------------------------------------------");
  console.error("FATAL: GMAIL_USER or GMAIL_PASS is not set in environment variables.");
  console.error("Please create a .env.local file and add your Gmail credentials.");
  console.error("Email functionality will be disabled.");
  console.error("----------------------------------------------------------------");
} else {
  // The transporter is configured once and reused.
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS, // For Gmail, this should be an "App Password"
    },
    pool: true, // Use a connection pool for sending multiple emails
    maxConnections: 5,
    rateLimit: 5, // Send at most 5 messages per second
  });

  // Verify the transporter configuration on startup
  transporter.verify((error) => {
    if (error) {
      console.error('Nodemailer transporter verification failed:', error);
      console.warn('Emails may fail to send. Please check your GMAIL_USER and GMAIL_PASS in .env.local');
    } else {
      console.log('Nodemailer transporter is ready to send emails.');
    }
  });
}

/**
 * Uses nodemailer to send a real email based on the user's template and logic.
 */
const sendMailLogic = async (recipient: Recipient): Promise<{ success: boolean }> => {
  if (!transporter) {
    console.error(`Skipping email to ${recipient.email}: Nodemailer is not configured due to missing credentials.`);
    return { success: false };
  }
  try {
    const templatePath = path.resolve(process.cwd(), 'emailTemplate.html');
    if (!fs.existsSync(templatePath)) {
      console.error(`FATAL: Email template not found at path: ${templatePath}`);
      return { success: false };
    }
    const template = fs.readFileSync(templatePath, 'utf8');

    let personalizedContent = template.replace(/{{name}}/g, recipient.name);
    personalizedContent = personalizedContent.replace(/{{company}}/g, recipient.company);

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"Sahdev Rai" <${GMAIL_USER}>`,
      to: recipient.email,
      subject: `Application for Software Developer Position - Sahdev Rai`,
      html: personalizedContent,
    };

    const currentResumePath = path.resolve(process.cwd(), RESUME_PATH);

    if (RESUME_PATH && fs.existsSync(currentResumePath)) {
      mailOptions.attachments = [{
        filename: 'Sahdev_Rai_Resume.pdf',
        path: currentResumePath,
      }];
    } else if (currentResumePath) {
      console.warn(`Resume file not found at path specified in RESUME_PATH: ${currentResumePath}`);
    }

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${recipient.name} (${recipient.email})`);
    
    // Add a small delay between emails as requested
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return { success: true };

  } catch (error) {
    console.error(`Failed to send email to ${recipient.name} (${recipient.email}):`, error);
    return { success: false };
  }
};

/**
 * Get the current state of the email queue from JSON storage
 */
export const getQueueState = async () => {
  const state = await emailQueueStorage.getQueueState();
  console.log('Current recipients:', state.recipients);
  console.log('Resume file exists:', fs.existsSync(RESUME_PATH), 'Path:', RESUME_PATH);
  return state;
};

/**
 * Add new recipients to the queue via JSON storage
 */
export const addRecipients = async (newRecipients: Omit<Recipient, 'id'>[]) => {
  return await emailQueueStorage.addRecipients(newRecipients);
};

/**
 * Process the email queue using JSON storage for persistence
 */
export const processQueue = async () => {
  const isSending = await emailQueueStorage.isSendingActive();
  const recipients = await emailQueueStorage.getRecipients();

  if (isSending) {
    return { success: false, message: 'A send process is already running.' };
  }
  
  if (recipients.length === 0) {
    return { success: false, message: 'The queue is empty.' };
  }

  // Set sending flag to true
  const lockSuccess = await emailQueueStorage.setSendingActive(true);
  if (!lockSuccess) {
    return { success: false, message: 'Could not acquire processing lock.' };
  }

  // This part runs in the background and does not block the API response
  (async () => {
    try {
      const recipientsToSend = await emailQueueStorage.getRecipients();

      for (const recipient of recipientsToSend) {
        const currentStatuses = await emailQueueStorage.getStatuses();
        
        if (currentStatuses[recipient.id] === SendStatus.PENDING) {
          // Update status to SENDING
          await emailQueueStorage.updateRecipientStatus(recipient.id, SendStatus.SENDING);
          
          // Attempt to send email
          const result = await sendMailLogic(recipient);
          
          // Update final status
          const finalStatus = result.success ? SendStatus.SENT : SendStatus.FAILED;
          await emailQueueStorage.updateRecipientStatus(recipient.id, finalStatus);
        }
      }

      // After a delay to let the UI show final statuses, clean up the queue
      setTimeout(async () => {
        await emailQueueStorage.cleanupQueue();
        console.log('Email queue processing completed and cleaned up.');
      }, 3000); // 3-second delay for the user to see the final statuses
      
    } catch (error) {
      console.error('Error during email processing:', error);
      await emailQueueStorage.setSendingActive(false);
    }
  })();

  return { success: true, message: 'Email sending process initiated.' };
};

// Additional utility functions for better queue management

/**
 * Clear all data from the queue
 */
export const clearQueue = async () => {
  const success = await emailQueueStorage.clearAllData();
  return { success, message: success ? 'Queue cleared successfully' : 'Failed to clear queue' };
};

/**
 * Get queue statistics
 */
export const getQueueStats = async () => {
  const state = await emailQueueStorage.getQueueState();
  const statuses = state.statuses;
  
  const stats = {
    total: state.recipients.length,
    pending: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    isSending: state.isSending
  };

  Object.values(statuses).forEach(status => {
    switch (status) {
      case SendStatus.PENDING:
        stats.pending++;
        break;
      case SendStatus.SENDING:
        stats.sending++;
        break;
      case SendStatus.SENT:
        stats.sent++;
        break;
      case SendStatus.FAILED:
        stats.failed++;
        break;
    }
  });

  return stats;
};

/**
 * Create a backup of the current queue state
 */
export const createQueueBackup = async () => {
  const backupPath = await emailQueueStorage.createBackup();
  return { 
    success: !!backupPath, 
    backupPath,
    message: backupPath ? 'Backup created successfully' : 'Failed to create backup'
  };
};

/**
 * Reset failed emails to pending status for retry
 */
export const retryFailedEmails = async () => {
  const state = await emailQueueStorage.getQueueState();
  const failedRecipients = state.recipients.filter(r => state.statuses[r.id] === SendStatus.FAILED);
  
  let updatedCount = 0;
  for (const recipient of failedRecipients) {
    const success = await emailQueueStorage.updateRecipientStatus(recipient.id, SendStatus.PENDING);
    if (success) updatedCount++;
  }

  return {
    success: updatedCount > 0,
    message: `Reset ${updatedCount} failed emails to pending status`,
    updatedCount
  };
};

/**
 * Get the path to the data file (useful for debugging)
 */
export const getDataFilePath = () => {
  return emailQueueStorage.getDataFilePath();
};