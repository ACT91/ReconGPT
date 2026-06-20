import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <div className="dark min-h-screen bg-neutral-950 text-neutral-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center">
            <span className="text-neutral-900 font-bold text-sm">R</span>
          </div>
          <Link to="/login" className="font-semibold text-lg text-neutral-100 hover:text-yellow-400 transition-colors">
            Reconny
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-neutral-100 mb-2">Privacy Policy & Terms of Service</h1>
        <p className="text-sm text-neutral-500 mb-10">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">1. Who We Are</h2>
            <p>
              Reconny is an AI-powered Attack Surface Management and Reconnaissance Automation Platform. By using Reconny, you agree to these Terms of Service and acknowledge this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">2. Acceptable Use Policy (AUP)</h2>
            <div className="space-y-2">
              <p className="font-medium text-neutral-200">You MAY only use Reconny to scan:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-neutral-400">
                <li>Domains and systems you own or control.</li>
                <li>Domains and systems you have explicit written permission to test.</li>
                <li>Bug bounty program targets within the scope defined by the program.</li>
              </ul>
              <p className="font-medium text-neutral-200 mt-4">You MUST NOT use Reconny to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-neutral-400">
                <li>Scan domains or systems without authorization from their owner.</li>
                <li>Conduct denial-of-service attacks.</li>
                <li>Engage in any activity that violates local, national, or international law.</li>
                <li>Circumvent rate limits or quotas to abuse the service.</li>
              </ul>
              <div className="mt-4 p-3 rounded-lg bg-red-950/30 border border-red-900/40 text-red-300 text-xs">
                Violation of this AUP will result in immediate account termination and may be reported to the relevant authorities. You are solely responsible for ensuring your scans are lawfully authorized.
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">3. Data We Collect (GDPR Article 13)</h2>
            <div className="space-y-3">
              <div>
                <p className="font-medium text-neutral-200 mb-1">Account Data</p>
                <p className="text-neutral-400">Your email address, full name (optional), and hashed password. We collect this to authenticate your identity and operate your account.</p>
              </div>
              <div>
                <p className="font-medium text-neutral-200 mb-1">Scan Data</p>
                <p className="text-neutral-400">Domains you submit for scanning, and the resulting findings (subdomains, vulnerabilities, endpoints). This data is necessary to provide the core service.</p>
              </div>
              <div>
                <p className="font-medium text-neutral-200 mb-1">Usage Logs</p>
                <p className="text-neutral-400">Server logs including timestamps, IP addresses, and API request paths for security monitoring purposes. Retained for 30 days.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">4. Legal Basis for Processing</h2>
            <ul className="list-disc list-inside space-y-1 pl-2 text-neutral-400">
              <li><strong className="text-neutral-300">Contract performance</strong>: Processing your account data to deliver the service you signed up for.</li>
              <li><strong className="text-neutral-300">Legitimate interests</strong>: Security logging to detect and prevent abuse.</li>
              <li><strong className="text-neutral-300">Consent</strong>: You provide explicit consent to these terms at registration.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">5. Your Rights Under GDPR</h2>
            <div className="space-y-2 text-neutral-400">
              <p><strong className="text-neutral-300">Right of Access (Art. 15)</strong>: You can view all your data in the app at any time.</p>
              <p><strong className="text-neutral-300">Right to Portability (Art. 20)</strong>: Export a JSON copy of all your data from <Link to="/settings" className="text-yellow-400 hover:underline">Settings → Privacy &amp; Data → Download My Data</Link>.</p>
              <p><strong className="text-neutral-300">Right to Erasure (Art. 17)</strong>: Delete your account and anonymise all personal data from <Link to="/settings" className="text-yellow-400 hover:underline">Settings → Privacy &amp; Data → Delete Account</Link>.</p>
              <p><strong className="text-neutral-300">Right to Rectification (Art. 16)</strong>: Contact support to correct inaccurate personal data.</p>
              <p><strong className="text-neutral-300">Right to Object (Art. 21)</strong>: You may object to processing at any time by deleting your account.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">6. Data Retention</h2>
            <p className="text-neutral-400">
              Scan results and job artifacts are automatically deleted after 30 days. Account data is retained until you delete your account. Server logs are retained for 30 days for security purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">7. Security</h2>
            <p className="text-neutral-400">
              We protect your data using industry-standard practices: bcrypt password hashing (12 rounds), JWT authentication with short expiration windows, HTTPS-only transmission, and strict access controls. Despite these measures, no system is perfectly secure and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">8. Third-Party Services</h2>
            <p className="text-neutral-400">
              Reconny uses OpenAI (or compatible AI providers) to generate vulnerability analysis summaries. Scan results may be sent to the AI provider API for processing. We do not sell your personal data to any third party.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">9. Limitation of Liability</h2>
            <p className="text-neutral-400">
              Reconny is provided as-is for authorized security testing purposes. We are not responsible for any direct or indirect damages arising from misuse of the platform, including unauthorized scanning activities conducted by users. You bear full responsibility for ensuring all scans comply with applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-neutral-100 mb-3">10. Contact</h2>
            <p className="text-neutral-400">
              For data protection inquiries or to exercise your GDPR rights, contact us at: <strong className="text-neutral-300">privacy@reconny.app</strong>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-600">
          <span>&copy; {new Date().getFullYear()} Reconny. All rights reserved.</span>
          <Link to="/login" className="hover:text-neutral-400 transition-colors">Back to Sign In</Link>
        </div>
      </div>
    </div>
  )
}
