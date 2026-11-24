import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { EmailTable } from './components/EmailTable';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { LoginModal } from './components/LoginModal';
import { EmailItem, DashboardStats, SenderOption, UserProfile } from './types';
import { api } from './services/api';
import { Calendar, CheckCircle2, Sliders, Shield, Zap } from 'lucide-react';

export function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('reachinbox_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [senders, setSenders] = useState<SenderOption[]>([]);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [isSlackOpen, setIsSlackOpen] = useState<boolean>(false);
  const [slackConnected, setSlackConnected] = useState<boolean>(false);

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, emailRes, slackRes] = await Promise.all([
        api.getStats(),
        api.getEmails(activeTab, searchQuery),
        api.getSlackStatus(),
      ]);

      if (statsRes.success) {
        setStats(statsRes.stats);
        setSenders(statsRes.senders || []);
      }
      if (emailRes.success) {
        setEmails(emailRes.emails || []);
      }
      if (slackRes) {
        setSlackConnected(!!slackRes.connected);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    fetchData();
    // Auto refresh every 5 seconds for live queue tracking
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleLogout = () => {
    localStorage.removeItem('reachinbox_user');
    setUser(null);
  };

  const handleCancelEmail = async (id: string) => {
    try {
      await api.cancelEmail(id);
      fetchData();
    } catch (err) {
      console.error('Failed to cancel email:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <Header
        user={user}
        onLogout={handleLogout}
        slackConnected={slackConnected}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        onOpenCompose={() => setIsComposeOpen(true)}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards Banner */}
        <StatsOverview stats={stats} />

        {/* Sender Quota & Concurrency Insight Bar */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-400" /> Multi-Sender Quota Monitor:
            </span>
            <div className="flex items-center gap-4 flex-wrap">
              {senders.map((s) => (
                <div key={s.id} className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-300 font-medium">{s.display_name.split(' ')[0]}:</span>
                  <span className="font-mono text-indigo-300 font-semibold">{s.hourlyUsage}</span>
                  <span className="text-slate-500">/{s.hourlyLimit} hr</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Worker Queue Alive & Safe</span>
          </div>
        </div>

        {/* Tabs & Table Container */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === 'scheduled'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Scheduled Emails</span>
                {stats && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'scheduled' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'}`}>
                    {stats.scheduled}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('sent')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === 'sent'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sent Emails</span>
                {stats && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'sent' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800 text-slate-400'}`}>
                    {stats.sent}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Email Records Table */}
          <EmailTable
            emails={emails}
            type={activeTab}
            loading={loading}
            onRefresh={fetchData}
            onCancel={handleCancelEmail}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        <p>ReachInbox Engineering Hiring Assignment • Production-grade Email Scheduler & Dashboard</p>
      </footer>

      {/* Google Login Prompt (if logged out) */}
      {!user && <LoginModal onLoginSuccess={(u) => setUser(u)} />}

      {/* Compose Sequence Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={fetchData}
        senders={senders}
      />

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        slackConnected={slackConnected}
        onStatusChange={fetchData}
      />
    </div>
  );
}

export default App;
