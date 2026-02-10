import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// =============================================
// Polaczenie z MySQL na domenomanii
// =============================================

let pool = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'dm75078_sierrazulu',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'dm75078_instruktor',
      port: parseInt(process.env.DB_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

// =============================================
// Hasla (bcrypt)
// =============================================

export async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, 12);
}

export async function validatePassword(plaintext, hash) {
  // Obsluga starych haszy z mockDb (prefix hashed_)
  if (hash && hash.startsWith('hashed_')) {
    return false; // Stary hash - wymus reset hasla
  }
  return bcrypt.compare(plaintext, hash);
}

// =============================================
// Users
// =============================================

export async function findUserByEmail(email) {
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
    [email]
  );
  if (rows.length === 0) return null;
  const user = rows[0];
  // Dolacz dokumenty
  user.documents = await getUserDocuments(user.id);
  return mapUserRow(user);
}

export async function findUserById(id) {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const user = rows[0];
  user.documents = await getUserDocuments(user.id);
  return mapUserRow(user);
}

export async function getAllInstructors() {
  const db = getPool();
  const [rows] = await db.execute(
    "SELECT * FROM users WHERE role = 'INSTRUCTOR' ORDER BY full_name"
  );
  // Dolacz dokumenty do kazdego instruktora
  for (const row of rows) {
    row.documents = await getUserDocuments(row.id);
  }
  return rows.map(mapUserRow);
}

export async function getAllUsers() {
  const db = getPool();
  const [rows] = await db.execute('SELECT * FROM users ORDER BY role, full_name');
  for (const row of rows) {
    row.documents = await getUserDocuments(row.id);
  }
  return rows.map(mapUserRow);
}

export async function createUser({ email, password, fullName, role, isInvited }) {
  const db = getPool();
  const id = uuidv4();
  const hashedPass = await hashPassword(password);
  await db.execute(
    'INSERT INTO users (id, email, password, full_name, role, is_invited) VALUES (?, ?, ?, ?, ?, ?)',
    [id, email, hashedPass, fullName, role || 'INSTRUCTOR', isInvited ? 1 : 0]
  );
  return findUserById(id);
}

export async function updateUserPassword(userId, newPassword) {
  const db = getPool();
  const hashedPass = await hashPassword(newPassword);
  await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPass, userId]);
}

export async function updateUserLastLogin(userId) {
  const db = getPool();
  await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
}

export async function updateUserProfile(userId, { fullName, licenseNumber }) {
  const db = getPool();
  const fields = [];
  const values = [];
  if (fullName !== undefined) { fields.push('full_name = ?'); values.push(fullName); }
  if (licenseNumber !== undefined) { fields.push('license_number = ?'); values.push(licenseNumber); }
  if (fields.length === 0) return;
  values.push(userId);
  await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

// =============================================
// Documents
// =============================================

export async function getUserDocuments(userId) {
  const db = getPool();
  const [docs] = await db.execute(
    'SELECT * FROM documents WHERE user_id = ? ORDER BY upload_date DESC',
    [userId]
  );
  // Dolacz zalaczniki do kazdego dokumentu
  for (const doc of docs) {
    const [attachments] = await db.execute(
      'SELECT * FROM document_attachments WHERE document_id = ?',
      [doc.id]
    );
    doc.attachments = attachments.map(a => ({
      id: a.id,
      fileName: a.file_name,
      fileSize: a.file_size,
      fileUrl: a.file_url,
    }));
  }
  return docs.map(mapDocRow);
}

export async function addDocument(userId, { name, type, expiryDate, issueDate, status, attachments }) {
  const db = getPool();
  const docId = uuidv4();

  // Archiwizuj stare dokumenty tego samego typu
  await db.execute(
    'UPDATE documents SET is_archived = 1 WHERE user_id = ? AND type = ? AND is_archived = 0',
    [userId, type]
  );

  await db.execute(
    'INSERT INTO documents (id, user_id, name, type, expiry_date, issue_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [docId, userId, name, type, expiryDate || null, issueDate || null, status || 'pending_review']
  );

  // Dodaj zalaczniki
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      const attId = uuidv4();
      await db.execute(
        'INSERT INTO document_attachments (id, document_id, file_name, file_size, file_url, mime_type) VALUES (?, ?, ?, ?, ?, ?)',
        [attId, docId, att.fileName, att.fileSize || 0, att.fileUrl, att.mimeType || null]
      );
    }
  }

  return docId;
}

export async function updateDocumentStatus(docId, status) {
  const db = getPool();
  await db.execute('UPDATE documents SET status = ? WHERE id = ?', [status, docId]);
}

// =============================================
// Invitations
// =============================================

