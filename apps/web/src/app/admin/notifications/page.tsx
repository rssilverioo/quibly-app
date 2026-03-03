'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';

type Segment = 'all' | 'pro' | 'free';

const SEGMENTS: { value: Segment; label: string; description: string }[] = [
  { value: 'all', label: 'All Users', description: 'Send to every registered user' },
  { value: 'pro', label: 'PRO Only', description: 'Send only to PRO subscribers' },
  { value: 'free', label: 'FREE Only', description: 'Send only to free-tier users' },
];

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState<Segment>('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isValid = title.trim().length > 0 && body.trim().length > 0;

  function getSegmentLabel(seg: Segment): string {
    return SEGMENTS.find((s) => s.value === seg)?.label ?? seg;
  }

  async function handleSend() {
    setConfirmOpen(false);
    setSending(true);
    setResult(null);
    try {
      const res = await api.post<{ sent: number }>('/admin/notifications/broadcast', {
        title: title.trim(),
        body: body.trim(),
        segment,
      });
      setResult({ type: 'success', message: `Notification sent to ${res.sent} device${res.sent !== 1 ? 's' : ''}` });
      setTitle('');
      setBody('');
      setSegment('all');
    } catch (err) {
      setResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send notification',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-quibly-text">Notifications</h1>

      {result && (
        <div
          className={cn(
            'text-sm rounded-lg px-4 py-3',
            result.type === 'success'
              ? 'bg-quibly-success/10 text-quibly-success'
              : 'bg-quibly-error/10 text-quibly-error',
          )}
        >
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <h2 className="text-lg font-semibold text-quibly-text mb-4">Compose Notification</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-quibly-text-secondary mb-1.5">
                Title
              </label>
              <Input
                placeholder="Notification title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-quibly-text-secondary mb-1.5">
                Body
              </label>
              <textarea
                placeholder="Notification message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full bg-quibly-surface-light border border-quibly-border rounded-lg px-4 py-2.5 text-sm text-quibly-text placeholder:text-quibly-text-muted focus:outline-none focus:ring-2 focus:ring-quibly-primary focus:border-transparent transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-quibly-text-secondary mb-2">
                Audience
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SEGMENTS.map((seg) => (
                  <button
                    key={seg.value}
                    type="button"
                    onClick={() => setSegment(seg.value)}
                    className={cn(
                      'flex flex-col items-start rounded-lg border p-3 text-left transition-colors',
                      segment === seg.value
                        ? 'border-quibly-primary bg-quibly-primary/10'
                        : 'border-quibly-border bg-quibly-surface-light hover:border-quibly-text-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm font-medium',
                        segment === seg.value ? 'text-quibly-primary-light' : 'text-quibly-text',
                      )}
                    >
                      {seg.label}
                    </span>
                    <span className="text-xs text-quibly-text-muted mt-0.5">{seg.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!isValid || sending}
              className="w-full"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner className="w-4 h-4" />
                  Sending...
                </span>
              ) : (
                'Send Notification'
              )}
            </Button>
          </div>
        </Card>

        {/* Preview */}
        <Card>
          <h2 className="text-lg font-semibold text-quibly-text mb-4">Preview</h2>

          <div className="bg-quibly-surface-light border border-quibly-border rounded-lg p-4">
            {title.trim() || body.trim() ? (
              <div>
                <p className="text-sm font-bold text-quibly-text">
                  {title.trim() || 'Notification Title'}
                </p>
                <p className="text-sm text-quibly-text-secondary mt-1">
                  {body.trim() || 'Notification body will appear here...'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-quibly-text-muted text-center py-4">
                Fill in the title and body to see a preview
              </p>
            )}
          </div>

          <div className="mt-4 text-xs text-quibly-text-muted">
            Sending to: <span className="font-medium text-quibly-text-secondary">{getSegmentLabel(segment)}</span>
          </div>
        </Card>
      </div>

      {/* Confirmation Modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-quibly-text">Confirm Broadcast</h3>
          <p className="text-sm text-quibly-text-secondary">
            Are you sure you want to send this notification to{' '}
            <span className="font-medium text-quibly-text">{getSegmentLabel(segment).toLowerCase()}</span>?
          </p>

          <div className="bg-quibly-surface-light border border-quibly-border rounded-lg p-3">
            <p className="text-sm font-bold text-quibly-text">{title}</p>
            <p className="text-sm text-quibly-text-secondary mt-1">{body}</p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend}>
              Confirm &amp; Send
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
