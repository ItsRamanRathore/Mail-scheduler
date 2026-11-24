import React, { useState, useRef } from 'react';
import { SenderOption } from '../types';
import { api } from '../services/api';
import { X, Upload, Mail, Clock, Calendar, AlertCircle, CheckCircle, FileText, Send } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  senders: SenderOption[];
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  senders,
}) => {
  const [sender, setSender] = useState(senders[0]?.email || 'alex.outreach@reachinbox.ai');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle CSV/text file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    setError(null);
    try {
      const res = await api.parseRecipientsFile(file);
      if (res.success && res.recipients) {
        setRecipientsList(res.recipients);
        setRecipientInput(res.recipients.join(', '));
      } else {
        setError(res.error || 'Failed to parse file.');
      }
    } catch (err: any) {
      setError(err.message || 'File upload error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRecipientBlur = () => {
    const raw = recipientInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.includes('@'));
    const unique = Array.from(new Set(raw));
    setRecipientsList(unique);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Finalize recipient list
    const targets = recipientsList.length > 0
      ? recipientsList
      : recipientInput
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.includes('@'));

    if (targets.length === 0) {
      setError('Please provide at least one valid recipient email address.');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required.');
      return;
    }
    if (!body.trim()) {
      setError('Body content is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.scheduleEmails({
        recipients: targets,
        sender,
        subject,
        body,
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        delayBetweenSeconds,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to schedule emails.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while scheduling.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col glass-card rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Compose & Schedule Sequence</h2>
              <p className="text-xs text-slate-400">Dispatch delayed jobs via BullMQ with rate-limit safety</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Sending Identity
            </label>
            <select
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.email}>
                  {s.display_name} ({s.email}) — Hourly Usage: {s.hourlyUsage}/{s.hourlyLimit}
                </option>
              ))}
            </select>
          </div>

          {/* Recipients with CSV Upload */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Recipients (comma / newline separated or upload CSV)
              </label>
              {recipientsList.length > 0 && (
                <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {recipientsList.length} address(es) detected
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onBlur={handleRecipientBlur}
              placeholder="e.g. lead1@company.com, lead2@startup.io&#10;lead3@enterprise.org"
              className="w-full px-4 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-mono"
            />

            {/* CSV / Text Upload Trigger */}
            <div className="mt-2 flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>{uploadLoading ? 'Parsing CSV...' : 'Upload CSV / TXT of Email Leads'}</span>
              </button>
              <span className="text-[11px] text-slate-500">Auto-parses and deduplicates all emails</span>
            </div>
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Quick question regarding your outbound pipeline..."
              className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Content (HTML / Text)
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hey there,&#10;&#10;I noticed your recent announcement and wanted to follow up..."
              className="w-full px-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-sans"
            />
          </div>

          {/* Schedule & Throttling Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
            {/* Start Time */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Start Time</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Leave blank for immediate queue</span>
            </div>

            {/* Delay Between Each Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Delay Between Sends</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={delayBetweenSeconds}
                  onChange={(e) => setDelayBetweenSeconds(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400">sec</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Mimic human delivery delay</span>
            </div>

            {/* Hourly Limit */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Hourly Limit</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 50)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400">/hr</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Configurable limit threshold</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Submitting to Queue...' : 'Schedule Campaign'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