export async function createInvitation(email) {
  const db = getPool();
  // Sprawdz czy juz istnieje
  const [existing] = await db.execute('SELECT * FROM invitations WHERE email = ? AND status = ?', [email, 'pending']);
  if (existing.length > 0) return mapInvitationRow(existing[0]);

  const token = uuidv4().replace(/-/g, '') + Date.now().toString(36);
  await db.execute(
    'INSERT INTO invitations (email, token) VALUES (?, ?)',
    [email, token]
  );
  const [rows] = await db.execute('SELECT * FROM invitations WHERE token = ?', [token]);
  return mapInvitationRow(rows[0]);
}

export async function acceptInvitation(token) {
  const db = getPool();
  await db.execute("UPDATE invitations SET status = 'accepted' WHERE token = ?", [token]);
}

// =============================================
// Notification Log
// =============================================

export async function addNotificationLog({ alertLevel, instructorEmail, instructorName, documentType, documentName, expiryDate, daysRemaining, emailSent, error }) {
  const db = getPool();
  const id = uuidv4();
  await db.execute(
    `INSERT INTO notification_log (id, alert_level, instructor_email, instructor_name, document_type, document_name, expiry_date, days_remaining, email_sent, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, alertLevel, instructorEmail, instructorName, documentType, documentName, expiryDate, daysRemaining, emailSent ? 1 : 0, error || null]
  );
  return id;
}

export async function wasNotificationSentToday(instructorEmail, documentType, alertLevel) {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT COUNT(*) as cnt FROM notification_log 
     WHERE instructor_email = ? AND document_type = ? AND alert_level = ? 
     AND DATE(sent_at) = CURDATE() AND email_sent = 1`,
    [instructorEmail, documentType, alertLevel]
  );
  return rows[0].cnt > 0;
}

export async function getRecentNotifications(limit = 100) {
  const db = getPool();
  const [rows] = await db.execute(
    'SELECT * FROM notification_log ORDER BY sent_at DESC LIMIT ?',
    [limit]
  );
  return rows;
}

// =============================================
// Expiry scanning (DB-side)
// =============================================

export async function getExpiringDocuments(withinDays = 90) {
  const db = getPool();
  const [rows] = await db.execute(
    `SELECT d.*, u.email as instructor_email, u.full_name as instructor_name, u.id as instructor_id
     FROM documents d
     JOIN users u ON d.user_id = u.id
     WHERE u.role = 'INSTRUCTOR'
       AND d.is_archived = 0
       AND d.expiry_date IS NOT NULL
       AND d.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND d.type IN ('medical', 'license', 'radio', 'id')
     ORDER BY d.expiry_date ASC`,
    [withinDays]
  );
  return rows;
}

// =============================================
// Init: ustaw haslo admina jesli placeholder
// =============================================

export async function ensureAdminAccount() {
  const db = getPool();
  const [rows] = await db.execute(
    "SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1"
  );
  if (rows.length === 0) {
    // Brak admina - stworz
    const hashedPass = await hashPassword('TwojeBezpieczeHaslo123!');
    await db.execute(
      "INSERT INTO users (id, email, password, full_name, role, is_invited) VALUES (?, ?, ?, ?, 'ADMIN', 0)",
      ['admin_1', 'kontakt@sierrazulu.waw.pl', hashedPass, 'Administrator']
    );
    console.log('Admin account created with default password - CHANGE IT!');
  } else if (rows[0].password.includes('PLACEHOLDER')) {
    // Placeholder - ustaw prawdziwy hash
    const hashedPass = await hashPassword('TwojeBezpieczeHaslo123!');
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPass, rows[0].id]);
    console.log('Admin password hash set (bcrypt)');
  }
}

// =============================================
// Mapery row -> obiekt frontend
// =============================================

function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    fullName: row.full_name,
    role: row.role,
    licenseNumber: row.license_number || undefined,
    documents: row.documents || [],
    isInvited: !!row.is_invited,
    lastLogin: row.last_login ? new Date(row.last_login).toISOString() : undefined,
  };
}

function mapDocRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    expiryDate: row.expiry_date ? formatDate(row.expiry_date) : undefined,
    issueDate: row.issue_date ? formatDate(row.issue_date) : undefined,
    attachments: row.attachments || [],
    uploadDate: new Date(row.upload_date).toISOString(),
    status: row.status,
    isArchived: !!row.is_archived,
  };
}

function mapInvitationRow(row) {
  return {
    email: row.email,
    token: row.token,
    invitedAt: new Date(row.invited_at).toISOString(),
    status: row.status,
  };
}

function formatDate(d) {
  if (!d) return undefined;
  const date = new Date(d);
  return date.toISOString().split('T')[0];
}

// Test polaczenia
export async function testConnection() {
  try {
    const db = getPool();
    const [rows] = await db.execute('SELECT 1 as ok');
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}
