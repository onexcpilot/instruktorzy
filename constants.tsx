
import React from 'react';

export const ADMIN_EMAIL = 'kontakt@sierrazulu.waw.pl';
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const AVIATION_LAW_SUMMARY = {
  title: "Podstawy Prawne i Wymagania (Preambuła)",
  sections: [
    {
      title: "Rozporządzenie Komisji (UE) nr 1178/2011 (Part-FCL)",
      content: "Każdy instruktor (FI/CRI/IRI) musi posiadać ważną licencję pilota z odpowiednimi uprawnieniami adekwatnymi do prowadzonego szkolenia. Obowiązkiem instruktora jest monitorowanie ważności uprawnień i badań lekarskich."
    },
    {
      title: "Załącznik VIII (Part-DTO)",
      content: "Zgodnie z DTO.GEN.210, organizacja musi prowadzić wykaz personelu. DTO.GEN.230 nakłada obowiązek przechowywania dokumentacji instruktora przez okres 5 lat od daty zakończenia współpracy."
    },
    {
      title: "Odpowiedzialność Instruktora",
      content: "Instruktor odpowiada za utrzymywanie ważności swoich uprawnień i badań oraz niezwłoczne informowanie DTO o ich utracie, zawieszeniu lub ograniczeniu."
    }
  ]
};

export const DOCUMENT_LABELS: Record<string, string> = {
  medical: "Orzeczenie Lotniczo-Lekarskie",
  license: "Licencja Pilota (FI/IRI/CRI)",
  logbook: "Książka Lotów (Ostatnie 3 strony)",
  id: "Dokument Tożsamości",
  radio: "Uprawnienia Radiowe",
  contract: "Umowa o współpracę / RODO"
};

// Progi powiadomien o wygasajacych dokumentach (w dniach)
export const NOTIFICATION_THRESHOLDS = {
  INFO: 90,       // 90 dni - informacja
  WARNING: 30,    // 30 dni - ostrzezenie
  CRITICAL: 7,    // 7 dni - krytyczne
  EXPIRED: 0      // wygaslo
} as const;

// Typy dokumentow ktore maja daty waznosci i wymagaja monitorowania
export const EXPIRY_TRACKED_TYPES: string[] = ['medical', 'license', 'radio', 'id'];

// Konfiguracja nadawcy powiadomien
export const NOTIFICATION_SENDER = 'kontakt@sierrazulu.waw.pl';
export const APP_URL = 'https://instruktor.sierrazulu.waw.pl';
