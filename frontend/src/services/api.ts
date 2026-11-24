const API_BASE = 'http://localhost:5000/api';

export const api = {
  async getStats() {
    const res = await fetch(`${API_BASE}/stats`);
    return res.json();
  },

  async getEmails(status?: string, query?: string) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (query) params.append('query', query);
    const res = await fetch(`${API_BASE}/emails?${params.toString()}`);
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
    const res = await fetch(`${API_BASE}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async parseRecipientsFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/parse-recipients`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  },

  async cancelEmail(id: string) {
    const res = await fetch(`${API_BASE}/emails/${id}/cancel`, {
      method: 'POST',
    });
    return res.json();
  },

  async getSlackStatus() {
    const res = await fetch(`${API_BASE}/slack/status`);
    return res.json();
  },

  async connectSlack(webhookUrl: string, channel?: string) {
    const res = await fetch(`${API_BASE}/slack/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, channel }),
    });
    return res.json();
  },

  async disconnectSlack() {
    const res = await fetch(`${API_BASE}/slack/disconnect`, {
      method: 'POST',
    });
    return res.json();
  },
};
