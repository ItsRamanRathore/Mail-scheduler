import { auth } from '../firebase';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

async function authorizedFetch(path: string, init: RequestInit = {}) {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error('Sign in with an authorized Google account to use the scheduler.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export const api = {
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
