# ✈️ SIERRA ZULU PORTAL - FINALNA INSTRUKCJA

## 📋 Stan Aplikacji

```
✅ Kod naprawiony i zoptymalizowany
✅ TypeScript bez błędów kompilacji
✅ Bezpieczeństwo podstawowe implementowane
✅ Dokumentacja kompletna
✅ Git repozytorium skonfigurowane
✅ Gotowe do wersjonowania
```

---

## 🎯 SZYBKI START

### 1. Uruchom aplikację lokalnie

```powershell
cd "c:\Users\onexc\Desktop\Aplikacja Instruktorzy"
npm install
npm run dev
```

Otwórz: http://localhost:5173

### 2. Zaloguj się

- **Email**: onexcpilot@gmail.com
- **Hasło**: Zmień go! (patrz sekcja poniżej)

### 3. Zmień domyślne hasło administratora

⚠️ **KRYTYCZNE - RÓB TO NATYCHMIAST!**

- Otwórz: `services/mockDb.ts`
- Znajdź: `hashPassword('ChanceAdminPassword123!')`
- Zamień na: `hashPassword('TwojeBezpieczeHaslo123!')`
  - Min. 12 znaków
  - Mix: wielkie/małe litery, cyfry, znaki specjalne

Przykład:
```typescript
// PRZED:
password: hashPassword('ChanceAdminPassword123!')

// APRÈS:
password: hashPassword('MotorM3-SierraZulu2026!')
```

Następnie:
```powershell
git add services/mockDb.ts
git commit -m "security: Updated admin password"
```

---

## 🚀 ZAŁADOWANIE NA GITHUB

### Krok 1: Utwórz repozytorium

