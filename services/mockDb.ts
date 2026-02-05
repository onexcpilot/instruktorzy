
import { User, UserRole, Invitation } from '../types';
import { ADMIN_EMAIL } from '../constants';

const DB_KEY = 'sierra_zulu_db_v2';

interface DbSchema {
  users: User[];
  invitations: Invitation[];
}

// Prosty hash dla demo (w produkcji użyć bcrypt)
export const hashPassword = (pass: string): string => {
  let hash = 0;
  for (let i = 0; i < pass.length; i++) {
    const char = pass.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hashed_' + Math.abs(hash).toString(36);
};

const initialDb: DbSchema = {
  users: [
    {
      id: 'admin_1',
      email: ADMIN_EMAIL,
      password: hashPassword('TwojeBezpieczeHaslo123!'), // ZMIEŃ TO NATYCHMIAST!
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
  if (!data) {
    saveDb(initialDb);
    return initialDb;
  }
  return JSON.parse(data);
};

export const saveDb = (db: DbSchema) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

export const findUserByEmail = (email: string) => {
  const db = getDb();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
};

export const updateUser = (updatedUser: User) => {
  const db = getDb();
  db.users = db.users.map(u => u.id === updatedUser.id ? updatedUser : u);
  saveDb(db);
};

export const createInvitation = (email: string): Invitation => {
  const db = getDb();
  const existing = db.invitations.find(i => i.email === email);
  if (existing) return existing;

  const invitation: Invitation = {
    email,
    token: Math.random().toString(36).substring(7) + Date.now().toString(36),
    invitedAt: new Date().toISOString(),
    status: 'pending'
  };
  db.invitations.push(invitation);
  saveDb(db);
  return invitation;
};

export const validatePassword = (pass: string, hash: string): boolean => {
  return hashPassword(pass) === hash;
};
