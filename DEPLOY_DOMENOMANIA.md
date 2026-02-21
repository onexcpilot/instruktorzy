# Deploy na Domenomanii - Instrukcja

## Struktura na serwerze

Katalog: `/home/dm75078/instruktor.sierrazulu.waw.pl/`

```
instruktor.sierrazulu.waw.pl/
  app.js              <-- Passenger startup (CommonJS)
  server.js            <-- Express API (ES module)
  package.json
  .env                 <-- Zmienne srodowiskowe
  .htaccess            <-- Konfiguracja Passenger (wazne: PassengerStartupFile app.js)
  index.html           <-- Zbudowany frontend (z dist/)
  assets/              <-- Zbudowane JS/CSS (z dist/assets/)
  services/
    db.js              <-- Serwis MySQL
  uploads/             <-- Pliki dokumentow (tworzony automatycznie)
  node_modules/        <-- Paczki (npm install)
```

## Krok po kroku

### 1. Panel Node.js App
- Application startup file: `app.js`  (NIE server.js!)
- Application mode: Production
- Node.js version: 22

### 2. .htaccess
Upewnij sie ze linia `PassengerStartupFile` wskazuje na `app.js`:
```
PassengerStartupFile app.js
```

### 3. Wgraj pliki
Pobierz ZIP z GitHub (branch review-instructor-notifications) i wgraj.

### 4. npm install
W panelu Node.js App kliknij "Run NPM Install".

### 5. Restart
Kliknij Restart w panelu Node.js App.

### 6. Haslo admina
- Login: kontakt@sierrazulu.waw.pl
- Haslo domyslne: TwojeBezpieczeHaslo123!
- ZMIEN PO PIERWSZYM LOGOWANIU!
