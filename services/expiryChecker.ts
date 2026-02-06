import { User, UserRole, DocumentRecord, ExpiryAlert, NotificationLevel, NotificationRecord, NotificationLog } from '../types';
import { NOTIFICATION_THRESHOLDS, EXPIRY_TRACKED_TYPES, DOCUMENT_LABELS } from '../constants';

const NOTIFICATION_LOG_KEY = 'sierra_zulu_notifications';

/**
 * Oblicza liczbe dni do wygasniecia dokumentu
 */
export const getDaysUntilExpiry = (expiryDate: string): number => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Okresla poziom alertu na podstawie liczby dni do wygasniecia
 */
export const getAlertLevel = (daysRemaining: number): NotificationLevel => {
  if (daysRemaining <= NOTIFICATION_THRESHOLDS.EXPIRED) return 'expired';
  if (daysRemaining <= NOTIFICATION_THRESHOLDS.CRITICAL) return 'critical';
  if (daysRemaining <= NOTIFICATION_THRESHOLDS.WARNING) return 'warning';
  if (daysRemaining <= NOTIFICATION_THRESHOLDS.INFO) return 'info';
  return 'info'; // dalej niz 90 dni - brak alertu (filtrowane wyzej)
};

/**
 * Zwraca kolor CSS dla poziomu alertu
 */
export const getAlertColor = (level: NotificationLevel): { bg: string; text: string; border: string; badge: string } => {
  switch (level) {
    case 'expired':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-600' };
    case 'critical':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-500' };
    case 'warning':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-500' };
    case 'info':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-500' };
  }
};

/**
 * Zwraca etykiete alertu po polsku
 */
export const getAlertLabel = (level: NotificationLevel): string => {
  switch (level) {
    case 'expired': return 'WYGASLO';
    case 'critical': return 'KRYTYCZNE';
    case 'warning': return 'OSTRZEZENIE';
    case 'info': return 'INFORMACJA';
  }
};

/**
 * Aktualizuje status dokumentu na podstawie daty waznosci
 */
export const computeDocumentStatus = (doc: DocumentRecord): DocumentRecord['status'] => {
  if (!doc.expiryDate) return doc.status === 'pending_review' ? 'pending_review' : 'valid';
  const days = getDaysUntilExpiry(doc.expiryDate);
  if (days <= 0) return 'expired';
  return doc.status === 'pending_review' ? 'pending_review' : 'valid';
};

/**
 * Skanuje wszystkich instruktorow i zwraca liste alertow o wygasajacych dokumentach
 */
export const scanAllExpiries = (users: User[]): ExpiryAlert[] => {
  const alerts: ExpiryAlert[] = [];

  const instructors = users.filter(u => u.role === UserRole.INSTRUCTOR);

  for (const instructor of instructors) {
    const activeDocs = instructor.documents.filter(d => !d.isArchived);

    for (const doc of activeDocs) {
      // Sprawdzaj tylko dokumenty z data waznosci i sledzonych typow
      if (!doc.expiryDate || !EXPIRY_TRACKED_TYPES.includes(doc.type)) continue;

      const daysRemaining = getDaysUntilExpiry(doc.expiryDate);

      // Generuj alert jesli mniej niz 90 dni do wygasniecia
      if (daysRemaining <= NOTIFICATION_THRESHOLDS.INFO) {
        alerts.push({
          instructorId: instructor.id,
          instructorName: instructor.fullName,
          instructorEmail: instructor.email,
          documentId: doc.id,
          documentName: doc.name || DOCUMENT_LABELS[doc.type] || doc.type,
          documentType: doc.type,
          expiryDate: doc.expiryDate,
          daysRemaining,
          level: getAlertLevel(daysRemaining),
        });
      }
    }
  }

  // Sortuj: najwazniejsze najpierw (wygasle -> krytyczne -> ostrzezenia -> info)
  const levelOrder: Record<NotificationLevel, number> = { expired: 0, critical: 1, warning: 2, info: 3 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level] || a.daysRemaining - b.daysRemaining);

  return alerts;
};

/**
 * Zwraca alerty dla konkretnego instruktora
 */
export const getInstructorAlerts = (user: User): ExpiryAlert[] => {
  return scanAllExpiries([{ ...user, role: UserRole.INSTRUCTOR }]);
};

/**
 * Podsumowanie alertow do wyswietlenia w dashboardzie
 */
export const getAlertsSummary = (alerts: ExpiryAlert[]) => {
  return {
    total: alerts.length,
    expired: alerts.filter(a => a.level === 'expired').length,
    critical: alerts.filter(a => a.level === 'critical').length,
    warning: alerts.filter(a => a.level === 'warning').length,
    info: alerts.filter(a => a.level === 'info').length,
  };
};

// --- Notification Log (localStorage) ---

export const getNotificationLog = (): NotificationLog => {
  const data = localStorage.getItem(NOTIFICATION_LOG_KEY);
  if (!data) return { lastCheckDate: '', notifications: [] };
  return JSON.parse(data);
};

export const saveNotificationLog = (log: NotificationLog) => {
  localStorage.setItem(NOTIFICATION_LOG_KEY, JSON.stringify(log));
};

export const addNotificationRecord = (record: NotificationRecord) => {
  const log = getNotificationLog();
  log.notifications.unshift(record); // najnowsze na poczatku
  // Trzymaj max 200 rekordow
  if (log.notifications.length > 200) {
    log.notifications = log.notifications.slice(0, 200);
  }
  log.lastCheckDate = new Date().toISOString();
  saveNotificationLog(log);
};

/**
 * Sprawdza czy dane powiadomienie bylo juz wyslane tego samego dnia
 * (zeby nie spamowac wielokrotnie)
 */
export const wasNotificationSentToday = (instructorEmail: string, documentType: string, level: NotificationLevel): boolean => {
  const log = getNotificationLog();
  const today = new Date().toISOString().split('T')[0];
  return log.notifications.some(n =>
    n.instructorEmail === instructorEmail &&
    n.documentType === documentType &&
    n.alertLevel === level &&
    n.sentAt.startsWith(today) &&
    n.emailSent
  );
};
