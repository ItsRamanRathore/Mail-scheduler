import type { UserProfile } from '../types';

const isPublicDemo = () => {
  const path = window.location.pathname;
  return path === '/demo' || path.startsWith('/demo/');
};
const SESSION_KEY = isPublicDemo() ? 'reachinbox-demo-session' : 'reachinbox-admin-session';

function getApiBase() {
  if (import.meta.env.DEV) return 'http://localhost:5000/api';
  return isPublicDemo()
    ? import.meta.env.VITE_DEMO_API_BASE_URL
    : import.meta.env.VITE_API_BASE_URL;
}

function apiUrl(path: string) {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    throw new Error(isPublicDemo()
      ? 'Set VITE_DEMO_API_BASE_URL to the isolated demo Railway API URL ending in /api.'
      : 'Set VITE_API_BASE_URL to the Railway API URL ending in /api.');
  }
  return `${API_BASE}${path}`;
}

function authorizedFetch(path: string, init: RequestInit = {}) {
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) {
    throw new Error('Sign in to continue.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(apiUrl(path), { ...init, headers });
}

export const api = {
  async login(profileEmail: string, password?: string) {
    const response = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isPublicDemo() ? { profileEmail } : { profileEmail, password }),
    });
    const result = await response.json() as {
      token?: string;
      error?: string;
      user?: UserProfile;
    };
    if (!response.ok || !result.token || !result.user) {
      throw new Error(result.error || 'Sign-in failed.');
    }

    sessionStorage.setItem(SESSION_KEY, result.token);
    return result.user;
  },

  async verifyAuth() {
    const response = await authorizedFetch('/auth');
    const result = await response.json() as { user?: UserProfile; error?: string };
    if (!response.ok || !result.user) {
      throw new Error(result.error || 'Your session is no longer valid.');
    }
    return result.user;
  },

  hasSession() {
    return Boolean(sessionStorage.getItem(SESSION_KEY));
  },

  isPublicDemo,

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },

  async getStats() {
    const res = await authorizedFetch('/stats');
    return res.json();
  },

  async getEmails(status?: string, query?: string) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (query) params.append('query', query);
    const res = await authorizedFetch(`/emails?${params.toString()}`);
    return res.json();
  },

  async scheduleEmails(payload: {
    recipients: string[];
    sender: string;
    subject: string;
    body: string;
    startTime: string;
    delayBetweenSeconds: number;
  }) {
    const res = await authorizedFetch('/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async parseRecipientsFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await authorizedFetch('/parse-recipients', {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  async cancelEmail(id: string) {
    const res = await authorizedFetch(`/emails/${id}/cancel`, {
      method: 'POST',
    });
    return res.json();
  },

  async getSlackStatus() {
    const res = await authorizedFetch('/slack/status');
    return res.json();
  },

  async connectSlack(webhookUrl: string, channel?: string) {
    const res = await authorizedFetch('/slack/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, channel }),
    });
    return res.json();
  },

  async disconnectSlack() {
    const res = await authorizedFetch('/slack/disconnect', {
      method: 'POST',
    });
    return res.json();
  },
};
