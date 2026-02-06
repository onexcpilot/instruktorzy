// Vercel Serverless Function - wysylka powiadomien o wygasajacych uprawnieniach
// Moze byc wywolywalny recznie (POST) lub przez Vercel Cron (GET z CRON_SECRET)

const NOTIFICATION_THRESHOLDS = { INFO: 90, WARNING: 30, CRITICAL: 7, EXPIRED: 0 };

const LEVEL_LABELS = {
  expired: 'WYGASLO',
  critical: 'PILNE - 7 DNI',
  warning: 'OSTRZEZENIE - 30 DNI',
  info: 'PRZYPOMNIENIE - 90 DNI',
};

function getDaysUntilExpiry(expiryDate) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getAlertLevel(days) {
  if (days <= NOTIFICATION_THRESHOLDS.EXPIRED) return 'expired';
  if (days <= NOTIFICATION_THRESHOLDS.CRITICAL) return 'critical';
  if (days <= NOTIFICATION_THRESHOLDS.WARNING) return 'warning';
  if (days <= NOTIFICATION_THRESHOLDS.INFO) return 'info';
  return null;
}

function buildEmailHTML(instructorName, alerts) {
  const alertRows = alerts.map(a => {
    const color = a.level === 'expired' ? '#dc2626' :
                  a.level === 'critical' ? '#ea580c' :
                  a.level === 'warning' ? '#d97706' : '#2563eb';
    const days = a.daysRemaining <= 0
      ? `WYGASLO ${Math.abs(a.daysRemaining)} dni temu`
      : `${a.daysRemaining} dni do wygasniecia`;
    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;">${a.documentName}</td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;">${a.expiryDate}</td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;color:${color};font-weight:bold;">${days}</td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;"><span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${LEVEL_LABELS[a.level]}</span></td>
      </tr>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#f8fafc;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
    <div style="background:#0f172a;padding:24px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:18px;letter-spacing:2px;">SIERRA ZULU - DTO</h1>
      <p style="color:#60a5fa;margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:3px;">System Powiadomien</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:14px;">Witaj <strong>${instructorName}</strong>,</p>
      <p style="color:#334155;font-size:14px;">Informujemy o statusie waznosci Twoich dokumentow:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Dokument</th>
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Data waznosci</th>
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Status</th>
            <th style="padding:10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Poziom</th>
          </tr>
        </thead>
        <tbody>${alertRows}</tbody>
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
</body>
</html>`;
}

function buildAdminSummaryHTML(allAlerts) {
  const groupedByInstructor = {};
  for (const a of allAlerts) {
    if (!groupedByInstructor[a.instructorEmail]) {
      groupedByInstructor[a.instructorEmail] = { name: a.instructorName, alerts: [] };
    }
    groupedByInstructor[a.instructorEmail].alerts.push(a);
  }

  let rows = '';
  for (const [email, data] of Object.entries(groupedByInstructor)) {
    for (const a of data.alerts) {
      const color = a.level === 'expired' ? '#dc2626' :
                    a.level === 'critical' ? '#ea580c' :
                    a.level === 'warning' ? '#d97706' : '#2563eb';
      rows += `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${data.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${a.documentName}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${a.expiryDate}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${LEVEL_LABELS[a.level]}</span></td>
        </tr>`;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#f8fafc;padding:20px;">
  <div style="max-width:700px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:#0f172a;padding:24px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:18px;">SIERRA ZULU - RAPORT DZIENNY</h1>
      <p style="color:#60a5fa;margin:4px 0 0;font-size:11px;text-transform:uppercase;">Wygasajace uprawnienia instruktorow</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#334155;font-size:14px;">Wykryto <strong>${allAlerts.length}</strong> alertow dotyczacych wygasajacych dokumentow:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Instruktor</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Dokument</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Wazny do</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b;">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://instruktor.sierrazulu.waw.pl" style="background:#0f172a;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">Otworz Panel Admina</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // GET = cron job wywolanie (zabezpieczone CRON_SECRET)
  // POST = reczne wywolanie z panelu admina (z danymi w body)
  
  const isCron = req.method === 'GET';

  // Walidacja cron secret
  if (isCron && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let users = [];

    if (isCron) {
      // Cron: Dane musza przychodzic z zewnetrznego zrodla (np. API)
      // Poniewaz ta wersja uzywa localStorage na frontendzie,
      // cron nie ma dostepu do danych. W pelnej wersji z baza danych
      // tutaj bylyby pobierane z DB.
      return res.status(200).json({
        success: true,
        message: 'Cron check completed - requires database integration for automatic scanning',
        note: 'Use POST with users data from admin panel for manual notification sending'
      });
    }

    // POST: Admin wysyla dane instruktorow do przeskanowania
    users = req.body?.users || [];

    if (!users.length) {
      return res.status(400).json({ error: 'No users data provided' });
    }

    // Skanuj dokumenty
    const allAlerts = [];
    for (const user of users) {
      if (user.role !== 'INSTRUCTOR') continue;
      const docs = (user.documents || []).filter(d => !d.isArchived);
      for (const doc of docs) {
        if (!doc.expiryDate) continue;
        const days = getDaysUntilExpiry(doc.expiryDate);
        const level = getAlertLevel(days);
        if (level) {
          allAlerts.push({
            instructorId: user.id,
            instructorName: user.fullName,
            instructorEmail: user.email,
            documentId: doc.id,
            documentName: doc.name || doc.type,
            documentType: doc.type,
            expiryDate: doc.expiryDate,
            daysRemaining: days,
            level,
          });
        }
      }
    }

    if (allAlerts.length === 0) {
      return res.status(200).json({ success: true, message: 'No expiring documents found', sent: 0 });
    }

    // Grupuj alerty po instruktorze
    const groupedByInstructor = {};
    for (const alert of allAlerts) {
      if (!groupedByInstructor[alert.instructorEmail]) {
        groupedByInstructor[alert.instructorEmail] = {
          name: alert.instructorName,
          email: alert.instructorEmail,
          alerts: []
        };
      }
      groupedByInstructor[alert.instructorEmail].alerts.push(alert);
    }

    const results = [];

    // Wyslij email do kazdego instruktora
    for (const [email, data] of Object.entries(groupedByInstructor)) {
      // Sprawdz czy sa alerty na poziomie warning lub wyzszym
      const hasUrgent = data.alerts.some(a => a.level === 'expired' || a.level === 'critical' || a.level === 'warning');
      if (!hasUrgent) continue; // info - nie wysylaj emaila, tylko pokazuj w panelu

      try {
        const html = buildEmailHTML(data.name, data.alerts);
        const urgentCount = data.alerts.filter(a => a.level === 'expired' || a.level === 'critical').length;
        const subject = urgentCount > 0
          ? `[PILNE] Sierra Zulu - ${urgentCount} wygasajacych dokumentow`
          : `Sierra Zulu - Przypomnienie o dokumentach`;

        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: process.env.EMAILJS_SERVICE_ID,
            template_id: process.env.EMAILJS_NOTIFICATION_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID,
            user_id: process.env.EMAILJS_PUBLIC_KEY,
            accessToken: process.env.EMAILJS_PRIVATE_KEY,
            template_params: {
              to_email: email,
              subject: subject,
              message: html,
              from_name: 'Sierra Zulu DTO',
            }
          })
        });

        results.push({
          email,
          name: data.name,
          alertsCount: data.alerts.length,
          sent: emailResponse.ok,
          error: emailResponse.ok ? null : `HTTP ${emailResponse.status}`
        });
      } catch (err) {
        results.push({
          email,
          name: data.name,
          alertsCount: data.alerts.length,
          sent: false,
          error: err.message
        });
      }
    }

    // Wyslij raport zbiorczy do admina
    try {
      const adminHtml = buildAdminSummaryHTML(allAlerts);
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: process.env.EMAILJS_SERVICE_ID,
          template_id: process.env.EMAILJS_NOTIFICATION_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID,
          user_id: process.env.EMAILJS_PUBLIC_KEY,
          accessToken: process.env.EMAILJS_PRIVATE_KEY,
          template_params: {
            to_email: 'kontakt@sierrazulu.waw.pl',
            subject: `[RAPORT] Sierra Zulu - ${allAlerts.length} alertow wygasajacych uprawnien`,
            message: adminHtml,
            from_name: 'Sierra Zulu DTO - System',
          }
        })
      });
    } catch (adminErr) {
      console.error('Admin summary email error:', adminErr);
    }

    res.status(200).json({
      success: true,
      totalAlerts: allAlerts.length,
      instructorsNotified: results.filter(r => r.sent).length,
      results,
      alerts: allAlerts,
    });

  } catch (error) {
    console.error('Notification API Error:', error);
    res.status(500).json({ error: 'Failed to process notifications', details: error.message });
  }
}
