# Sierra Zulu - Portal Instruktorów

![Aviation Portal](https://sierrazulu.waw.pl/wp-content/uploads/2025/03/Podnagloweklustrzane1.png)

Aplikacja webowa do zarządzania danymi instruktorów w szkole latania.

## 🎯 Funkcjonalność

- ✈️ **Zarządzanie dokumentami** - Przechowywanie i śledzenie ważności dokumentów
- 👥 **Panel administratora** - Zaproszenia instruktorów, zarządzanie bazą
- 📅 **Synchronizacja Google Calendar** - Powiadomienia o wygasających dokumentach
- 📧 **Integracja EmailJS** - Wysyłka zaproszeń instruktorom
- 🔒 **Logowanie** - Obsługa Google OAuth i email/hasło

## 📋 Wymagane dokumenty

Dla każdego instruktora:
1. Orzeczenie Lotniczo-Lekarskie
2. Licencja Pilota (FI/IRI/CRI)
3. Książka Lotów (ostatnie 3 strony)
4. Dokument Tożsamości
5. Uprawnienia Radiowe
6. Umowa o współpracę / RODO

## 🚀 Szybki Start

### Wymagania
- Node.js 16+
- npm 7+

### Instalacja
```bash
npm install
```

### Development
```bash
npm run dev
```
Portal dostępny: http://localhost:5173

### Build
```bash
npm run build
npm run preview
```

## 🔐 Logowanie

### Admin (Demo)
- Email: `onexcpilot@gmail.com`
- Hasło: **Zmień w `SECURITY.md`** ⚠️

### Instruktor
- Zaproś przez panel admin (potrzebujesz skonfigurowania EmailJS)
- Lub zaloguj się bezpośrednio email/hasło

### Google OAuth
- Wymaga zmiennej `VITE_GOOGLE_CLIENT_ID` w `.env.local`

## ⚙️ Konfiguracja

### EmailJS (Wysyłka zaproszęń)
1. Zarejestruj się na https://emailjs.com
2. Przejdź do Settings -> API Keys
3. W aplikacji (Ustawienia) wklej:
   - Service ID
   - Template ID
   - Public Key

**⚠️ W produkcji przechowuj klucze na serwerze!**

### Google OAuth
1. Przejdź do https://console.cloud.google.com
2. Utwórz nowy projekt
3. Włącz Google+ API
4. Utwórz OAuth 2.0 klucz (Web application)
5. Dodaj URI: `http://localhost:5173`
6. Utwórz `.env.local`:
```
VITE_GOOGLE_CLIENT_ID=twoj_client_id_tutaj
```

## 📁 Struktura Projektu

```
src/
├── components/
│   ├── DocumentUpload.tsx    # Upload dokumentów
│   └── LawSummary.tsx        # Info prawne
├── services/
│   └── mockDb.ts             # Baza danych (localStorage)
├── App.tsx                   # Główny komponent
├── types.ts                  # TypeScript interfejsy
├── constants.tsx             # Stałe aplikacji
├── index.tsx                 # Entry point
└── index.html
```

## 🔄 Przepływ danych

```
localStorage (DB)
    ↓
components (UI)
    ↓
services/mockDb.ts (logika)
    ↓
EmailJS / Google APIs (integracje)
```

## ⚠️ WAŻNE - BEZPIECZEŃSTWO

**Ta aplikacja jest na etapie demonstracji. Przed produkcją:**

1. ✅ Zmień domyślne hasło administratora
2. ✅ Przejrzyj `SECURITY.md`
3. ✅ Implementuj backend API
4. ✅ Dodaj haszowanie haseł (bcrypt)
5. ✅ Przenieś EmailJS na serwer
6. ✅ Dodaj HTTPS i JWT authentication

Szczegóły: [SECURITY.md](./SECURITY.md)

## 🛠️ Stack Technologiczny

- React 19.2.4
- TypeScript 5.8
- Tailwind CSS
- Vite 6.2
- FontAwesome 6.x

## 📄 Licencja

Proprietary - Sierra Zulu

## 📧 Kontakt

support@sierrazulu.waw.pl

---

**Ostatnia aktualizacja:** Luty 2026
**Wersja:** 0.1.0 (Demo)
