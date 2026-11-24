import React from 'react';
import { UserProfile } from '../types';
import { LogOut, Zap, Bell, CheckCircle2, AlertCircle, LayoutDashboard, Send } from 'lucide-react';

interface HeaderProps {
  user: UserProfile | null;
  onLogout: () => void;
  slackConnected: boolean;
  onOpenSlackModal: () => void;
  onOpenCompose: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  slackConnected,
  onOpenSlackModal,
  onOpenCompose,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#080d1a]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-400 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#080d1a] rounded-[10px] flex items-center justify-center">
              <Zap className="h-5 w-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">ReachInbox</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Job Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">High-Concurrency Email Scheduler</p>
          </div>
        </div>

        {/* Action Controls & User Meta */}
        <div className="flex items-center gap-4">
          {/* Slack Integration status pill */}
          <button
            onClick={onOpenSlackModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              slackConnected
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-400 hover:bg-amber-900/30'
            }`}
            title="Slack Notification for Rate Limiting"
          >
            {slackConnected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Slack Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Connect Slack</span>
              </>
            )}
          </button>

          {/* BullMQ Dashboard shortcut */}
          <a
            href="http://localhost:5000/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
            <span>BullMQ Live</span>
          </a>

          {/* Primary Action Button */}
          <button
            onClick={onOpenCompose}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all transform active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>Compose New Email</span>
          </button>

          {/* User profile & Logout */}
          {user && (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-9 h-9 rounded-full ring-2 ring-indigo-500/30 object-cover"
              />
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium text-slate-200">{user.name}</p>
                <p className="text-[11px] text-slate-400 truncate max-w-[120px]">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
