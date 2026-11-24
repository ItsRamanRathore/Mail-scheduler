import React, { useState } from 'react';
import { Mail, ShieldCheck, Cpu } from 'lucide-react';
import type { UserProfile } from '../types';
import { api } from '../services/api';

interface LoginModalProps {
  onLoginSuccess: (user: UserProfile) => void;
  publicDemo: boolean;
}

const demoProfiles = [
  { name: 'Alex Rivera (Growth)', email: 'alex.outreach@reachinbox.ai' },
  { name: 'Sarah Jenkins (Partnerships)', email: 'sarah.sales@reachinbox.ai' },
  { name: 'ReachInbox Executive Desk', email: 'founder@reachinbox.ai' },
];

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, publicDemo }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmail, setSelectedEmail] = useState(demoProfiles[0].email);
  const [password, setPassword] = useState('');

  const handleLogin = async (profileEmail = selectedEmail, event?: React.FormEvent) => {
    event?.preventDefault();
    setError('');
    setLoading(true);
    try {
      onLoginSuccess(await api.login(profileEmail, publicDemo ? undefined : password));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md p-8 skeuo-panel shadow-2xl border border-white">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl skeuo-inset mb-4 text-amber-700">
            <Mail className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
            Choose an account
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            {publicDemo ? 'Select a saved sender profile to enter the sandbox' : 'Select a saved sender profile to evaluate'}
          </p>
        </div>

        <form onSubmit={(event) => void handleLogin(selectedEmail, event)} className="space-y-4">
          <div className="space-y-2">
            {demoProfiles.map((profile) => (
              <button
                key={profile.email}
                type="button"
                disabled={loading}
                aria-pressed={selectedEmail === profile.email}
                onClick={() => {
                  setSelectedEmail(profile.email);
                  if (publicDemo) void handleLogin(profile.email);
                }}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selectedEmail === profile.email
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white/70 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">
                    {profile.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800">{profile.name}</span>
                    <span className="block truncate text-xs text-slate-500">{profile.email}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          {!publicDemo && (
            <>
              <label htmlFor="scheduler-password" className="sr-only">Scheduler password</label>
              <input
                id="scheduler-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full skeuo-inset rounded-xl px-4 py-3 text-sm text-slate-800 outline-none"
                placeholder="Scheduler password"
              />
              <button
                type="submit"
                disabled={loading || !password}
                className="w-full skeuo-button py-3 px-4 rounded-xl flex items-center justify-center gap-3 text-slate-800 font-bold text-sm cursor-pointer disabled:opacity-60"
              >
                <span className="font-black text-lg text-blue-700">G</span>
                <span>{loading ? 'Signing in...' : 'Continue'}</span>
              </button>
              <p className="text-center text-xs font-semibold text-slate-500">
                Get the scheduler password from the project owner.
              </p>
            </>
          )}

          {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
        </form>

        <div className="mt-8 pt-5 border-t border-slate-300 flex items-center justify-between text-[11px] font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-700" /> Railway Scheduler
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            {publicDemo ? 'Isolated demo' : 'Password protected'}
          </span>
        </div>
        <p className="mt-3 text-center text-[10px] font-medium text-slate-500">
          {publicDemo
            ? 'Choose a profile to enter the sandbox. Email delivery is simulated; no messages are sent.'
            : (
              <>
                Google OAuth is not used. Access requires the Railway scheduler password.{' '}
                <a
                  href="https://mail-scheduler-jet.vercel.app/demo"
                  className="font-bold text-blue-700 underline"
                >
                  Anyone can try the public demo.
                </a>
              </>
            )}
        </p>
      </div>
    </div>
  );
};
