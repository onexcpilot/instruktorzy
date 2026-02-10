/**
 * Vercel Cron / Manual trigger - Powiadomienia o wygasajacych dokumentach
 * GET  = Vercel Cron (wymaga CRON_SECRET)
 * POST = Reczne wywolanie z panelu admina
 *
 * Teraz czyta dane z MySQL (nie localStorage) i wysyla przez SMTP (nie EmailJS).
 */

import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';

const THRESHOLDS = { EXPIRED: 0, CRITICAL: 7, WARNING: 30, INFO: 90 };

const LEVEL_LABELS = {
  expired: 'WYGASLO',
  critical: 'PILNE - 7 DNI',
  warning: 'OSTRZEZENIE - 30 DNI',
  info: 'PRZYPOMNIENIE - 90 DNI',
};

function getPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'dm75078_sierrazulu',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'dm75078_instruktor',
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 3,
    charset: 'utf8mb4',
  });
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.sierrazulu.waw.pl',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'kontakt@sierrazulu.waw.pl',
      pass: process.env.SMTP_PASS,
    },
  });
}

function getDaysUntilExpiry(expiryDate) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate); exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getAlertLevel(days) {
  if (days <= THRESHOLDS.EXPIRED) return 'expired';
  if (days <= THRESHOLDS.CRITICAL) return 'critical';
  if (days <= THRESHOLDS.WARNING) return 'warning';
  if (days <= THRESHOLDS.INFO) return 'info';
  return null;
}

