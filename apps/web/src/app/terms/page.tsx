import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use - Quibly',
  description: 'Terms of Use and End User License Agreement for Quibly.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-[#141420] rounded-2xl p-8 border border-[#2A2A3E]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Terms of Use</h1>
          <p className="text-gray-400">Last updated: March 13, 2026</p>
        </div>

        <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>
              By downloading, installing, or using Quibly (&quot;the App&quot;), you agree to be bound
              by these Terms of Use. If you do not agree, do not use the App.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Description of Service</h2>
            <p>
              Quibly is a study platform that provides AI-powered flashcard and quiz generation,
              study tracking, leagues, and gamification features to help users learn more effectively.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Subscriptions &amp; Auto-Renewal</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                Quibly offers a free tier and a paid &quot;Pro&quot; subscription with monthly and
                yearly billing options.
              </li>
              <li>
                Payment is charged to your Apple App Store or Google Play account at confirmation of
                purchase.
              </li>
              <li>
                Subscriptions automatically renew unless auto-renewal is turned off at least 24 hours
                before the end of the current billing period.
              </li>
              <li>
                Your account will be charged for renewal within 24 hours prior to the end of the
                current period at the same price.
              </li>
              <li>
                You can manage and cancel your subscription in your App Store or Google Play account
                settings at any time.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Refund Policy</h2>
            <p>
              All purchases are processed through the Apple App Store or Google Play Store. Refund
              requests must be submitted directly to Apple or Google according to their respective
              refund policies. Quibly does not process refunds directly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. User Obligations</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You must be at least 13 years old to use Quibly.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>
                You agree not to upload content that is illegal, offensive, infringes on intellectual
                property rights, or violates any applicable law.
              </li>
              <li>You agree not to attempt to reverse-engineer, hack, or disrupt the App or its services.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Intellectual Property</h2>
            <p>
              All content, features, and functionality of Quibly — including but not limited to text,
              graphics, logos, icons, and software — are the exclusive property of Quibly and are
              protected by copyright, trademark, and other intellectual property laws. You retain
              ownership of the content you upload, but grant Quibly a license to use it to provide the
              service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. AI-Generated Content</h2>
            <p>
              Quibly uses artificial intelligence to generate flashcards, quizzes, and study materials.
              AI-generated content is provided &quot;as is&quot; and may contain inaccuracies. Quibly
              does not guarantee the accuracy, completeness, or reliability of AI-generated content.
              Users should verify important information independently.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time if you violate
              these Terms or engage in conduct that we determine to be harmful to the service or other
              users. You may delete your account at any time through the App settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">9. Disclaimer of Warranties</h2>
            <p>
              Quibly is provided &quot;as is&quot; and &quot;as available&quot; without warranties of
              any kind, either express or implied. We do not warrant that the App will be
              uninterrupted, error-free, or free of harmful components.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Quibly shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising out of or relating to
              your use of the App.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">11. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of significant changes
              through the App or by email. Continued use of the App after changes constitutes
              acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">12. Contact</h2>
            <p>
              If you have questions about these Terms, contact us at{' '}
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
