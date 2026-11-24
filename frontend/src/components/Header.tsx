import React from 'react';
import { UserProfile } from '../types';
import { LogOut, Sliders, LayoutDashboard, Plus } from 'lucide-react';

interface HeaderProps {
  user: UserProfile | null;
  onLogout: () => void;
  slackConnected: boolean;
  onOpenSlackModal: () => void;
  onOpenCompose: () => void;
  onOpenQueue: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  slackConnected,
  onOpenSlackModal,
  onOpenCompose,
  onOpenQueue,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#e3e8f1]/90 backdrop-blur-md border-b border-[#cbd5e1]/80 shadow-[0_4px_12px_rgba(166,175,190,0.35)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand identity: Embossed hardware badge */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl skeuo-panel flex items-center justify-center p-1 relative overflow-hidden group">
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[inset_0_1px_2px_rgba(255,255,255,0.7),inset_0_-2px_4px_rgba(180,83,9,0.5)]">
              <Sliders className="h-6 w-6 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-extrabold text-xl tracking-tight text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                ReachInbox
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md skeuo-inset text-amber-800 border border-slate-300">
                Job Dispatcher
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">Precision Queue & High-Volume Scheduler</p>
          </div>
        </div>

        {/* Action Controls & Hardware Buttons */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Slack Integration Hardware Pill */}
          <button
            onClick={onOpenSlackModal}
            className={`skeuo-button px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-slate-700 transition-all ${
              slackConnected ? 'border-emerald-400/60' : 'border-amber-400/60'
            }`}
            title="Slack Notification System"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${slackConnected ? 'skeuo-led-green' : 'skeuo-led-amber'}`} />
            <span className="hidden sm:inline font-bold">
              {slackConnected ? 'Slack Online' : 'Connect Slack'}
            </span>
          </button>

          {/* Scheduled job dashboard */}
          <button
            onClick={onOpenQueue}
            className="skeuo-button px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-2 cursor-pointer"
            title="Inspect scheduled email queue"
          >
            <LayoutDashboard className="w-4 h-4 text-amber-600" />
            <span className="hidden md:inline">Queue Board</span>
            <span className="w-2 h-2 rounded-full skeuo-led-green" />
          </button>

          {/* Primary Action Button (Tactile Amber Metal) */}
          <button
            onClick={onOpenCompose}
            className="skeuo-primary-button px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Compose Sequence</span>
          </button>

          {/* User profile button & Logout */}
          {user && (
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-300/80">
              <div className="p-0.5 rounded-full skeuo-panel">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-9 h-9 rounded-full object-cover shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                />
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">{user.name}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate max-w-[110px]">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="skeuo-button p-2 rounded-xl text-slate-500 hover:text-rose-600"
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
