import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import {
  findUserByEmail,
  findUserById,
  getAllInstructors,
  createUser,
  updateUserPassword,
  updateUserLastLogin,
  validatePassword,
  hashPassword,
  addDocument,
  updateDocumentStatus,
  createInvitation,
  getExpiringDocuments,
  addNotificationLog,
  wasNotificationSentToday,
  getRecentNotifications,
  ensureAdminAccount,
  testConnection,
} from './services/db.js';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Uploads directory
const UPLOADS_DIR = join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Serwowanie frontendu (zbudowany React)
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    const forbidden = ['.env', 'server.js', 'server-prod.js', 'package.json', 'package-lock.json', 'db.js'];
    if (forbidden.some(file => filePath.endsWith(file))) {
      res.status(403).end();
    }
  }
}));
app.use('/uploads', express.static(UPLOADS_DIR));

// =============================================
// SMTP Transporter (Domenomania)
// =============================================
let smtpTransporter = null;

function getSmtpTransporter() {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.sierrazulu.waw.pl',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // SSL
      auth: {
        user: process.env.SMTP_USER || 'kontakt@sierrazulu.waw.pl',
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return smtpTransporter;
}

async function sendSmtpEmail({ to, subject, html, text }) {
  const transporter = getSmtpTransporter();
  return transporter.sendMail({
    from: `"Sierra Zulu DTO" <${process.env.SMTP_USER || 'kontakt@sierrazulu.waw.pl'}>`,
    to,
    subject,
    html,
    text,
  });
}

// =============================================
// AUTH ENDPOINTS
// =============================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email i haslo sa wymagane' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Bledny e-mail lub haslo' });
    }

    const valid = await validatePassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Bledny e-mail lub haslo' });
    }

    await updateUserLastLogin(user.id);

    // Nie zwracaj hasla do frontendu
    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'Brak wymaganych danych' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Haslo musi miec minimum 8 znakow' });
    }

    if (currentPassword) {
      const user = await findUserById(userId);
      if (!user) return res.status(404).json({ error: 'Uzytkownik nie znaleziony' });
      const valid = await validatePassword(currentPassword, user.password);
      if (!valid) return res.status(401).json({ error: 'Aktualne haslo jest bledne' });
    }

    await updateUserPassword(userId, newPassword);
    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// =============================================
// USER / INSTRUCTOR ENDPOINTS
// =============================================

// GET /api/users/me/:id
app.get('/api/users/me/:id', async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Nie znaleziono' });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// GET /api/instructors
app.get('/api/instructors', async (req, res) => {
  try {
    const instructors = await getAllInstructors();
    const safe = instructors.map(({ password, ...rest }) => rest);
    res.json(safe);
  } catch (error) {
    console.error('Get instructors error:', error);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// =============================================
// INVITATION ENDPOINTS
// =============================================

// POST /api/invite
app.post('/api/invite', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Podaj poprawny email' });
    }

    // Sprawdz czy juz istnieje
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Uzytkownik z tym emailem juz istnieje' });
    }

    const tempPass = 'Temp' + Math.random().toString(36).substring(2, 10).toUpperCase();

    // Stworz usera w bazie
    const user = await createUser({
      email,
      password: tempPass,
      fullName: email.split('@')[0],
      role: 'INSTRUCTOR',
      isInvited: true,
    });

    // Stworz zaproszenie
    const invitation = await createInvitation(email);

    // Wyslij email SMTP
    let emailSent = false;
    let errorMsg = null;
    try {
      await sendSmtpEmail({
        to: email,
        subject: 'Zaproszenie do Sierra Zulu Portal Instruktora',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1e293b;">Sierra Zulu DTO - Zaproszenie</h2>
            <p>Zostales zaproszony do portalu instruktorow Sierra Zulu.</p>
            <div style="background:#f1f5f9;padding:20px;border-radius:12px;margin:20px 0;">
              <p style="margin:5px 0;"><strong>Login:</strong> ${email}</p>
              <p style="margin:5px 0;"><strong>Haslo tymczasowe:</strong> ${tempPass}</p>
              <p style="margin:5px 0;"><strong>Link:</strong> <a href="https://instruktor.sierrazulu.waw.pl">instruktor.sierrazulu.waw.pl</a></p>
            </div>
            <p style="color:#94a3b8;font-size:12px;">Po zalogowaniu zmien haslo w ustawieniach.</p>
          </div>
        `,
        text: `Sierra Zulu - Zaproszenie\nLogin: ${email}\nHaslo: ${tempPass}\nLink: https://instruktor.sierrazulu.waw.pl`,
      });
      emailSent = true;
    } catch (emailErr) {
      console.error('SMTP invite error:', emailErr);
      errorMsg = emailErr.message;
    }

    res.json({
      success: true,
      email,
      tempPass,
      emailSent,
      error: errorMsg,
    });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Blad serwera', details: error.message });
  }
});

// =============================================
// DOCUMENT ENDPOINTS
// =============================================