function buildInstructorEmailHTML(name, alerts) {
  const rows = alerts.map(a => {
    const color = a.level === 'expired' ? '#dc2626' : a.level === 'critical' ? '#ea580c' : a.level === 'warning' ? '#d97706' : '#2563eb';
    const days = a.daysRemaining <= 0 ? `WYGASLO ${Math.abs(a.daysRemaining)} dni temu` : `${a.daysRemaining} dni do wygasniecia`;
    return `<tr>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;">${a.documentName}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;">${a.expiryDate}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:${color};font-weight:bold;">${days}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;"><span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${LEVEL_LABELS[a.level]}</span></td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#f8fafc;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
    <div style="background:#0f172a;padding:24px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:18px;letter-spacing:2px;">SIERRA ZULU - DTO</h1>
      <p style="color:#60a5fa;margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:3px;">System Powiadomien</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:14px;">Witaj <strong>${name}</strong>,</p>
      <p style="color:#334155;font-size:14px;">Informujemy o statusie waznosci Twoich dokumentow:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
        <thead><tr style="background:#f1f5f9;">
          <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Dokument</th>
          <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Data waznosci</th>
          <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Status</th>
          <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Poziom</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#334155;font-size:14px;">Prosimy o niezwloczne uzupelnienie lub odnowienie dokumentow.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://instruktor.sierrazulu.waw.pl" style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">Przejdz do Portalu</a>
      </div>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px;text-align:center;">
        Zgodnie z Part-FCL i Part-DTO, instruktor odpowiada za utrzymanie waznosci swoich uprawnien.<br/>
        Wiadomosc wygenerowana automatycznie - prosimy nie odpowiadac.
      </p>
    </div>
  </div>
</body></html>`;
}

function buildAdminSummaryHTML(allAlerts) {
  const grouped = {};
  for (const a of allAlerts) {
    if (!grouped[a.instructorEmail]) grouped[a.instructorEmail] = { name: a.instructorName, alerts: [] };
    grouped[a.instructorEmail].alerts.push(a);
  }

  let rows = '';
  for (const [, data] of Object.entries(grouped)) {
    for (const a of data.alerts) {
      const color = a.level === 'expired' ? '#dc2626' : a.level === 'critical' ? '#ea580c' : a.level === 'warning' ? '#d97706' : '#2563eb';
      rows += `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${data.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${a.documentName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${a.expiryDate}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${LEVEL_LABELS[a.level]}</span></td>
      </tr>`;
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#f8fafc;padding:20px;">
  <div style="max-width:700px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:18px;">SIERRA ZULU - RAPORT DZIENNY</h1>
      <p style="color:#60a5fa;margin:4px 0 0;font-size:11px;text-transform:uppercase;">Wygasajace uprawnienia instruktorow</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:14px;">Wykryto <strong>${allAlerts.length}</strong> alertow dotyczacych wygasajacych dokumentow:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead><tr style="background:#f1f5f9;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Instruktor</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Dokument</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Wazny do</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://instruktor.sierrazulu.waw.pl" style="background:#0f172a;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">Otworz Panel Admina</a>
      </div>
    </div>
  </div>
</body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const isCron = req.method === 'GET';

  // Weryfikacja CRON_SECRET dla cron jobs
  if (isCron && process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pool = getPool();

  try {
    // ---- Pobierz dokumenty z MySQL ----
    const [docs] = await pool.execute(
      `SELECT d.id as doc_id, d.name as doc_name, d.type as doc_type,
              d.expiry_date, d.status as doc_status,
              u.id as user_id, u.email, u.full_name
       FROM documents d
       JOIN users u ON d.user_id = u.id
       WHERE u.role = 'INSTRUCTOR'
         AND d.is_archived = 0
         AND d.expiry_date IS NOT NULL
         AND d.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
       ORDER BY d.expiry_date ASC`
    );

    if (docs.length === 0) {
      await pool.end();
      return res.json({ success: true, message: 'Brak wygasajacych dokumentow', sent: 0, totalAlerts: 0, results: [] });
    }

    // Oblicz alerty
    const allAlerts = [];
    for (const doc of docs) {
      const days = getDaysUntilExpiry(doc.expiry_date);
      const level = getAlertLevel(days);
      if (level) {
        allAlerts.push({
          instructorId: doc.user_id,
          instructorName: doc.full_name,
          instructorEmail: doc.email,
          documentId: doc.doc_id,
          documentName: doc.doc_name || doc.doc_type,
          documentType: doc.doc_type,
          expiryDate: new Date(doc.expiry_date).toISOString().split('T')[0],
          daysRemaining: days,
          level,
        });
      }
    }

    if (allAlerts.length === 0) {
      await pool.end();
      return res.json({ success: true, message: 'Brak alertow', sent: 0, totalAlerts: 0, results: [] });
    }

    // Grupuj per instruktor
    const grouped = {};
    for (const a of allAlerts) {
      if (!grouped[a.instructorEmail]) grouped[a.instructorEmail] = { name: a.instructorName, email: a.instructorEmail, alerts: [] };
      grouped[a.instructorEmail].alerts.push(a);
    }

    const transporter = getTransporter();
    const results = [];
    const fromAddress = `"Sierra Zulu DTO" <${process.env.SMTP_USER || 'kontakt@sierrazulu.waw.pl'}>`;

    for (const [email, data] of Object.entries(grouped)) {
      const urgentAlerts = data.alerts.filter(a => ['expired', 'critical', 'warning'].includes(a.level));
      if (urgentAlerts.length === 0) {
        results.push({ email, name: data.name, skipped: true, reason: 'info_only' });
        continue;
      }

      // Sprawdz czy juz wyslano dzisiaj
      const [sentToday] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM notification_log
         WHERE instructor_email = ? AND DATE(sent_at) = CURDATE() AND email_sent = 1`,
        [email]
      );
      if (sentToday[0].cnt > 0) {
        results.push({ email, name: data.name, skipped: true, reason: 'already_sent_today' });
        continue;
      }

      // Buduj i wyslij email
      const expiredCount = urgentAlerts.filter(a => a.level === 'expired').length;
      const subject = expiredCount > 0
        ? `[PILNE] Sierra Zulu - ${expiredCount} wygaslych dokumentow`
        : `Sierra Zulu - Przypomnienie o dokumentach`;

      try {
        const html = buildInstructorEmailHTML(data.name, urgentAlerts);
        await transporter.sendMail({
          from: fromAddress,
          to: email,
          subject,
          html,
          text: `Masz ${urgentAlerts.length} dokumentow wymagajacych uwagi. Zaloguj sie: https://instruktor.sierrazulu.waw.pl`,
        });

        // Zapisz logi
        for (const a of urgentAlerts) {
          await pool.execute(
            `INSERT INTO notification_log (id, alert_level, instructor_email, instructor_name, document_type, document_name, expiry_date, days_remaining, email_sent)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 1)`,
            [a.level, email, data.name, a.documentType, a.documentName, a.expiryDate, a.daysRemaining]
          );
        }
        results.push({ email, name: data.name, sent: true, alertsCount: urgentAlerts.length });
      } catch (smtpErr) {
        console.error(`SMTP error for ${email}:`, smtpErr.message);
        for (const a of urgentAlerts) {
          await pool.execute(
            `INSERT INTO notification_log (id, alert_level, instructor_email, instructor_name, document_type, document_name, expiry_date, days_remaining, email_sent, error_message)
             VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [a.level, email, data.name, a.documentType, a.documentName, a.expiryDate, a.daysRemaining, smtpErr.message]
          );
        }
        results.push({ email, name: data.name, sent: false, error: smtpErr.message });
      }
    }

    // Raport zbiorczy do admina
    try {
      const adminHtml = buildAdminSummaryHTML(allAlerts);
      await transporter.sendMail({
        from: fromAddress,
        to: process.env.SMTP_USER || 'kontakt@sierrazulu.waw.pl',
        subject: `[RAPORT] Sierra Zulu - ${allAlerts.length} alertow wygasajacych uprawnien`,
        html: adminHtml,
        text: `Raport: ${allAlerts.length} alertow. Szczegoly w panelu admina.`,
      });
    } catch (adminErr) {
      console.error('Admin summary email error:', adminErr.message);
    }

    await pool.end();
    res.json({
      success: true,
      totalAlerts: allAlerts.length,
      instructorsNotified: results.filter(r => r.sent).length,
      results,
    });
  } catch (error) {
    console.error('Notification error:', error);
    try { await pool.end(); } catch {}
    res.status(500).json({ error: 'Failed to process notifications', details: error.message });
  }
}
