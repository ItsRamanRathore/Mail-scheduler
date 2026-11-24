import React from 'react';
import { QueueDetails } from '../types';
import { Layers, RefreshCw, Server } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface QueueDashboardProps {
  queue: QueueDetails | null;
  onRefresh: () => void;
  loading: boolean;
}

export const QueueDashboard: React.FC<QueueDashboardProps> = ({ queue, onRefresh, loading }) => {
  if (!queue) {
    return (
      <div className="p-8 text-center text-slate-500 font-bold">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-700 mb-2" />
        <span>Loading queue status...</span>
      </div>
    );
  }

  const { counts, workers, jobs } = queue;

  return (
    <div className="space-y-6">
      {/* Top Telemetry Meters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="skeuo-panel p-3.5 text-center">
          <p className="text-[10px] font-extrabold uppercase text-slate-500">Scheduled</p>
          <p className="text-2xl font-black text-slate-700 mt-1">{counts.waiting}</p>
          <span className="text-[10px] text-amber-700 font-bold">Pending sends</span>
        </div>

        <div className="skeuo-panel p-3.5 text-center">
          <p className="text-[10px] font-extrabold uppercase text-slate-500">Sending</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{counts.active}</p>
          <span className="text-[10px] text-slate-500 font-bold">In progress</span>
        </div>

        <div className="skeuo-panel p-3.5 text-center">
          <p className="text-[10px] font-extrabold uppercase text-slate-500">
            {queue.name === 'sendScheduledEmail' ? 'Deferred' : 'Delayed'}
          </p>
          <p className="text-2xl font-black text-indigo-700 mt-1">{counts.delayed}</p>
          <span className="text-[10px] text-indigo-700 font-bold">
            {queue.name === 'sendScheduledEmail' ? 'Rate-limited' : 'Scheduled'}
          </span>
        </div>

        <div className="skeuo-panel p-3.5 text-center">
          <p className="text-[10px] font-extrabold uppercase text-slate-500">Sent</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{counts.completed}</p>
          <span className="text-[10px] text-emerald-700 font-bold">Recorded</span>
        </div>

        <div className="skeuo-panel p-3.5 text-center">
          <p className="text-[10px] font-extrabold uppercase text-slate-500">Failed</p>
          <p className="text-2xl font-black text-rose-700 mt-1">{counts.failed}</p>
          <span className="text-[10px] text-rose-600 font-bold">Delivery errors</span>
        </div>

        <div className="skeuo-panel p-3.5 text-center">
          <p className="text-[10px] font-extrabold uppercase text-slate-500">Max concurrency</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{queue.maxConcurrentDispatches || workers[0]?.concurrency || 5}</p>
          <span className="text-[10px] text-slate-600 font-bold">Parallel Jobs</span>
        </div>
      </div>

      {/* Worker Nodes Rig */}
      <div className="skeuo-panel p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-300">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-700 stroke-[2.2]" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              {workers.length ? 'Worker Nodes & Threads' : 'Managed Task Queue'}
            </h3>
          </div>
          <button
            onClick={onRefresh}
            className="skeuo-button px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-700' : ''}`} />
            <span>Poll Queue</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {workers.length === 0 ? (
            <p className="text-xs font-semibold text-slate-600">
              The Railway API schedules jobs and restores pending sends from its persistent database after restarts.
            </p>
          ) : workers.map((w, idx) => (
            <div key={idx} className="skeuo-inset p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${w.status === 'running' ? 'skeuo-led-green' : 'skeuo-led-amber'}`} />
                <div>
                  <p className="text-xs font-extrabold text-slate-800 uppercase">{w.id}</p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Concurrency: {w.concurrency} threads | Status: {w.status}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-700">{w.processedCount} processed</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Queue Jobs Table */}
      <div className="skeuo-panel overflow-hidden border border-white">
        <div className="px-6 py-4 bg-[#dbe2ed] border-b border-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-800 stroke-[2.5]" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Recent Email Jobs ({queue.name})
            </h4>
          </div>
          <span className="text-[11px] font-bold text-slate-500">Email task status</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#e4ebf5] uppercase font-black text-[10px] text-slate-600 border-b border-slate-300">
              <tr>
                <th className="px-5 py-3">Job ID</th>
                <th className="px-5 py-3">Recipient</th>
                <th className="px-5 py-3">Sender</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Execution Schedule</th>
                <th className="px-5 py-3">Queue Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300/60">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 font-semibold">
                    Queue is currently empty. Dispatch emails using "Compose Sequence".
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const targetTime = job.scheduled_at;
                  const isFuture = targetTime > Date.now();

                  return (
                    <tr key={job.id} className="hover:bg-white/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500 font-bold">
                        {job.id.substring(0, 8)}...
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">{job.recipient}</td>
                      <td className="px-5 py-3.5 text-slate-500 font-semibold">{job.sender}</td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium max-w-xs truncate">{job.subject}</td>
                      <td className="px-5 py-3.5 font-medium">
                        <span className="text-slate-800 font-bold">{format(new Date(targetTime), 'HH:mm:ss')}</span>{' '}
                        <span className="text-slate-500">
                          ({isFuture ? `in ${formatDistanceToNow(new Date(targetTime))}` : `${formatDistanceToNow(new Date(targetTime))} ago`})
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black skeuo-inset border ${
                            job.status === 'sent'
                              ? 'text-emerald-800 border-emerald-300'
                              : job.status === 'scheduled'
                              ? 'text-amber-800 border-amber-300'
                              : 'text-rose-800 border-rose-300'
                          }`}
                        >
                          {job.status === 'sent' ? 'COMPLETED' : 'DELAYED / QUEUED'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
