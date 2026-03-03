'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function JoinPage() {
  const params = useParams();
  const code = params.code as string;
  const [showFallback, setShowFallback] = useState(false);
  const deepLink = `quibly://league/join/${encodeURIComponent(code)}`;

  useEffect(() => {
    window.location.href = deepLink;
    const timer = setTimeout(() => setShowFallback(true), 1500);
    return () => clearTimeout(timer);
  }, [deepLink]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A0A0F] to-[#141420] flex items-center justify-center p-6">
      <div className="bg-[#141420] rounded-2xl p-10 max-w-[400px] w-full text-center border border-[#2A2A3E]">
        <div className="w-16 h-16 rounded-2xl bg-quibly-primary flex items-center justify-center mx-auto mb-4 text-3xl font-extrabold text-white">
          Q
        </div>
        <h1 className="text-[28px] font-bold text-white mb-2">Quibly</h1>

        {!showFallback ? (
          <div>
            <p className="text-base text-quibly-text-secondary mb-6">Opening Quibly...</p>
            <div className="w-8 h-8 border-[3px] border-quibly-border border-t-quibly-primary rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div>
            <p className="text-base text-quibly-text-secondary mb-6">
              You&apos;ve been invited to join a league!
            </p>
            <div className="bg-quibly-surface-light rounded-xl p-5 mb-6 border border-quibly-primary/25">
              <p className="text-[11px] text-quibly-text-muted uppercase tracking-widest mb-2">
                Invite Code
              </p>
              <p className="text-[28px] font-extrabold text-quibly-primary-light tracking-[4px]">
                {code}
              </p>
            </div>
            <a
              href={deepLink}
              className="block bg-quibly-primary hover:bg-quibly-primary-light text-white py-3.5 px-6 rounded-xl text-base font-bold no-underline mb-5 transition-colors"
            >
              Open in Quibly
            </a>
            <p className="text-[13px] text-quibly-text-muted leading-relaxed">
              Don&apos;t have the app? Download Quibly from the App Store or Google Play,
              then open this link again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
