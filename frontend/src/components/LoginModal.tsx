import React, { useState } from 'react';
import { Mail, ShieldCheck, Cpu } from 'lucide-react';
import { UserProfile } from '../types';
import { api } from '../services/api';

interface LoginModalProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      onLoginSuccess(await api.login(password));
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
            ReachInbox Scheduler
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">Enter the admin password to access the scheduler</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <label htmlFor="admin-password" className="sr-only">Admin password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full skeuo-inset rounded-xl px-4 py-3 text-sm text-slate-800 outline-none"
            placeholder="Admin password"
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full skeuo-button py-3 px-4 rounded-xl flex items-center justify-center gap-3 text-slate-800 font-bold text-sm cursor-pointer"
          >
            <span>{loading ? 'Signing in...' : 'Sign in'}</span>
          </button>

          {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
        </form>

        <div className="mt-8 pt-5 border-t border-slate-300 flex items-center justify-between text-[11px] font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-700" /> Railway Scheduler
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Safe Rate Limiting
          </span>
        </div>
      </div>
    </div>
  );
};
