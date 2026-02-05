# ⚠️ UWAGI BEZPIECZEŃSTWA

## Status: Demo/Development

Ta aplikacja zawiera uproszczone rozwiązania bezpieczeństwa dla fazy demonstracji. Przed wdrożeniem w produkcji wykonaj poniższe:

## 🔴 KRYTYCZNE - WYKONAJ NATYCHMIAST

### 1. Zmiana domyślnego hasła administratora
- Plik: `services/mockDb.ts`
- Wiersz: `password: hashPassword('ChanceAdminPassword123!')`
- **Zmień 'ChanceAdminPassword123!' na bezpieczne hasło o minimum 12 znakach**

### 2. Haszowanie haseł
- Aktualnie: Prosty hash dla demonstracji
- Wymagane: Implementuj `bcrypt` lub `argon2`
```bash
npm install bcrypt
```

### 3. EmailJS klucze na serwerze
- Nie przechowuj kluczy w localStorage
- Przenies integrację emailjs na Node.js backend
- Klusze przechowuj w zmiennych środowiskowych

## 🟠 WYSOKIE PRIORYTETY

### 4. Backend API
- Aktualnie: localStorage (nie bezpieczne dla produkcji)
- Wymagane: Node.js/Express backend z:
  - JWT authentication
  - Password hashing
  - HTTPS only
  - CORS configuraton

### 5. Przechowywanie plików
- Aktualnie: `URL.createObjectURL()` - tymczasowy
- Wymagane: Upload na serwer (S3/Cloud Storage)
- Dodaj skanowanie antywirusowe

### 6. Rate limiting
```typescript
// Dodaj do backendu
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5 // max 5 loginów na 15 min
});
```

## 🟡 ŚREDNIE PRIORYTETY

7. **CSRF Protection** - Dodaj CSRF token do formularzy
8. **Input Validation** - Server-side walidacja wszystkich inputów
9. **Logging** - Rejestruj wszystkie loginy i zmiany danych
10. **Backup** - Regularne backupy bazy danych

## Checklist Przed Produkcją

- [ ] Zmieniono hasło admina
- [ ] Implementacja bcrypt/argon2
- [ ] Backend API z JWT
- [ ] Klucze EmailJS na serwerze
- [ ] HTTPS certificate
- [ ] Rate limiting
- [ ] CSRF protection
- [ ] Input validation server-side
- [ ] Logging system
- [ ] Backup strategy
- [ ] Penetration test
- [ ] GDPR compliance (zapisywanie danych instruktorów)

## Testy Bezpieczeństwa

```bash
# Zainstaluj OWASP ZAP
# https://www.zaproxy.org/

# Lub użyj Burp Suite Community
# https://portswigger.net/burp/community

# Skanuj aplikację:
npm run build
npm run preview
# Otwie portal w przeglądarce i uruchom skan
```

## Kontakt

Dla pytań bezpieczeństwa: security@sierrazulu.pl
