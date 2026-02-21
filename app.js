"use strict";

/**
 * Passenger (CloudLinux/cPanel) entry point.
 * 
 * WAZNE: Passenger wymaga zeby ta aplikacja NIE wywolywala app.listen().
 * Passenger sam binduje Express app do socketu.
 * Plik MUSI uzyc require() (CommonJS) bo Passenger nie radzi sobie z ES modules.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');

// =============================================
// Zaladuj zmienne srodowiskowe
// =============================================
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  // dotenv moze nie byc - env vars z .htaccess SetEnv powinny wystarczyc
}

// =============================================
// Laduj Express serwer (ES module) dynamicznie
// =============================================

// Passenger na cPanel wymaga SYNCHRONICZNEGO exportu HTTP servera.
// Poniewaz server.js to ES module (import/export) - musimy go ladowac asynchronicznie.
// Rozwiazanie: tworzymy HTTP server natychmiast, a Express podlaczamy po zaladowaniu.

let expressApp = null;

// Natychmiastowy handler HTTP - do momentu zaladowania Express
function requestHandler(req, res) {
  if (expressApp) {
    // Express zaladowany - deleguj
    return expressApp(req, res);
  }

  // Express jeszcze nie zaladowany - serwuj statyczne pliki lub czekaj
  const urlPath = req.url.split('?')[0];
  const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);

  // Nie serwuj wrazliwych plikow
  const forbidden = ['.env', 'server.js', 'server-prod.js', 'app.js', 'db.js', 'package.json'];
  if (forbidden.some(f => filePath.endsWith(f))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.json': 'application/json',
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback - serwuj index.html
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Sierra Zulu - Serwer uruchamia sie...</h1><p>Odswierz strone za kilka sekund.</p>');
    }
  }
}

// Stworz HTTP server natychmiast (Passenger tego wymaga)
const server = http.createServer(requestHandler);

// Zaladuj Express asynchronicznie w tle
import('./server.js')
  .then((mod) => {
    expressApp = mod.default;
    console.log('Express app loaded successfully');
  })
  .catch((err) => {
    console.error('Failed to load Express app:', err);
  });

// Eksportuj server dla Passenger
// Passenger szuka `module.exports` jako obiektu HTTP server LUB Express app
module.exports = server;
