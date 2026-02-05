
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
      password: 'sierra', // Hasło startowe dla administratora
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
    token: Math.random().toString(36).substring(7),
    invitedAt: new Date().toISOString(),
    status: 'pending'
  };
  db.invitations.push(invitation);
  saveDb(db);
  return invitation;
};
