import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { put } from '@vercel/blob';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Vercel Blob token
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

// Wysyłanie emaili przez EmailJS API
async function sendEmail(serviceId, templateId, userId, params) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: userId,
      template_params: params
    })
  });
  return response.json();
}

// Endpoint do wysyłki emaili
app.post('/api/send-email', async (req, res) => {
  try {
    const { to_email, password, link } = req.body;

    if (!to_email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await sendEmail(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      process.env.EMAILJS_PUBLIC_KEY,
      {
        to_email,
        password,
        link: link || 'https://instruktorzy.vercel.app',
        subject: 'Zaproszenie do Sierra Zulu Portal',
        message: 'Zostałeś zaproszony do portalu instruktorów'
      }
    );

    if (result.status === 200) {
      res.json({ success: true, messageId: 'sent' });
    } else {
      res.status(500).json({ error: 'Failed to send email', details: result });
    }
  } catch (error) {
    console.error('Email API Error:', error);
    res.status(500).json({ 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});

// Endpoint do upload'u dokumentów (base64)
app.post('/api/upload-document', async (req, res) => {
  try {
    const { fileName, fileData, mimeType } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!BLOB_TOKEN) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' });
    }

    // Generuj unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}_${fileName}`;

    // Konwertuj base64 na Buffer
    const buffer = Buffer.from(fileData, 'base64');

    try {
      // Upload do Vercel Blob
      const blob = await put(uniqueFileName, buffer, {
        access: 'public',
        token: BLOB_TOKEN,
        contentType: mimeType || 'application/octet-stream'
      });

      // Zwróć URL do pliku (bez leading slash, bo blob.url zawiera już pełny URL)
      res.json({ 
        success: true, 
        fileUrl: blob.url,
        fileName: uniqueFileName 
      });
    } catch (blobError) {
      console.error('Vercel Blob Error:', blobError);
      res.status(500).json({ 
        error: 'Failed to upload to Vercel Blob',
        details: blobError.message 
      });
    }
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ 
      error: 'Failed to upload document',
      details: error.message 
    });
  }
});

// Endpoint do wysylki powiadomien o wygasajacych dokumentach
app.post('/api/send-notification', async (req, res) => {
  try {
    const { users } = req.body;
    if (!users || !users.length) {
      return res.status(400).json({ error: 'No users data provided' });
    }

    const allAlerts = [];
    for (const user of users) {
      if (user.role !== 'INSTRUCTOR') continue;
      const docs = (user.documents || []).filter(d => !d.isArchived);
      for (const doc of docs) {
        if (!doc.expiryDate) continue;
        const now = new Date(); now.setHours(0,0,0,0);
        const expiry = new Date(doc.expiryDate); expiry.setHours(0,0,0,0);
        const days = Math.ceil((expiry - now) / (1000*60*60*24));
        let level = null;
        if (days <= 0) level = 'expired';
        else if (days <= 7) level = 'critical';
        else if (days <= 30) level = 'warning';
        else if (days <= 90) level = 'info';
        if (level) {
          allAlerts.push({
            instructorId: user.id,
            instructorName: user.fullName,
            instructorEmail: user.email,
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
      return res.json({ success: true, message: 'No expiring documents', sent: 0 });
    }

    // Grupuj per instruktor i wyslij emaile
    const grouped = {};
    for (const a of allAlerts) {
      if (!grouped[a.instructorEmail]) grouped[a.instructorEmail] = { name: a.instructorName, alerts: [] };
      grouped[a.instructorEmail].alerts.push(a);
    }

    const results = [];
    for (const [email, data] of Object.entries(grouped)) {
      const hasUrgent = data.alerts.some(a => ['expired','critical','warning'].includes(a.level));
      if (!hasUrgent) continue;

      try {
        const urgentCount = data.alerts.filter(a => a.level === 'expired' || a.level === 'critical').length;
        const subject = urgentCount > 0
          ? `[PILNE] Sierra Zulu - ${urgentCount} wygasajacych dokumentow`
          : `Sierra Zulu - Przypomnienie o dokumentach`;

        await sendEmail(
          process.env.EMAILJS_SERVICE_ID,
          process.env.EMAILJS_NOTIFICATION_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID,
          process.env.EMAILJS_PUBLIC_KEY,
          { to_email: email, subject, message: `Masz ${data.alerts.length} dokumentow wymagajacych uwagi. Zaloguj sie do portalu.`, from_name: 'Sierra Zulu DTO' }
        );
        results.push({ email, sent: true, alertsCount: data.alerts.length });
      } catch (err) {
        results.push({ email, sent: false, error: err.message });
      }
    }

    res.json({ success: true, totalAlerts: allAlerts.length, results, alerts: allAlerts });
  } catch (error) {
    console.error('Notification Error:', error);
    res.status(500).json({ error: 'Failed to process notifications', details: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  const blobConfigured = !!BLOB_TOKEN;
  res.json({ 
    status: 'ok', 
    service: 'Sierra Zulu Email & Document Service',
    blobConfigured 
  });
});

app.listen(PORT, () => {
  console.log(`✅ Service running on port ${PORT}`);
  console.log(`🔐 Vercel Blob: ${BLOB_TOKEN ? 'Configured ✓' : 'NOT configured ✗'}`);
});
