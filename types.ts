
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
  isArchived?: boolean; // Nowe pole do obsługi historii
}

export interface User {
  id: string;
  email: string;
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
