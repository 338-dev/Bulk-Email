// utils/sequelizeStorage.ts
import { Op, Transaction } from 'sequelize';
import { sequelize } from './db';
import { Recipient, QueueState, initializeQueueState } from './model';
import { Recipient as RecipientType, StatusMap, SendStatus } from '../types';

class EmailQueueStorage {
  private initialized: boolean = false;

  constructor() {
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      // Ensure database connection and models are ready
      await sequelize.authenticate();
      await sequelize.sync();
      await initializeQueueState();
      this.initialized = true;
      console.log('Sequelize email queue storage initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize Sequelize email queue storage:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initializeStorage();
    }
  }

  // Public methods for reading data
  public async getQueueState(): Promise<{ recipients: RecipientType[]; statuses: StatusMap; isSending: boolean }> {
    await this.ensureInitialized();
    
    try {
      const [recipients, queueState]:[any,any] = await Promise.all([
        Recipient.findAll({
          order: [['createdAt', 'ASC']],
        }),
        QueueState.findByPk(1),
      ]);

      const recipientList: RecipientType[] = recipients.map((r: any) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        company: r.company,
      }));

      const statuses: StatusMap = {};
      recipients.forEach((r:any) => {
        statuses[r.id] = r.status;
      });

      return {
        recipients: recipientList,
        statuses,
        isSending: queueState?.isSendingProcessActive || false,
      };
    } catch (error) {
      console.error('Error getting queue state:', error);
      return { recipients: [], statuses: {}, isSending: false };
    }
  }

  public async getRecipients(): Promise<RecipientType[]> {
    await this.ensureInitialized();
    
    try {
      const recipients = await Recipient.findAll({
        order: [['createdAt', 'ASC']],
      });

      return recipients.map((r:any) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        company: r.company,
      }));
    } catch (error) {
      console.error('Error getting recipients:', error);
      return [];
    }
  }

  public async getStatuses(): Promise<StatusMap> {
    await this.ensureInitialized();
    
    try {
      const recipients = await Recipient.findAll({
        attributes: ['id', 'status'],
      });

      const statuses: StatusMap = {};
      recipients.forEach((r:any) => {
        statuses[r.id] = r.status;
      });

      return statuses;
    } catch (error) {
      console.error('Error getting statuses:', error);
      return {};
    }
  }

  public async isSendingActive(): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const queueState: any = await QueueState.findByPk(1);
      return queueState?.isSendingProcessActive || false;
    } catch (error) {
      console.error('Error checking sending status:', error);
      return false;
    }
  }

  // Public methods for updating data
  public async addRecipients(newRecipients: Omit<RecipientType, 'id'>[]): Promise<{ success: boolean; message?: string }> {
    await this.ensureInitialized();
    
    const transaction: Transaction = await sequelize.transaction();
    
    try {
      // Check for existing emails
      const existingEmails = await Recipient.findAll({
        where: {
          email: {
            [Op.in]: newRecipients.map(r => r.email.toLowerCase()),
          },
        },
        attributes: ['email'],
        transaction,
      });

      const existingEmailSet = new Set(existingEmails.map((r:any) => r.email.toLowerCase()));
      
      const uniqueNewRecipients = newRecipients
        .filter(r => !existingEmailSet.has(r.email.toLowerCase()))
        .map(r => ({
          id: r.email.toLowerCase(),
          email: r.email,
          name: r.name,
          company: r.company,
          status: SendStatus.PENDING,
        }));

      if (uniqueNewRecipients.length === 0) {
        await transaction.rollback();
        return { success: true, message: 'No new recipients to add (all already exist)' };
      }

      await Recipient.bulkCreate(uniqueNewRecipients, { transaction });
      
      // Update queue state last updated time
      await QueueState.update(
        { lastUpdated: new Date() },
        { where: { id: 1 }, transaction }
      );

      await transaction.commit();
      return { success: true, message: `Added ${uniqueNewRecipients.length} new recipients` };
    } catch (error) {
      await transaction.rollback();
      console.error('Error adding recipients:', error);
      return { success: false, message: 'Failed to add recipients' };
    }
  }

  public async updateRecipientStatus(recipientId: string, status: SendStatus): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const [updatedCount] = await Recipient.update(
        { status },
        { where: { id: recipientId } }
      );

      if (updatedCount > 0) {
        // Update queue state last updated time
        await QueueState.update(
          { lastUpdated: new Date() },
          { where: { id: 1 } }
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating recipient status:', error);
      return false;
    }
  }

  public async setSendingActive(isActive: boolean): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const [updatedCount] = await QueueState.update(
        { 
          isSendingProcessActive: isActive,
          lastUpdated: new Date()
        },
        { where: { id: 1 } }
      );

      return updatedCount > 0;
    } catch (error) {
      console.error('Error setting sending active status:', error);
      return false;
    }
  }

  public async cleanupQueue(): Promise<boolean> {
    await this.ensureInitialized();
    
    const transaction: Transaction = await sequelize.transaction();
    
    try {
      // Reset failed recipients to pending for retry, remove sent ones
      await Recipient.update(
        { status: SendStatus.PENDING },
        { 
          where: { status: SendStatus.FAILED },
          transaction 
        }
      );

      // Remove sent recipients
      await Recipient.destroy({
        where: { status: SendStatus.SENT },
        transaction,
      });

      // Update queue state
      await QueueState.update(
        { 
          isSendingProcessActive: false,
          lastUpdated: new Date()
        },
        { where: { id: 1 }, transaction }
      );

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      console.error('Error cleaning up queue:', error);
      return false;
    }
  }

  public async clearAllData(): Promise<boolean> {
    await this.ensureInitialized();
    
    const transaction: Transaction = await sequelize.transaction();
    
    try {
      await Recipient.destroy({
        where: {},
        transaction,
      });

      await QueueState.update(
        { 
          isSendingProcessActive: false,
          lastUpdated: new Date()
        },
        { where: { id: 1 }, transaction }
      );

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      console.error('Error clearing all data:', error);
      return false;
    }
  }

  // Backup functionality
  public async createBackup(): Promise<string | null> {
    await this.ensureInitialized();
    
    try {
      const queueState = await this.getQueueState();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = {
        ...queueState,
        backupTimestamp: timestamp,
      };

      // You could save this to a file or another database table
      // For now, we'll just return a JSON string representation
      const backupString = JSON.stringify(backupData, null, 2);
      console.log('Backup created at:', timestamp);
      
      return backupString;
    } catch (error) {
      console.error('Failed to create backup:', error);
      return null;
    }
  }

  public getDataFilePath(): string {
    return 'MySQL Database - No file path';
  }

  // Additional utility methods
  public async getQueueStats(): Promise<{
    total: number;
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    isSending: boolean;
  }> {
    await this.ensureInitialized();
    
    try {
      const [statusCounts, queueState]: [any,any] = await Promise.all([
        Recipient.findAll({
          attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          ],
          group: ['status'],
          raw: true,
        }),
        QueueState.findByPk(1),
      ]);

      const stats = {
        total: 0,
        pending: 0,
        sending: 0,
        sent: 0,
        failed: 0,
        isSending: queueState?.isSendingProcessActive || false,
      };

      statusCounts.forEach((row: any) => {
        const count = parseInt(row.count);
        stats.total += count;
        
        switch (row.status) {
          case SendStatus.PENDING:
            stats.pending = count;
            break;
          case SendStatus.SENDING:
            stats.sending = count;
            break;
          case SendStatus.SENT:
            stats.sent = count;
            break;
          case SendStatus.FAILED:
            stats.failed = count;
            break;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return {
        total: 0,
        pending: 0,
        sending: 0,
        sent: 0,
        failed: 0,
        isSending: false,
      };
    }
  }

  public async retryFailedEmails(): Promise<{ success: boolean; message: string; updatedCount: number }> {
    await this.ensureInitialized();
    
    try {
      const [updatedCount] = await Recipient.update(
        { status: SendStatus.PENDING },
        { where: { status: SendStatus.FAILED } }
      );

      if (updatedCount > 0) {
        await QueueState.update(
          { lastUpdated: new Date() },
          { where: { id: 1 } }
        );
      }

      return {
        success: updatedCount > 0,
        message: `Reset ${updatedCount} failed emails to pending status`,
        updatedCount: Number(updatedCount),
      };
    } catch (error) {
      console.error('Error retrying failed emails:', error);
      return {
        success: false,
        message: 'Failed to retry failed emails',
        updatedCount: 0,
      };
    }
  }
}

// Create a singleton instance
export const emailQueueStorage = new EmailQueueStorage();
export default emailQueueStorage;