Przejdź na https://github.com/new i stwórz repo:
- Nazwa: `sierra-zulu-portal`
- **Private**: ✅ TAK (dane instruktorów!)
- Skopiuj URL (np. https://github.com/xxx/sierra-zulu-portal.git)

### Krok 2: Push kodu

```powershell
cd "c:\Users\onexc\Desktop\Aplikacja Instruktorzy"

# Dodaj remote
git remote add origin https://github.com/TWOJA_NAZWA/sierra-zulu-portal.git

# Zmień branch na main
git branch -M main

# Push
git push -u origin main
```

Jeśli poprosi o hasło - użyj **Personal Access Token** (instrukcja w `GITHUB_SETUP.md`)

### Krok 3: Weryfikacja

Przejdź na GitHub i sprawdź czy kod się przesłał ✅

---

## 📚 DOKUMENTACJA

Wszystko wyjaśnione w następujących plikach:

| Plik | Dla kogo | Zawartość |
|------|----------|-----------|
| **README_PL.md** | Każdego | Jak uruchomić, features, stack tech |
| **SECURITY.md** | Dev/Ops | Co naprawić w produkcji - PRZECZYTAJ! |
| **GITHUB_SETUP.md** | Dev | Step-by-step: GitHub setup |
| **CHANGES_SUMMARY.md** | PM/Lead | Podsumowanie zmian i TODO |

---

## 🧪 TESTY FUNKCJONALNOŚCI

Po wdrożeniu sprawdź:

- [ ] Login admin: email + hasło (zmienione)
- [ ] Login admin: Google OAuth (jeśli VITE_GOOGLE_CLIENT_ID ustawione)
- [ ] Panel admin: Zaproszenie instruktora
- [ ] Upload dokumentu: max 3 pliki, 10MB
- [ ] Zmiana hasła: min 8 znaków
- [ ] Synchronizacja Google Calendar (jeśli EmailJS ustawiony)

---

## 🔐 BEZPIECZEŃSTWO - CHECKLIST

### Development (teraz OK ✅):
- [x] Hashing haseł (prosty SHA - dla demo)
- [x] Walidacja email
- [x] Walidacja plików (MIME type)
- [x] Error handling
- [x] TypeScript typy

### Produkcja (TODO 🔴):
- [ ] Zmienić hasło administratora
- [ ] Implementacja bcrypt (nie SHA!)
- [ ] Backend API (Node/Express)
- [ ] JWT authentication
- [ ] HTTPS certificate
- [ ] Secure file upload (S3/Cloud)
- [ ] EmailJS klucze na serwerze
- [ ] Rate limiting
- [ ] GDPR compliance
- [ ] Security audit

Szczegóły: [SECURITY.md](./SECURITY.md)

---

## 📦 BUILD & DEPLOYMENT

### Lokalne testowanie

```powershell
npm run build
npm run preview
# Otwórz http://localhost:4173
```

### Deploy na Vercel (rekomendowany)

1. Zaloguj się na https://vercel.com
2. Kliknij "Add New Project"
3. Wybierz repo z GitHub
4. Kliknij "Deploy"

Aplikacja będzie dostępna w ~2 minuty!

Alternatywa: Netlify, GitHub Pages, własny serwer

---

## 🗂️ STRUKTURA PROJEKTU

```
sierra-zulu-portal/
├── src/
│   ├── App.tsx              ← Główny komponent
│   ├── types.ts             ← Interfejsy TypeScript
│   ├── constants.tsx        ← Stałe aplikacji
│   ├── components/
│   │   ├── DocumentUpload.tsx
│   │   └── LawSummary.tsx
│   └── services/
│       └── mockDb.ts        ← Baza danych (localStorage)
├── dist/                    ← Build production
├── README_PL.md            ← Instrukcja (PL)
├── SECURITY.md             ← Bezpieczeństwo
├── GITHUB_SETUP.md         ← GitHub instrukcja
├── CHANGES_SUMMARY.md      ← Podsumowanie zmian
└── package.json            ← Dependencje
```

---

## 🔄 WORKFLOW GIT

Dla każdej nowej zmiany:

```powershell
# 1. Utwórz nową gałąź (feature branch)
git checkout -b feature/nazwa-funkcji

# 2. Dokonaj zmian w kodzie

# 3. Dodaj i commituj
git add .
git commit -m "feat: opis co zmieniłeś"

# 4. Push do GitHub
git push origin feature/nazwa-funkcji

# 5. Utwórz Pull Request na GitHub

# 6. Po review - merge na main
git checkout main
git pull
git merge feature/nazwa-funkcji
```

---

## 💡 TIPS & TRICKS

### EmailJS Setup
```
1. Zarejestruj: https://emailjs.com
2. Settings → API Keys
3. Skopiuj: Service ID, Template ID, Public Key
4. W app → Ustawienia → wklej dane
```

### Google OAuth Setup
```
1. Google Cloud: https://console.cloud.google.com
2. Utwórz projekt
3. OAuth 2.0 → Web application
4. Autoryzowane URI: http://localhost:5173
5. Skopiuj Client ID
6. .env.local: VITE_GOOGLE_CLIENT_ID=xxx
```

### Resetowanie bazy (dev)
```powershell
# W DevTools Console:
localStorage.removeItem('sierra_zulu_db_v1')
location.reload()
```

---

## 🆘 PROBLEMY?

### "Cannot find module react"
```powershell
npm install
npm install --save-dev @types/react @types/react-dom
```

### "Google is not defined"
- Sprawdź czy załadowała się `google-accounts-id` biblioteka
- Czekaj ~500ms zanim kliknie guzik logowania

### "Application not building"
```powershell
npm run build
# Sprawdź output dla błędów
```

### Git: "fatal: 'origin' does not appear..."
```powershell
git remote add origin https://github.com/xxx/sierra-zulu-portal.git
git push -u origin main
```

---

## 📞 KONTAKT & SUPPORT

- 📧 Email: onexcpilot@gmail.com
- 🌐 Website: https://sierrazulu.waw.pl
- 📱 Phone: +48 XXXX XXXXXX

---

## ✨ GRATULACJE!

Aplikacja Sierra Zulu Portal jest teraz:
- ✅ Kodowo czysty i typizowany
- ✅ Bezpieczny (dla development)
- ✅ Wersjonowany w Git
- ✅ Gotowy do GitHub
- ✅ Gotowy do deployment

Następnym krokiem: wdrażaj do produkcji zgodnie z `SECURITY.md`

---

**Wersja**: 0.1.0
**Data**: 5 lutego 2026
**Status**: Ready for version control ✅

Powodzenia! ✈️🛩️
