
import { User, UserRole, Invitation } from '../types';
import { ADMIN_EMAIL } from '../constants';

const DB_KEY = 'sierra_zulu_db_v1';

interface DbSchema {
  users: User[];
  invitations: Invitation[];
}

const initialDb: DbSchema = {
  users: [
    {
      id: 'admin_1',
      email: ADMIN_EMAIL,
      fullName: 'Administrator Główny',
      role: UserRole.ADMIN,
      documents: [],
      isInvited: false
    }
  ],
  invitations: []
};

export const getDb = (): DbSchema => {
  const data = localStorage.getItem(DB_KEY);
  return data ? JSON.parse(data) : initialDb;
};

export const saveDb = (db: DbSchema) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

export const findUserByEmail = (email: string) => {
  const db = getDb();
  return db.users.find(u => u.email === email);
};

export const getAllInvitations = (): Invitation[] => {
  return getDb().invitations;
};

export const createInvitation = (email: string): Invitation => {
  const db = getDb();
  // Check if already invited
  const existing = db.invitations.find(i => i.email === email);
  if (existing) return existing;

  const invitation: Invitation = {
    email,
    token: Math.random().toString(36).substring(7),
    invitedAt: new Date().toISOString(),
    status: 'pending'
  };
  db.invitations.push(invitation);
  saveDb(db);
  return invitation;
};

export const acceptInvitation = (email: string) => {
  const db = getDb();
  const invitation = db.invitations.find(i => i.email === email);
  if (invitation) {
    invitation.status = 'accepted';
    saveDb(db);
  }
};
