// Vercel Serverless Function - Health Check
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
    const emailConfigured = !!process.env.EMAILJS_SERVICE_ID && !!process.env.EMAILJS_PUBLIC_KEY;

    res.status(200).json({
        status: 'ok',
        service: 'Sierra Zulu Email & Document Service',
        blobConfigured,
        emailConfigured,
        timestamp: new Date().toISOString()
    });
}
