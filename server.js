import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Sierra Zulu Email Service' });
});

app.listen(PORT, () => {
  console.log(`✅ Email service running on port ${PORT}`);
});
