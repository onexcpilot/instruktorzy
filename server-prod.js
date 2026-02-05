import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Konfiguracja folderu na uploady
const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.ensureDirSync(UPLOADS_DIR);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serwowanie plików statycznych (frontendu)
// Kod sprawdzi czy pliki są w 'dist' czy bezpośrednio w katalogu
const distPath = path.join(__dirname, 'dist');
const rootPath = __dirname;

if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
} else {
    // Jeśli wgrałeś pliki bezpośrednio (bez folderu dist)
    app.use(express.static(rootPath, {
        setHeaders: (res, filePath) => {
            // Blokada dostępu do plików konfiguracyjnych przez przeglądarkę
            const forbidden = ['.env', 'server-prod.js', 'package.json', 'package-lock.json', 'server.js'];
            if (forbidden.some(file => filePath.endsWith(file))) {
                res.status(403).end();
            }
        }
    }));
}
// Serwowanie wgranych dokumentów
app.use('/uploads', express.static(UPLOADS_DIR));

// --- KONFIGURACJA SMTP (Poczta Domenomania) ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// --- API: WYSYŁKA EMAIL ---
app.post('/api/send-email', async (req, res) => {
    try {
        const { to_email, password, link } = req.body;

        if (!to_email || !password) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const mailOptions = {
            from: `"Sierra Zulu Portal" <${process.env.SMTP_USER}>`,
            to: to_email,
            subject: 'Zaproszenie do Sierra Zulu Portal',
            text: `Witaj! Zostałeś zaproszony do portalu instruktorów Sierra Zulu.\n\nLogin: ${to_email}\nHasło: ${password}\nLink: ${link || 'https://twojadomena.pl'}\n\nPozdrawiamy,\nAviation Sierra Zulu`,
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2 style="color: #2563eb;">Witaj!</h2>
                    <p>Zostałeś zaproszony do portalu instruktorów <b>Sierra Zulu</b>.</p>
                    <p>Twoje dane do logowania:</p>
                    <ul>
                        <li><b>Login:</b> ${to_email}</li>
                        <li><b>Hasło:</b> ${password}</li>
                    </ul>
                    <p><a href="${link || '#'}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Zaloguj się do portalu</a></p>
                    <br>
                    <p>Pozdrawiamy,<br>Aviation Sierra Zulu</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, messageId: 'sent' });

    } catch (error) {
        console.error('SMTP Error:', error);
        res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
});

// --- API: UPLOAD DOKUMENTÓW (Base64 -> Local Disk) ---
app.post('/api/upload-document', async (req, res) => {
    try {
        const { fileName, fileData, mimeType } = req.body;

        if (!fileName || !fileData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        const uniqueFileName = `${timestamp}_${safeName}`;
        const filePath = path.join(UPLOADS_DIR, uniqueFileName);

        // Zapisz bufor na dysk
        const buffer = Buffer.from(fileData, 'base64');
        await fs.writeFile(filePath, buffer);

        // Zwróć URL relatywny do serwera
        res.json({
            success: true,
            fileUrl: `/uploads/${uniqueFileName}`,
            fileName: uniqueFileName
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload document', details: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Sierra Zulu Production Service (Domenomania)',
        smtp: !!process.env.SMTP_USER,
        timestamp: new Date().toISOString()
    });
});

// Każdy inny request zwraca index.html (obsługa routingu React)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Production server running on port ${PORT}`);
    console.log(`📁 Uploads available at: /uploads`);
});
