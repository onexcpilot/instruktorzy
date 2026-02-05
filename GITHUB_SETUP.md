# 🚀 INSTRUKCJA: Załadowanie do GitHub

## Krok 1: Utwórz nowe repozytorium na GitHub

1. Przejdź na https://github.com/new
2. Zaloguj się do swojego konta GitHub (jeśli nie masz - załóż)
3. Wypełnij dane:
   - **Repository name**: `sierra-zulu-portal` (lub inną nazwę)
   - **Description**: "Aviation Instructor Portal - Document Management"
   - **Private**: ✅ Zaznacz (dane instruktorów są wrażliwe!)
   - **Add .gitignore**: NIE zaznaczaj (już mamy)
   - **License**: MIT (opcjonalnie)
4. Kliknij **Create repository**

## Krok 2: Pozyskaj URL repozytorium

Po kliknięciu "Create" zobaczysz instrukcje. Skopiuj URL typu:
```
https://github.com/twojanazwa/sierra-zulu-portal.git
```

## Krok 3: Dodaj remote i push do GitHub

W terminalu VS Code (PowerShell), w folderze aplikacji:

```powershell
cd "c:\Users\onexc\Desktop\Aplikacja Instruktorzy"

# Dodaj remote URL
git remote add origin https://github.com/TWOJA_NAZWA/sierra-zulu-portal.git

# Zmień główną gałąź na main (jeśli potrzeba)
git branch -M main

# Push kodu do GitHub
git push -u origin main
```

## Krok 4: Generuj Personal Access Token (jeśli wymagane)

Jeśli GitHub żąda autoryzacji:

1. Przejdź na https://github.com/settings/tokens/new
2. Ustawienia:
   - **Note**: `sierra-zulu-push`
   - **Expiration**: 90 days
   - **Select scopes**: ✅ `repo` (pełny dostęp do repozytoriów)
3. Kliknij **Generate token**
4. **Skopiuj token** (pokazuje się tylko raz!)
5. W terminalu, gdy poprosi o hasło, wklej token

## Krok 5: Weryfikacja

Sprawdź na GitHub czy kod się przesłał:
- Przejdź na https://github.com/twojaname/sierra-zulu-portal
- Powinieneś zobaczyć wszystkie pliki

## 📋 Checklist Bezpieczeństwa Git

- [ ] Repozytorium jest **PRIVATE**
- [ ] Plik `.gitignore` zawiera `node_modules/`
- [ ] Brak pliku `.env` lub `.env.local` w repozytorium
- [ ] Żaden plik z hasłami nie jest commitowany
- [ ] SECURITY.md jest commited (instrukcje dla zespołu)

## 🔄 Przyszłe Aktualizacje

Po zmianach w kodzie:

```powershell
# Dodaj zmienione pliki
git add -A

# Commit ze opisem zmian
git commit -m "Opis zmiany - co zmieniłeś?"

# Push do GitHub
git push
```

## Przykład zmiany:

```powershell
git add -A
git commit -m "feat: Added password strength meter"
git push
```

## 🆘 Rozwiązywanie Problemów

### Problem: "fatal: 'origin' does not appear to be a 'git' repository"

```powershell
# Sprawdź config
git config --list

# Usuń błędny remote
git remote remove origin

# Dodaj poprawny URL
git remote add origin https://github.com/TWOJA_NAZWA/sierra-zulu-portal.git
```

### Problem: "Authentication failed"

1. Generuj nowy token: https://github.com/settings/tokens/new
2. Zamiast hasła użyj tokenu
3. Lub skonfiguruj SSH key

### Problem: "Updates were rejected"

```powershell
# Pobierz ostatnie zmiany
git pull origin main

# Spróbuj znowu
git push origin main
```

## 📚 Przydatne Komendy Git

```powershell
# Sprawdź status
git status

# Historia commitów
git log --oneline

# Ostatnie zmiany
git diff

# Utwórz nową gałąź (do nowych features)
git checkout -b feature/nazwa-funkcji

# Zmień na main
git checkout main

# Usuń lokalną gałąź
git branch -d nazwa-galezi
```

## ✅ Gotowe!

Twój kod jest teraz bezpiecznie przechowywany na GitHub z pełną historią zmian.

Możesz teraz:
- 👥 Zapraszać współpracowników
- 🔄 Śledzić zmiany (commits)
- 🐛 Reportować problemy (Issues)
- 🔀 Pracować na gałęziach (Branches)
- 🚀 Wdrażać za pomocą GitHub Actions

---

**Pytania?** Sprawdź: https://docs.github.com/en/get-started
