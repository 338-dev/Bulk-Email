
export interface Recipient {
  id: string; // Unique ID for key prop and status tracking
  name: string;
  email: string;
  company: string;
}

export enum SendStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export type StatusMap = Record<string, SendStatus>;
