import React, { useState, useRef } from 'react';
import { SenderOption } from '../types';
import { api } from '../services/api';
import { X, Upload, Mail, Clock, Calendar, AlertCircle, Send } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  senders: SenderOption[];
  publicDemo: boolean;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  senders,
  publicDemo,
}) => {
  const [sender, setSender] = useState(senders[0]?.email || 'alex.outreach@reachinbox.ai');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delayBetweenSeconds, setDelayBetweenSeconds] = useState(2);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
      setError('Subject line is required.');
      return;
    }
    if (!body.trim()) {
      setError('Email content body is required.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col skeuo-panel shadow-2xl overflow-hidden border border-white">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-6 border-b border-slate-300 bg-[#e0e6ef]/80">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl skeuo-inset flex items-center justify-center text-amber-700">
              <Mail className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                Compose Outbound Sequence
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                {publicDemo ? 'Sandbox only: messages are simulated and never delivered.' : 'Schedules durable jobs with sender rate-limit protection'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="skeuo-button p-2 rounded-xl text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Selector */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
              Select Sending Identity
            </label>
            <select
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold skeuo-input text-slate-800"
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
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Recipient Leads (comma, space, or newline separated)
              </label>
              {recipientsList.length > 0 && (
                <span className="text-xs font-black text-amber-800 skeuo-inset px-2.5 py-0.5 rounded-md border border-amber-300">
                  {recipientsList.length} leads detected
                </span>
              )}
            </div>

            <textarea
              rows={3}
              value={recipientInput}
              onChange={(e) => setRecipientInput(e.target.value)}
              onBlur={handleRecipientBlur}
              placeholder="e.g. founder@startup.io, partner@venture.com&#10;cto@enterprise.org"
              className="w-full px-4 py-2.5 rounded-xl text-sm font-mono skeuo-input resize-none"
            />

            {/* CSV / Text Upload Trigger */}
            <div className="mt-2.5 flex items-center gap-3">
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
                className="skeuo-button px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5 text-amber-600" />
                <span>{uploadLoading ? 'Parsing Leads...' : 'Upload CSV / TXT List'}</span>
              </button>
              <span className="text-[11px] text-slate-500 font-medium">Automatic deduplication & extraction</span>
            </div>
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Quick question regarding your outbound sequence..."
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold skeuo-input"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
              Email Content (Supports HTML)
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi there,&#10;&#10;I came across your product and wanted to share how ReachInbox helps..."
              className="w-full px-4 py-2.5 rounded-xl text-sm skeuo-input resize-none font-sans"
            />
          </div>

          {/* Timing & Delay Dial Container */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl skeuo-inset">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-700" />
                <span>Start Scheduling At</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold skeuo-input"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Leave empty to queue immediately</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>Inter-Email Delay (Throttle Protection)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={delayBetweenSeconds}
                  onChange={(e) => setDelayBetweenSeconds(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold skeuo-input"
                />
                <span className="text-xs font-bold text-slate-600">seconds</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Prevents provider spam flagging</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-300 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="skeuo-button px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="skeuo-primary-button px-6 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4 stroke-[2.5]" />
              <span>{loading ? 'Submitting to Queue...' : 'Dispatch Campaign'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
