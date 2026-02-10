"use strict";

/**
 * Passenger (CloudLinux/cPanel) startup file.
 * Passenger nie radzi sobie z ES modules bezposrednio,
 * wiec ten plik CommonJS laduje serwer dynamicznie.
 */

// Zaladuj zmienne srodowiskowe z .env (backup - glowne sa z .htaccess SetEnv)
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  // dotenv moze nie byc zainstalowane - env vars z .htaccess SetEnv powinny wystarczyc
}

async function startServer() {
  try {
    const server = await import('./server.js');
    if (server.default && typeof server.default === 'function') {
      // Jesli server.js eksportuje Express app
      const app = server.default;
      const port = process.env.PORT || 3000;
      app.listen(port, () => {
        console.log(`Server started on port ${port}`);
      });
    }
  } catch (err) {
    console.error('Failed to start server:', err);
    
    // Fallback - prosty serwer zeby zobaczyc blad
    const http = require('http');
    const fs = require('fs');
    
    http.createServer((req, res) => {
      // Sprobuj serwowac index.html
      const indexPath = path.join(__dirname, 'index.html');
      if (req.url.startsWith('/api/')) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server starting...', details: err.message }));
      } else if (fs.existsSync(indexPath) && (req.url === '/' || req.url === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(indexPath));
      } else {
        // Sprobuj serwowac statyczne pliki
        const filePath = path.join(__dirname, req.url);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath);
          const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
          res.end(fs.readFileSync(filePath));
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(fs.readFileSync(indexPath));
        }
      }
    }).listen(process.env.PORT || 3000);
    
    console.log('Fallback server running');
  }
}

startServer();
