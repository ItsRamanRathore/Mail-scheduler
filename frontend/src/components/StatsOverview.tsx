import React from 'react';
import { DashboardStats } from '../types';
import { Calendar, CheckCircle, AlertTriangle, Layers, Clock, ShieldCheck, Zap } from 'lucide-react';

interface StatsOverviewProps {
  stats: DashboardStats | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Scheduled Emails Card */}
      <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Scheduled Queue</p>
            <h3 className="text-3xl font-extrabold text-white mt-1 group-hover:text-indigo-400 transition-colors">
              {stats.scheduled}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>BullMQ delayed persistence</span>
        </div>
      </div>

      {/* 2. Sent Emails Card */}
      <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Delivered</p>
            <h3 className="text-3xl font-extrabold text-white mt-1 group-hover:text-emerald-400 transition-colors">
              {stats.sent}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>Via Ethereal SMTP</span>
        </div>
      </div>

      {/* 3. Rate Limit / Sender Policy */}
      <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hourly Limit / Sender</p>
            <h3 className="text-3xl font-extrabold text-white mt-1 group-hover:text-amber-400 transition-colors">
              {stats.maxEmailsPerHourPerSender}
              <span className="text-sm font-normal text-slate-400">/hr</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Redis window token limiter</span>
        </div>
      </div>

      {/* 4. Concurrency & Delay */}
      <div className="glass-card glass-card-hover rounded-2xl p-5 border border-slate-800 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Worker Concurrency</p>
            <h3 className="text-3xl font-extrabold text-white mt-1 group-hover:text-violet-400 transition-colors">
              {stats.workerConcurrency}
              <span className="text-sm font-normal text-slate-400"> parallel</span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span>Min delay: {stats.minDelayBetweenEmailsMs / 1000}s between sends</span>
        </div>
      </div>
    </div>
  );
};