// POST /api/documents/upload
app.post('/api/documents/upload', async (req, res) => {
  try {
    const { userId, name, type, expiryDate, files } = req.body;
    if (!userId || !type || !files || files.length === 0) {
      return res.status(400).json({ error: 'Brak wymaganych danych' });
    }

    // Upload plikow na dysk serwera
    const attachments = [];
    for (const file of files) {
      const buffer = Buffer.from(file.fileData, 'base64');
      const safeName = file.fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const uniqueName = `${Date.now()}_${safeName}`;
      const filePath = join(UPLOADS_DIR, uniqueName);
      fs.writeFileSync(filePath, buffer);
      attachments.push({
        fileName: file.fileName,
        fileSize: file.fileSize || buffer.length,
        fileUrl: `/uploads/${uniqueName}`,
        mimeType: file.mimeType,
      });
    }

    // Zapisz dokument w bazie MySQL
    const docId = await addDocument(userId, {
      name,
      type,
      expiryDate: expiryDate || null,
      status: 'pending_review',
      attachments,
    });

    res.json({ success: true, documentId: docId, attachments });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Blad uploadu', details: error.message });
  }
});

// PATCH /api/documents/:id/status
app.patch('/api/documents/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['valid', 'expired', 'pending_review'].includes(status)) {
      return res.status(400).json({ error: 'Nieprawidlowy status' });
    }
    await updateDocumentStatus(req.params.id, status);
    res.json({ success: true });
  } catch (error) {
    console.error('Update doc status error:', error);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// POST /api/admin/reset-password
app.post('/api/admin/reset-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'Brak danych' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Haslo musi miec minimum 8 znakow' });
    }
    await updateUserPassword(userId, newPassword);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin reset pass error:', error);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// =============================================
// NOTIFICATION ENDPOINTS
// =============================================

