/// <reference types="node" />

import { Recipient, StatusMap, SendStatus } from '../types';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import process from 'process';

// This file acts as our in-memory database and service layer.

let recipients: Recipient[] = [];
let statuses: StatusMap = {};
let isSendingProcessActive = false;

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


export const getQueueState = () => {
console.log(recipients);
console.log(fs.existsSync(RESUME_PATH), RESUME_PATH)
  return {
    recipients: [...recipients],
    statuses: { ...statuses },
    isSending: isSendingProcessActive,
  };
};

export const addRecipients = (newRecipients: Omit<Recipient, 'id'>[]) => {
  const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()));
  const uniqueNewRecipients = newRecipients
    .filter(r => !existingEmails.has(r.email.toLowerCase()))
    .map(r => ({ ...r, id: r.email.toLowerCase() }));

  recipients = [...recipients, ...uniqueNewRecipients];

  for (const recipient of uniqueNewRecipients) {
    statuses[recipient.id] = SendStatus.PENDING;
  }
  return { success: true };
};

export const processQueue = () => {
  if (isSendingProcessActive) {
    return { success: false, message: 'A send process is already running.' };
  }
  if (recipients.length === 0) {
      return { success: false, message: 'The queue is empty.' };
  }

  isSendingProcessActive = true;

  // This part runs in the background and does not block the API response
  (async () => {
    const recipientsToSend = [...recipients];

    for (const recipient of recipientsToSend) {
      if (statuses[recipient.id] === SendStatus.PENDING) {
        statuses[recipient.id] = SendStatus.SENDING;
        const result = await sendMailLogic(recipient);
        statuses[recipient.id] = result.success ? SendStatus.SENT : SendStatus.FAILED;
      }
    }

    // After a delay to let the UI show final statuses, clean up the queue
    setTimeout(() => {
      const failedRecipients = recipients.filter(r => statuses[r.id] === SendStatus.FAILED);
      const remainingStatuses: StatusMap = {};
      
      failedRecipients.forEach(r => {
        // Reset failed to pending for a potential retry
        remainingStatuses[r.id] = SendStatus.PENDING;
      });

      recipients = failedRecipients;
      statuses = remainingStatuses;
      isSendingProcessActive = false;
    }, 3000); // 3-second delay for the user to see the final statuses
  })();

  return { success: true, message: 'Email sending process initiated.' };
};