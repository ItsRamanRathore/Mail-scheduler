import React, { useState } from 'react';
import { api } from '../services/api';
import { X, CheckCircle2, AlertCircle, Hash, BellRing, Unlink } from 'lucide-react';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackConnected: boolean;
  onStatusChange: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackConnected,
  onStatusChange,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#rate-limit-alerts');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) {
      setError('Please provide a valid Slack incoming webhook URL.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.connectSlack(webhookUrl.trim(), channel.trim());
      if (res.success) {
        onStatusChange();
        onClose();
      } else {
        setError(res.error || 'Failed to connect Slack.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving Slack webhook.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnectSlack();
      onStatusChange();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Slack.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg skeuo-panel p-6 shadow-2xl border border-white">
        <div className="flex items-center justify-between pb-4 border-b border-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl skeuo-inset flex items-center justify-center text-amber-700">
              <BellRing className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                Slack Rate-Limit Webhook
              </h3>
              <p className="text-xs font-semibold text-slate-500">Instant alerts when an identity hits hourly threshold</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="skeuo-button p-2 rounded-xl text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {slackConnected ? (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-xl skeuo-inset flex items-start gap-3 border border-emerald-300/80">
              <span className="w-3 h-3 rounded-full skeuo-led-green shrink-0 mt-1" />
              <div>
                <p className="text-sm font-bold text-slate-800">Slack Webhook Operational</p>
                <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                  Rate-limit thresholds are monitored. If a sender crosses 50 emails/hour, a live notification is dispatched immediately to your channel.
                </p>
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="w-full skeuo-button py-2.5 rounded-xl text-xs font-bold text-rose-700 hover:text-rose-900 inline-flex items-center justify-center gap-2"
            >
              <Unlink className="w-4 h-4" />
              <span>{loading ? 'Disconnecting...' : 'Disconnect Slack Alert Integration'}</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                Slack Incoming Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/slack/webhook"
                className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold skeuo-input"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                Alert Channel
              </label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="rate-limit-alerts"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-semibold skeuo-input"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="skeuo-button px-4 py-2 rounded-xl text-xs font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="skeuo-primary-button px-5 py-2.5 rounded-xl text-xs font-bold"
              >
                {loading ? 'Connecting...' : 'Save & Arm Slack Alert'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