// GET /api/notifications/check - sprawdz i wyslij powiadomienia (CRON)
app.get('/api/notifications/check', async (req, res) => {
  try {
    const expiringDocs = await getExpiringDocuments(90);
    if (expiringDocs.length === 0) {
      return res.json({ success: true, message: 'Brak wygasajacych dokumentow', sent: 0 });
    }

    // Oblicz dni i poziomy alertow
    const alerts = expiringDocs.map(doc => {
      const now = new Date(); now.setHours(0,0,0,0);
      const expiry = new Date(doc.expiry_date); expiry.setHours(0,0,0,0);
      const days = Math.ceil((expiry - now) / (1000*60*60*24));
      let level = 'info';
      if (days <= 0) level = 'expired';
      else if (days <= 7) level = 'critical';
      else if (days <= 30) level = 'warning';
      return { ...doc, daysRemaining: days, level };
    });

    // Grupuj per instruktor
    const grouped = {};
    for (const a of alerts) {
      const key = a.instructor_email;
      if (!grouped[key]) grouped[key] = { name: a.instructor_name, email: key, alerts: [] };
      grouped[key].alerts.push(a);
    }

    const results = [];
    for (const [email, data] of Object.entries(grouped)) {
      const urgentAlerts = data.alerts.filter(a => ['expired', 'critical', 'warning'].includes(a.level));
      if (urgentAlerts.length === 0) continue;

      // Sprawdz czy juz wyslano dzisiaj
      const alreadySent = await wasNotificationSentToday(email, urgentAlerts[0].type, urgentAlerts[0].level);
      if (alreadySent) {
        results.push({ email, skipped: true, reason: 'already_sent_today' });
        continue;
      }

      // Buduj email HTML
      const expiredCount = urgentAlerts.filter(a => a.level === 'expired').length;
      const subject = expiredCount > 0
        ? `[PILNE] Sierra Zulu - ${expiredCount} wygaslych dokumentow`
        : `Sierra Zulu - Przypomnienie o dokumentach`;

      const docRows = urgentAlerts.map(a => {
        const levelLabel = a.level === 'expired' ? 'WYGASLO' : a.level === 'critical' ? 'KRYTYCZNE' : 'OSTRZEZENIE';
        const color = a.level === 'expired' ? '#dc2626' : a.level === 'critical' ? '#ea580c' : '#d97706';
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${a.name}</td>
          <td style="padding:8px;border-bottom:1px solid #f1f5f9;"><span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;">${levelLabel}</span></td>
          <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${new Date(a.expiry_date).toLocaleDateString('pl-PL')}</td>
          <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${a.daysRemaining <= 0 ? Math.abs(a.daysRemaining) + ' dni po terminie' : a.daysRemaining + ' dni'}</td>
        </tr>`;
      }).join('');

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#1e293b;">Sierra Zulu DTO - Przypomnienie</h2>
          <p>Witaj <strong>${data.name}</strong>,</p>
          <p>Informujemy o dokumentach wymagajacych Twojej uwagi:</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <thead><tr style="background:#f1f5f9;">
              <th style="padding:8px;text-align:left;font-size:12px;">Dokument</th>
              <th style="padding:8px;text-align:left;font-size:12px;">Status</th>
              <th style="padding:8px;text-align:left;font-size:12px;">Data waznosci</th>
              <th style="padding:8px;text-align:left;font-size:12px;">Pozostalo</th>
            </tr></thead>
            <tbody>${docRows}</tbody>
          </table>
          <p>Zaloguj sie do portalu: <a href="https://instruktor.sierrazulu.waw.pl">instruktor.sierrazulu.waw.pl</a></p>
          <p style="color:#94a3b8;font-size:12px;margin-top:30px;">Zgodnie z Part-FCL/Part-DTO, instruktor odpowiada za utrzymanie waznosci swoich uprawnien.</p>
        </div>`;

      try {
        await sendSmtpEmail({ to: email, subject, html, text: `Masz ${urgentAlerts.length} dokumentow wymagajacych uwagi.` });

        // Zapisz logi
        for (const a of urgentAlerts) {
          await addNotificationLog({
            alertLevel: a.level,
            instructorEmail: email,
            instructorName: data.name,
            documentType: a.type,
            documentName: a.name,
            expiryDate: new Date(a.expiry_date).toISOString().split('T')[0],
            daysRemaining: a.daysRemaining,
            emailSent: true,
          });
        }
        results.push({ email, sent: true, count: urgentAlerts.length });
      } catch (emailErr) {
        console.error(`SMTP error for ${email}:`, emailErr);
        for (const a of urgentAlerts) {
          await addNotificationLog({
            alertLevel: a.level,
            instructorEmail: email,
            instructorName: data.name,
            documentType: a.type,
            documentName: a.name,
            expiryDate: new Date(a.expiry_date).toISOString().split('T')[0],
            daysRemaining: a.daysRemaining,
            emailSent: false,
            error: emailErr.message,
          });
        }
        results.push({ email, sent: false, error: emailErr.message });
      }
    }

    res.json({ success: true, totalAlerts: alerts.length, results });
  } catch (error) {
    console.error('Notification check error:', error);
    res.status(500).json({ error: 'Blad serwera', details: error.message });
  }
});

// POST /api/notifications/send - reczne wyslanie z panelu admina
app.post('/api/notifications/send', async (req, res) => {
  // Deleguj do GET check z force flag
  req.url = '/api/notifications/check';
  return app.handle(req, res);
});

// GET /api/notifications/log - historia powiadomien
app.get('/api/notifications/log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await getRecentNotifications(limit);
    res.json(logs);
  } catch (error) {
    console.error('Notification log error:', error);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// GET /api/notifications/alerts - aktywne alerty (z DB)
app.get('/api/notifications/alerts', async (req, res) => {
  try {
    const expiringDocs = await getExpiringDocuments(90);
    const alerts = expiringDocs.map(doc => {
      const now = new Date(); now.setHours(0,0,0,0);
      const expiry = new Date(doc.expiry_date); expiry.setHours(0,0,0,0);
      const days = Math.ceil((expiry - now) / (1000*60*60*24));
      let level = 'info';
      if (days <= 0) level = 'expired';
      else if (days <= 7) level = 'critical';
      else if (days <= 30) level = 'warning';
      return {
        instructorId: doc.instructor_id,
        instructorName: doc.instructor_name,
        instructorEmail: doc.instructor_email,
        documentId: doc.id,
        documentName: doc.name,
        documentType: doc.type,
        expiryDate: new Date(doc.expiry_date).toISOString().split('T')[0],
        daysRemaining: days,
        level,
      };
    });
    res.json(alerts);
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({ error: 'Blad serwera' });
  }
});

// =============================================
// HEALTH CHECK
// =============================================
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: 'ok',
    service: 'Sierra Zulu Portal API',
    database: dbStatus.connected ? 'connected' : 'disconnected',
    dbError: dbStatus.error || undefined,
    smtp: !!process.env.SMTP_PASS,
  });
});

// =============================================
// CATCH-ALL: Serwuj index.html dla React SPA
// =============================================
app.get('*', (req, res) => {
  const indexPath = join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Nie znaleziono index.html. Wgraj zbudowany frontend.');
  }
});

// =============================================
// STARTUP
// =============================================

// Init bazy danych przy starcie
(async () => {
  try {
    const dbStatus = await testConnection();
    if (dbStatus.connected) {
      console.log('MySQL: connected');
      await ensureAdminAccount();
    } else {
      console.error('MySQL: FAILED -', dbStatus.error);
    }
    console.log(`SMTP: ${process.env.SMTP_PASS ? 'configured' : 'NOT configured'}`);
  } catch (err) {
    console.error('Init error:', err);
  }
})();

// Eksportuj app dla Passenger (app.js) - NIE wywoluj listen() tutaj
export default app;

// Jesli uruchomiony bezposrednio (nie przez Passenger): `node server.js`
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('server')
);
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
