-- =============================================
-- Sierra Zulu Portal - Schemat bazy danych
-- Baza: dm75078_instruktor
-- Wklej ten plik w phpMyAdmin -> zakladka SQL
-- =============================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Tabela uzytkownikow (admin + instruktorzy)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'INSTRUCTOR') NOT NULL DEFAULT 'INSTRUCTOR',
  license_number VARCHAR(100) DEFAULT NULL,
  is_invited TINYINT(1) NOT NULL DEFAULT 0,
  last_login DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela dokumentow
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type ENUM('medical', 'license', 'logbook', 'id', 'radio', 'contract') NOT NULL,
  expiry_date DATE DEFAULT NULL,
  issue_date DATE DEFAULT NULL,
  upload_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('valid', 'expired', 'pending_review') NOT NULL DEFAULT 'pending_review',
  is_archived TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela zalacznikow (pliki skanow)
CREATE TABLE IF NOT EXISTS document_attachments (
  id VARCHAR(36) PRIMARY KEY,
  document_id VARCHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT NOT NULL DEFAULT 0,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(100) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela zaproszen
CREATE TABLE IF NOT EXISTS invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  invited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela logu powiadomien
CREATE TABLE IF NOT EXISTS notification_log (
  id VARCHAR(36) PRIMARY KEY,
  alert_level ENUM('info', 'warning', 'critical', 'expired') NOT NULL,
  instructor_email VARCHAR(255) NOT NULL,
  instructor_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  expiry_date DATE NOT NULL,
  days_remaining INT NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_sent TINYINT(1) NOT NULL DEFAULT 0,
  error_message TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indeksy dla wydajnosci
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_expiry ON documents(expiry_date);
CREATE INDEX idx_documents_status ON documents(status, is_archived);
CREATE INDEX idx_attachments_doc ON document_attachments(document_id);
CREATE INDEX idx_notification_date ON notification_log(sent_at);
CREATE INDEX idx_notification_email ON notification_log(instructor_email, sent_at);

-- =============================================
-- Admin domyslny
-- Haslo: TwojeBezpieczeHaslo123! (bcrypt hash)
-- ZMIEN HASLO PO PIERWSZYM LOGOWANIU!
-- =============================================
-- Haslo zostanie ustawione przez serwer przy pierwszym uruchomieniu (bcrypt)
-- Na razie wstawiamy placeholder - serwer go nadpisze
INSERT INTO users (id, email, password, full_name, role, is_invited)
VALUES (
  'admin_1',
  'kontakt@sierrazulu.waw.pl',
  '$PLACEHOLDER_WILL_BE_SET_BY_SERVER$',
  'Administrator',
  'ADMIN',
  0
) ON DUPLICATE KEY UPDATE id=id;
