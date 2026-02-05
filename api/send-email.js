// Vercel Serverless Function dla wysyłki emaili
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { to_email, password, link } = req.body;

        if (!to_email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Wysyłanie emaila przez EmailJS API
        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: process.env.EMAILJS_SERVICE_ID,
                template_id: process.env.EMAILJS_TEMPLATE_ID,
                user_id: process.env.EMAILJS_PUBLIC_KEY,
                accessToken: process.env.EMAILJS_PRIVATE_KEY, // Dodano klucz prywatny dla backendu
                template_params: {
                    to_email,
                    password,
                    link: link || 'https://instruktorzy.vercel.app',
                    subject: 'Zaproszenie do Sierra Zulu Portal',
                    message: 'Zostałeś zaproszony do portalu instruktorów'
                }
            })
        });

        const result = await emailResponse.json();

        if (emailResponse.ok) {
            res.status(200).json({ success: true, messageId: 'sent' });
        } else {
            console.error('EmailJS Error:', result);
            res.status(500).json({ error: 'Failed to send email', details: result });
        }
    } catch (error) {
        console.error('Email API Error:', error);
        res.status(500).json({
            error: 'Failed to send email',
            details: error.message
        });
    }
}
