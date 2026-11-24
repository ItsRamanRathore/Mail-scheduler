import React from 'react';
import { DashboardStats } from '../types';
import { Calendar, CheckCircle, ShieldAlert, Cpu, Activity, Clock, Zap } from 'lucide-react';

interface StatsOverviewProps {
  stats: DashboardStats | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl skeuo-panel animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* 1. Scheduled Queue Instrument Card */}
      <div className="skeuo-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
              Scheduled Queue
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-slate-800 tracking-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
                {stats.scheduled}
              </h3>
              <span className="text-xs font-semibold text-amber-700">queued</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl skeuo-inset flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-300/70 flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full skeuo-led-amber" />
            <span>BullMQ Delayed Engine</span>
          </span>
          <span className="font-mono font-bold text-slate-600">Active</span>
        </div>
      </div>

      {/* 2. Delivered Emails Instrument Card */}
      <div className="skeuo-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
              Dispatched Emails
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-slate-800 tracking-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
                {stats.sent}
              </h3>
              <span className="text-xs font-semibold text-emerald-700">sent</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl skeuo-inset flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-300/70 flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full skeuo-led-green" />
            <span>Ethereal SMTP Relay</span>
          </span>
          <span className="font-mono font-bold text-slate-600">Verified</span>
        </div>
      </div>

      {/* 3. Rate Limit / Sender Policy Instrument Card */}
      <div className="skeuo-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
              Rate Limit / Sender
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <h3 className="text-3xl font-black text-slate-800 tracking-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
                {stats.maxEmailsPerHourPerSender}
              </h3>
              <span className="text-xs font-semibold text-slate-500">/hr per identity</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl skeuo-inset flex items-center justify-center text-amber-600">
            <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-300/70 flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>Sliding-Window Guard</span>
          <span className="font-mono font-bold text-amber-700">Strict</span>
        </div>
      </div>

      {/* 4. Concurrency & Delay Instrument Card */}
      <div className="skeuo-panel p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
              Worker Concurrency
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <h3 className="text-3xl font-black text-slate-800 tracking-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">
                {stats.workerConcurrency}
              </h3>
              <span className="text-xs font-semibold text-slate-500">parallel channels</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl skeuo-inset flex items-center justify-center text-slate-700">
            <Cpu className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-300/70 flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>Min Send Interval</span>
          <span className="font-mono font-bold text-slate-700">{stats.minDelayBetweenEmailsMs / 1000}s Delay</span>
        </div>
      </div>
    </div>
  );
};
