import React, { useState } from 'react';
import { EmailItem } from '../types';
import { Search, ExternalLink, Clock, CheckCircle2, AlertCircle, RefreshCw, XCircle, Trash2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface EmailTableProps {
  emails: EmailItem[];
  type: 'scheduled' | 'sent';
  loading: boolean;
  onRefresh: () => void;
  onCancel?: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const EmailTable: React.FC<EmailTableProps> = ({
  emails,
  type,
  loading,
  onRefresh,
  onCancel,
  searchQuery,
  onSearchChange,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  return (
    <div className="space-y-4">
      {/* Search Bar & Action Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${type} emails by recipient, subject or keyword...`}
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Sender</th>
                <th className="px-6 py-4">{type === 'scheduled' ? 'Scheduled Time' : 'Sent Time'}</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                      <span>Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500">
                        {type === 'scheduled' ? <Clock className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                      </div>
                      <p className="font-medium text-slate-300">No {type} emails found</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        {type === 'scheduled'
                          ? 'Schedule new emails using the "Compose New Email" button.'
                          : 'Sent emails processed via BullMQ & Ethereal SMTP will appear here.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                emails.map((email) => {
                  const targetTime = type === 'scheduled' ? email.scheduled_at : (email.sent_at || email.scheduled_at);
                  const isFuture = targetTime > Date.now();

                  return (
                    <tr
                      key={email.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => setSelectedEmail(email)}
                    >
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500/80" />
                        <span>{email.recipient}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-200 max-w-xs truncate">{email.subject}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{email.sender}</td>
                      <td className="px-6 py-4 text-xs text-slate-300">
                        <div>{format(new Date(targetTime), 'MMM dd, yyyy HH:mm:ss')}</div>
                        <div className="text-[11px] text-slate-500">
                          {isFuture ? `in ${formatDistanceToNow(new Date(targetTime))}` : `${formatDistanceToNow(new Date(targetTime))} ago`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            email.status === 'sent'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : email.status === 'scheduled'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : email.status === 'rescheduled'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {email.status === 'sent' && <CheckCircle2 className="w-3 h-3" />}
                          {email.status === 'scheduled' && <Clock className="w-3 h-3" />}
                          {email.status === 'rescheduled' && <AlertCircle className="w-3 h-3" />}
                          {email.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {email.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {email.preview_url && (
                            <a
                              href={email.preview_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition-colors"
                              title="View in Ethereal Mailbox"
                            >
                              <span>Preview</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {type === 'scheduled' && email.status === 'scheduled' && onCancel && (
                            <button
                              onClick={() => onCancel(email.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Cancel Schedule"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Details Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl p-6 glass-card rounded-2xl border border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">Email Payload Inspection</span>
                <h3 className="text-lg font-bold text-white mt-1">{selectedEmail.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Recipient</p>
                  <p className="font-semibold text-slate-200">{selectedEmail.recipient}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Sender</p>
                  <p className="font-semibold text-slate-200">{selectedEmail.sender}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Scheduled For</p>
                  <p className="text-slate-200">
                    {format(new Date(selectedEmail.scheduled_at), 'PPP p')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="capitalize text-indigo-300">{selectedEmail.status}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400 mb-1">Body Preview</p>
                <div
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 max-h-60 overflow-y-auto prose prose-invert text-sm"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                />
              </div>

              {selectedEmail.preview_url && (
                <div className="pt-2">
                  <a
                    href={selectedEmail.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <span>Open Live Ethereal Message</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
