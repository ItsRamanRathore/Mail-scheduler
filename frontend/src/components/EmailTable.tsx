import React, { useState } from 'react';
import { EmailItem } from '../types';
import { Search, ExternalLink, Clock, CheckCircle2, AlertCircle, RefreshCw, XCircle, Trash2, Mail } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface EmailTableProps {
  emails: EmailItem[];
  type: 'scheduled' | 'sent';
  loading: boolean;
  isRefreshing?: boolean;
  onRefresh: () => void;
  onCancel?: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const EmailTable: React.FC<EmailTableProps> = ({
  emails,
  type,
  loading,
  isRefreshing,
  onRefresh,
  onCancel,
  searchQuery,
  onSearchChange,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);

  return (
    <div className="space-y-4">
      {/* Search Input Well & Refresh Hardware Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${type} emails by recipient or subject...`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium skeuo-input placeholder-slate-400"
          />
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="skeuo-button px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-2 self-end sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
          <span>Refresh Table</span>
        </button>
      </div>

      {/* Main Beveled Table Frame */}
      <div className="skeuo-panel overflow-hidden border border-white/70">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-[#dbe2ed] text-xs uppercase font-extrabold text-slate-600 border-b border-slate-300 shadow-[inset_0_-1px_0_rgba(255,255,255,0.7)]">
              <tr>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Sender</th>
                <th className="px-6 py-4">{type === 'scheduled' ? 'Scheduled Run' : 'Dispatch Time'}</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
                      <span>Reading queue records...</span>
                    </div>
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-2xl skeuo-inset flex items-center justify-center text-slate-400">
                        <Mail className="w-7 h-7" />
                      </div>
                      <p className="font-bold text-slate-700 text-base">No {type} emails found</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        {type === 'scheduled'
                          ? 'Click "Compose Sequence" to schedule jobs via BullMQ.'
                          : 'Emails dispatched via SMTP relay will appear here with live preview links.'}
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
                      className="hover:bg-white/40 transition-colors cursor-pointer group"
                      onClick={() => setSelectedEmail(email)}
                    >
                      <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${email.status === 'sent' ? 'skeuo-led-green' : 'skeuo-led-amber'}`} />
                        <span>{email.recipient}</span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700 max-w-xs truncate">{email.subject}</td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-500">{email.sender}</td>
                      <td className="px-6 py-4 text-xs">
                        <div className="font-bold text-slate-700">{format(new Date(targetTime), 'MMM dd, yyyy HH:mm:ss')}</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {isFuture ? `in ${formatDistanceToNow(new Date(targetTime))}` : `${formatDistanceToNow(new Date(targetTime))} ago`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-black skeuo-inset border ${
                            email.status === 'sent'
                              ? 'text-emerald-800 border-emerald-300'
                              : email.status === 'scheduled'
                              ? 'text-amber-800 border-amber-300'
                              : email.status === 'rescheduled'
                              ? 'text-orange-800 border-orange-300'
                              : 'text-rose-800 border-rose-300'
                          }`}
                        >
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
                              className="skeuo-button px-3 py-1 rounded-lg text-xs font-bold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1.5"
                              title="View Email in Ethereal Mailbox"
                            >
                              <span>Preview</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {type === 'scheduled' && email.status === 'scheduled' && onCancel && (
                            <button
                              onClick={() => onCancel(email.id)}
                              className="skeuo-button p-1.5 rounded-lg text-slate-500 hover:text-rose-600"
                              title="Cancel Schedule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* Tactile Inspection Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl p-6 skeuo-panel shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-300">
              <div>
                <span className="text-[11px] uppercase font-black text-amber-700 tracking-wider">
                  Email Dispatch Inspection
                </span>
                <h3 className="text-xl font-black text-slate-800 mt-1">{selectedEmail.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="skeuo-button p-2 rounded-xl text-slate-600 hover:text-slate-900"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="skeuo-inset p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Recipient</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedEmail.recipient}</p>
                </div>
                <div className="skeuo-inset p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Sender Identity</p>
                  <p className="font-bold text-slate-800 mt-0.5">{selectedEmail.sender}</p>
                </div>
                <div className="skeuo-inset p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Scheduled Time</p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {format(new Date(selectedEmail.scheduled_at), 'PPP p')}
                  </p>
                </div>
                <div className="skeuo-inset p-3 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Delivery Status</p>
                  <p className="font-extrabold capitalize text-amber-800 mt-0.5">{selectedEmail.status}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 mb-1.5">Email Body Content</p>
                <div
                  className="p-4 rounded-xl skeuo-inset text-slate-800 max-h-56 overflow-y-auto text-sm"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                />
              </div>

              {selectedEmail.preview_url && (
                <div className="pt-2 flex justify-end">
                  <a
                    href={selectedEmail.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="skeuo-primary-button px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2"
                  >
                    <span>Open in Ethereal Mailbox</span>
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
