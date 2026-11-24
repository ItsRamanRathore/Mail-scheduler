const API_BASE = import.meta.env.DEV
  ? 'http://localhost:5000/api'
  : import.meta.env.VITE_API_BASE_URL;
const SESSION_KEY = 'reachinbox-admin-session';

function apiUrl(path: string) {
  if (!API_BASE) {
    throw new Error('Set VITE_API_BASE_URL to the Railway API URL ending in /api.');
  }
  return `${API_BASE}${path}`;
}

function authorizedFetch(path: string, init: RequestInit = {}) {
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) {
    throw new Error('Sign in with the scheduler admin password to continue.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(apiUrl(path), { ...init, headers });
}

export const api = {
  async login(password: string) {
    const response = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const result = await response.json() as { token?: string; error?: string };
    if (!response.ok || !result.token) {
      throw new Error(result.error || 'Sign-in failed.');
    }

    sessionStorage.setItem(SESSION_KEY, result.token);
    return { name: 'Scheduler Admin', email: 'Admin', avatar: '', tenantId: 'admin' };
  },

  async verifyAuth() {
    return await authorizedFetch('/auth');
  },

  hasSession() {
    return Boolean(sessionStorage.getItem(SESSION_KEY));
  },

  getSessionUser() {
    return { name: 'Scheduler Admin', email: 'Admin', avatar: '', tenantId: 'admin' };
  },

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
