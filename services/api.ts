/**
 * Sierra Zulu - Frontend API client
 * Zastepuje mockDb (localStorage) wywolaniami REST do Express/MySQL
 */

const API_URL = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// =============================================
// Auth
// =============================================

export interface LoginResult {
  success: boolean;
  user: any;
}

export async function apiLogin(email: string, password: string): Promise<LoginResult> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiChangePassword(userId: string, newPassword: string, currentPassword?: string): Promise<{ success: boolean }> {
  return request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ userId, currentPassword, newPassword }),
  });
}

// =============================================
// Users / Instructors
// =============================================

export async function apiGetUser(userId: string): Promise<any> {
  return request(`/api/users/me/${userId}`);
}

export async function apiGetInstructors(): Promise<any[]> {
  return request('/api/instructors');
}

// =============================================
// Invitations
// =============================================

export interface InviteResult {
  success: boolean;
  email: string;
  tempPass: string;
  emailSent: boolean;
  error?: string;
}

export async function apiInvite(email: string): Promise<InviteResult> {
  return request('/api/invite', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// =============================================
// Documents
// =============================================

export interface UploadDocResult {
  success: boolean;
  documentId: string;
  attachments: any[];
}

export async function apiUploadDocument(
  userId: string,
  name: string,
  type: string,
  expiryDate: string | undefined,
  files: { fileName: string; fileSize: number; fileData: string; mimeType: string }[]
): Promise<UploadDocResult> {
  return request('/api/documents/upload', {
    method: 'POST',
    body: JSON.stringify({ userId, name, type, expiryDate, files }),
  });
}

export async function apiUpdateDocStatus(docId: string, status: string): Promise<{ success: boolean }> {
  return request(`/api/documents/${docId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// =============================================
// Admin
// =============================================

export async function apiAdminResetPassword(userId: string, newPassword: string): Promise<{ success: boolean }> {
  return request('/api/admin/reset-password', {
    method: 'POST',
    body: JSON.stringify({ userId, newPassword }),
  });
}

// =============================================
// Notifications
// =============================================

export async function apiGetAlerts(): Promise<any[]> {
  return request('/api/notifications/alerts');
}

export async function apiSendNotifications(): Promise<any> {
  return request('/api/notifications/check');
}

export async function apiGetNotificationLog(limit = 100): Promise<any[]> {
  return request(`/api/notifications/log?limit=${limit}`);
}

// =============================================
// Health
// =============================================

export async function apiHealthCheck(): Promise<any> {
  return request('/api/health');
}
