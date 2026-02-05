import { put } from '@vercel/blob';

// Vercel Serverless Function dla uploadu dokumentów
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
        const { fileName, fileData, mimeType } = req.body;

        if (!fileName || !fileData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
        if (!blobToken) {
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
                token: blobToken,
                contentType: mimeType || 'application/octet-stream'
            });

            // Zwróć URL do pliku
            res.status(200).json({
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
}
