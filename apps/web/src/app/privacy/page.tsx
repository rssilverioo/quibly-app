import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Quibly',
  description: 'Privacy Policy for the Quibly app and services.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-[#141420] rounded-2xl p-8 border border-[#2A2A3E]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-400">Last updated: March 13, 2026</p>
        </div>

        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Information We Collect</h2>
            <p className="mb-2">We collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Account information:</strong> email address, username, handle, and profile
                photo when you create an account.
              </li>
              <li>
                <strong>Study data:</strong> flashcard sets, quizzes, study sessions, scores, streaks,
                and progress you generate while using the App.
              </li>
              <li>
                <strong>Documents:</strong> files you upload for AI-powered study material generation.
              </li>
              <li>
                <strong>Device information:</strong> device type, operating system, and push
                notification tokens for delivering notifications.
              </li>
              <li>
                <strong>Usage data:</strong> how you interact with the App, including features used
                and time spent studying.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide, maintain, and improve the Quibly service.</li>
              <li>To generate AI-powered flashcards, quizzes, and study materials from your documents.</li>
              <li>To track your study progress, streaks, XP, and league standings.</li>
              <li>To send push notifications (study reminders, streak alerts, league updates).</li>
              <li>To process subscriptions and manage your account.</li>
              <li>To respond to support requests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Data Sharing</h2>
            <p className="mb-2">We do not sell your personal data. We may share information with:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Firebase (Google):</strong> for authentication and push notifications.
              </li>
              <li>
                <strong>RevenueCat:</strong> for subscription management and purchase processing.
              </li>
              <li>
                <strong>Google Gemini:</strong> for AI-powered content generation (documents you
                upload are processed to generate study materials).
              </li>
              <li>
                <strong>Cloud storage providers:</strong> for storing uploaded files and avatars.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Data Storage &amp; Security</h2>
            <p>
              Your data is stored on secure servers. We use industry-standard security measures
              including encrypted connections (HTTPS/TLS), secure authentication via Firebase, and
              access controls to protect your data. While we strive to protect your information, no
              method of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. When you delete your account,
              we delete your profile, study data, documents, and associated files. Financial
              transaction records may be retained for up to 5 years as required by law. Anonymized
              security logs may be retained for up to 90 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Access your personal data through the App.</li>
              <li>Update or correct your profile information at any time.</li>
              <li>Delete your account and associated data through the App settings.</li>
              <li>
                Request a copy of your data by contacting us at{' '}
                <a href="mailto:support@tryquibly.com" className="text-blue-400 underline">
                  support@tryquibly.com
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Children&apos;s Privacy</h2>
            <p>
              Quibly is not intended for children under 13 years of age. We do not knowingly collect
              personal information from children under 13. If we learn that we have collected data
              from a child under 13, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes through the App or by email. Continued use of the App after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">9. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your data, contact us at{' '}
              <a href="mailto:support@tryquibly.com" className="text-blue-400 underline">
                support@tryquibly.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-[#2A2A3E] text-center text-sm text-gray-500">
          <p>Quibly &copy; {new Date().getFullYear()} &mdash; All rights reserved</p>
        </div>
      </div>
    </div>
  );
}
