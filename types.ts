
export enum UserRole {
  ADMIN = 'ADMIN',
  INSTRUCTOR = 'INSTRUCTOR'
}

export interface DocumentAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: 'medical' | 'license' | 'logbook' | 'id' | 'radio' | 'contract';
  expiryDate?: string;
  issueDate?: string;
  attachments: DocumentAttachment[];
  uploadDate: string;
  status: 'valid' | 'expired' | 'pending_review';
  isArchived?: boolean;
}

export interface User {
  id: string;
  email: string;
  password?: string; // Nowe pole na hasło (min 6 znaków)
  fullName: string;
  role: UserRole;
  licenseNumber?: string;
  documents: DocumentRecord[];
  isInvited: boolean;
  lastLogin?: string;
}

export interface Invitation {
  email: string;
  token: string;
  invitedAt: string;
  status: 'pending' | 'accepted';
}

export type NotificationLevel = 'info' | 'warning' | 'critical' | 'expired';

export interface ExpiryAlert {
  instructorId: string;
  instructorName: string;
  instructorEmail: string;
  documentId: string;
  documentName: string;
  documentType: DocumentRecord['type'];
  expiryDate: string;
  daysRemaining: number;
  level: NotificationLevel;
}

export interface NotificationRecord {
  id: string;
  alertLevel: NotificationLevel;
  instructorEmail: string;
  instructorName: string;
  documentType: DocumentRecord['type'];
  documentName: string;
  expiryDate: string;
  daysRemaining: number;
  sentAt: string;
  emailSent: boolean;
  error?: string;
}

export interface NotificationLog {
  lastCheckDate: string;
  notifications: NotificationRecord[];
}
