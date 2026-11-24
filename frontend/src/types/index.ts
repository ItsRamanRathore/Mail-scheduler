export interface EmailItem {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  scheduled_at: number;
  sent_at?: number | null;
  status: 'scheduled' | 'sent' | 'failed' | 'rescheduled';
  job_id?: string;
  preview_url?: string;
  error_message?: string;
}

export interface SenderOption {
  id: string;
  email: string;
  display_name: string;
  hourlyUsage: number;
  hourlyLimit: number;
}

export interface DashboardStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
  workerConcurrency: number;
  maxEmailsPerHour: number;
  maxEmailsPerHourPerSender: number;
  minDelayBetweenEmailsMs: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  tenantId: string;
}
