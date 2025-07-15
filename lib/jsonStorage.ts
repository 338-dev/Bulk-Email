// utils/jsonStorage.ts
import fs from 'fs';
import path from 'path';
import { Recipient, StatusMap, SendStatus } from '../types';

interface QueueData {
  recipients: Recipient[];
  statuses: StatusMap;
  isSendingProcessActive: boolean;
  lastUpdated: string;
}

class EmailQueueStorage {
  private dataDir: string;
  private dataFile: string;
  private lockFile: string;
  private defaultData: QueueData;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'email-queue.json');
    this.lockFile = path.join(this.dataDir, 'email-queue.lock');
    this.defaultData = {
      recipients: [],
      statuses: {},
      isSendingProcessActive: false,
      lastUpdated: new Date().toISOString()
    };
    this.initializeStorage();
  }

  private initializeStorage(): void {
    try {
      // Create data directory if it doesn't exist
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Create data file if it doesn't exist
      if (!fs.existsSync(this.dataFile)) {
        this.writeDataSync(this.defaultData);
      }

      // Clean up any stale lock files on startup
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
      }
    } catch (error) {
      console.error('Failed to initialize email queue storage:', error);
    }
  }

  private async acquireLock(timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        // Try to create lock file (fails if exists)
        fs.writeFileSync(this.lockFile, process.pid.toString(), { flag: 'wx' });
        return true;
      } catch (error) {
        // Lock file exists, wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    console.warn('Failed to acquire lock for email queue storage');
    return false;
  }

  private releaseLock(): void {
    try {
      if (fs.existsSync(this.lockFile)) {
        fs.unlinkSync(this.lockFile);
      }
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  }

  private readDataSync(): QueueData {
    try {
      if (!fs.existsSync(this.dataFile)) {
        return { ...this.defaultData };
      }

      const fileContent = fs.readFileSync(this.dataFile, 'utf8');
      const data = JSON.parse(fileContent) as QueueData;
      
      // Validate data structure
      if (!data.recipients || !data.statuses || typeof data.isSendingProcessActive !== 'boolean') {
        console.warn('Invalid data structure, resetting to defaults');
        return { ...this.defaultData };
      }

      return data;
    } catch (error) {
      console.error('Error reading email queue data:', error);
      return { ...this.defaultData };
    }
  }

  private writeDataSync(data: QueueData): boolean {
    try {
      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Error writing email queue data:', error);
      return false;
    }
  }

  // Public methods for reading data
  public getQueueState(): { recipients: Recipient[]; statuses: StatusMap; isSending: boolean } {
    const data = this.readDataSync();
    return {
      recipients: [...data.recipients],
      statuses: { ...data.statuses },
      isSending: data.isSendingProcessActive
    };
  }

  public getRecipients(): Recipient[] {
    const data = this.readDataSync();
    return [...data.recipients];
  }

  public getStatuses(): StatusMap {
    const data = this.readDataSync();
    return { ...data.statuses };
  }

  public isSendingActive(): boolean {
    const data = this.readDataSync();
    return data.isSendingProcessActive;
  }

  // Public methods for updating data
  public async addRecipients(newRecipients: Omit<Recipient, 'id'>[]): Promise<{ success: boolean; message?: string }> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      return { success: false, message: 'Could not acquire lock' };
    }

    try {
      const data = this.readDataSync();
      const existingEmails = new Set(data.recipients.map(r => r.email.toLowerCase()));
      
      const uniqueNewRecipients = newRecipients
        .filter(r => !existingEmails.has(r.email.toLowerCase()))
        .map(r => ({ ...r, id: r.email.toLowerCase() }));

      // Update recipients and statuses
      data.recipients = [...data.recipients, ...uniqueNewRecipients];
      
      for (const recipient of uniqueNewRecipients) {
        data.statuses[recipient.id] = SendStatus.PENDING;
      }

      const success = this.writeDataSync(data);
      return { success };
    } finally {
      this.releaseLock();
    }
  }

  public async updateRecipientStatus(recipientId: string, status: SendStatus): Promise<boolean> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) return false;

    try {
      const data = this.readDataSync();
      data.statuses[recipientId] = status;
      return this.writeDataSync(data);
    } finally {
      this.releaseLock();
    }
  }

  public async setSendingActive(isActive: boolean): Promise<boolean> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) return false;

    try {
      const data = this.readDataSync();
      data.isSendingProcessActive = isActive;
      return this.writeDataSync(data);
    } finally {
      this.releaseLock();
    }
  }

  public async cleanupQueue(): Promise<boolean> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) return false;

    try {
      const data = this.readDataSync();
      
      // Keep only failed recipients for retry
      const failedRecipients = data.recipients.filter(r => data.statuses[r.id] === SendStatus.FAILED);
      const remainingStatuses: StatusMap = {};
      
      failedRecipients.forEach(r => {
        // Reset failed to pending for a potential retry
        remainingStatuses[r.id] = SendStatus.PENDING;
      });

      data.recipients = failedRecipients;
      data.statuses = remainingStatuses;
      data.isSendingProcessActive = false;

      return this.writeDataSync(data);
    } finally {
      this.releaseLock();
    }
  }

  public async clearAllData(): Promise<boolean> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) return false;

    try {
      return this.writeDataSync(this.defaultData);
    } finally {
      this.releaseLock();
    }
  }

  // Backup and restore functionality
  public createBackup(): string | null {
    try {
      const data = this.readDataSync();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.dataDir, `email-queue-backup-${timestamp}.json`);
      
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
      return backupFile;
    } catch (error) {
      console.error('Failed to create backup:', error);
      return null;
    }
  }

  public getDataFilePath(): string {
    return this.dataFile;
  }
}

// Create a singleton instance
export const emailQueueStorage = new EmailQueueStorage();
export default emailQueueStorage;