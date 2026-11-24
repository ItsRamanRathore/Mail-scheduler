import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { EmailTable } from './components/EmailTable';
import { QueueDashboard } from './components/QueueDashboard';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { LoginModal } from './components/LoginModal';
import { EmailItem, DashboardStats, SenderOption, UserProfile, QueueDetails } from './types';
import { api } from './services/api';
import { Calendar, CheckCircle2, Shield, Layers } from 'lucide-react';

export function App() {
  const publicDemo = api.isPublicDemo();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'queue'>('scheduled');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queueDetails, setQueueDetails] = useState<QueueDetails | null>(null);
  const [senders, setSenders] = useState<SenderOption[]>([]);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [isSlackOpen, setIsSlackOpen] = useState<boolean>(false);
  const [slackConnected, setSlackConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!api.hasSession()) {
      setAuthReady(true);
      return;
    }

    let active = true;
    api.verifyAuth()
      .then((signedInUser) => {
        if (active) setUser(signedInUser);
      })
      .catch((error) => {
        console.error('Failed to validate the saved session:', error);
        api.logout();
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  // Fetch all dashboard data seamlessly without scroll jumping or flashing
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setIsRefreshing(true);
    }
    try {
      const [statsRes, emailRes, slackRes] = await Promise.all([
        api.getStats(),
        api.getEmails(activeTab === 'queue' ? undefined : activeTab, searchQuery),
        publicDemo ? Promise.resolve(null) : api.getSlackStatus(),
      ]);

      if (statsRes.success) {
        setStats(statsRes.stats);
        setQueueDetails(statsRes.queue || null);
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
      setIsInitialLoad(false);
      setIsRefreshing(false);
    }
  }, [activeTab, publicDemo, searchQuery]);

  useEffect(() => {
    if (!authReady || !user) return;
    // Initial fetch
    fetchData(false);

    // Silent background poll that preserves scroll position and never flashes
    const interval = setInterval(() => {
      fetchData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [authReady, fetchData, user]);

  const handleLogout = () => {
    api.logout();
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
    <div className="min-h-screen bg-[#e8ecf2] flex flex-col text-slate-800">
      {/* Skeuomorphic Header */}
      <Header
        user={user}
        onLogout={handleLogout}
        slackConnected={slackConnected}
        publicDemo={publicDemo}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        onOpenCompose={() => setIsComposeOpen(true)}
        onOpenQueue={() => setActiveTab('queue')}
      />

      {/* Main Console Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {publicDemo && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Public demo sandbox: email delivery is simulated, Slack is disabled, and data is isolated from production.
          </div>
        )}
        {/* Metric Cards Banner */}
        <StatsOverview stats={stats} />

        {/* Multi-Sender Quota Instrument Bar */}
        <div className="skeuo-panel p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
              <Shield className="w-4 h-4 text-amber-700 stroke-[2.5]" />
              Sender Quotas (Sliding Hour):
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              {senders.map((s) => (
                <div key={s.id} className="skeuo-inset px-3 py-1.5 rounded-xl flex items-center gap-2">
                  <span className="font-bold text-slate-700">{s.display_name.split(' ')[0]}:</span>
                  <span className="font-mono font-black text-amber-800">{s.hourlyUsage}</span>
                  <span className="text-slate-400 font-semibold">/{s.hourlyLimit} hr</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 font-bold text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full skeuo-led-green" />
            <span>Worker Queue Normal</span>
          </div>
        </div>

        {/* Tactile Tab Switcher & Table Container */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {/* Tactile Rocker Switch for Tabs */}
            <div className="skeuo-inset p-1.5 rounded-2xl inline-flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveTab('scheduled')}
                className={`px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'scheduled'
                    ? 'skeuo-button text-amber-900 border border-white'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Scheduled Sequence</span>
                {stats && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'scheduled' ? 'skeuo-inset text-amber-800' : 'bg-slate-300 text-slate-600'}`}>
                    {stats.scheduled}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('sent')}
                className={`px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'sent'
                    ? 'skeuo-button text-emerald-900 border border-white'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Sent Records</span>
                {stats && (
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'sent' ? 'skeuo-inset text-emerald-800' : 'bg-slate-300 text-slate-600'}`}>
                    {stats.sent}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('queue')}
                className={`px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'queue'
                    ? 'skeuo-button text-indigo-950 border border-white'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5 stroke-[2.5] text-amber-700" />
                <span>Queue Board</span>
                <span className="w-2 h-2 rounded-full skeuo-led-green ml-0.5" />
              </button>
            </div>
          </div>

          {/* Conditional View: Queue Dashboard or Email Records */}
          {activeTab === 'queue' ? (
            <QueueDashboard
              queue={queueDetails}
              onRefresh={() => fetchData(false)}
              loading={isRefreshing}
            />
          ) : (
            <EmailTable
              emails={emails}
              type={activeTab}
              loading={isInitialLoad}
              isRefreshing={isRefreshing}
              onRefresh={() => fetchData(false)}
              onCancel={handleCancelEmail}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              publicDemo={publicDemo}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-300/80 py-6 text-center text-xs font-semibold text-slate-500">
        <p className="drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
          {publicDemo ? 'ReachInbox Scheduler • Isolated Public Demo' : 'ReachInbox Engineering Hiring Assignment • Production Email Scheduler Console'}
        </p>
      </footer>

      {/* Google Login Prompt */}
      {authReady && !user && <LoginModal publicDemo={publicDemo} onLoginSuccess={(signedInUser) => setUser(signedInUser)} />}

      {/* Compose Sequence Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={fetchData}
        senders={senders}
        publicDemo={publicDemo}
      />

      {/* Slack Integration Modal */}
      {!publicDemo && (
        <SlackModal
          isOpen={isSlackOpen}
          onClose={() => setIsSlackOpen(false)}
          slackConnected={slackConnected}
          onStatusChange={fetchData}
        />
      )}
    </div>
  );
}

export default App;
