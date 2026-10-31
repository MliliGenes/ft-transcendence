import { navigate } from '../lib/navigation.js';

export function PrivacyPage() {
  return (
    <article className="card settings-card policy-card" aria-labelledby="privacy-heading">
      <header className="policy-header">
        <h2 id="privacy-heading">Privacy Policy</h2>
        <p className="muted">Last updated: October 2026 · Fieldnote & Code Arena</p>
      </header>

      <section className="policy-section">
        <h3>1. Overview & Commitment</h3>
        <p>
          Fieldnote and Code Arena are designed with a principle of data minimization. We collect and process
          only the information required to authenticate your identity, preserve your profile, deliver real-time
          collaborative features, and securely evaluate code in sandboxed environments.
        </p>
      </section>

      <section className="policy-section">
        <h3>2. Information We Collect</h3>
        <ul>
          <li>
            <strong>Account Credentials:</strong> When you register, we collect a username, an email address,
            and a password. Passwords are cryptographically salted and hashed using modern key derivation functions
            (Argon2id/bcrypt) before storage. Plaintext passwords never touch persistent storage or application logs.
          </li>
          <li>
            <strong>Profile Information:</strong> You may optionally provide a display name, bio, and profile avatar
            or banner images.
          </li>
          <li>
            <strong>Session & Security Data:</strong> When authenticated, short-lived session tokens and an{' '}
            <code>HttpOnly</code>, <code>Secure</code> refresh cookie are maintained to protect session continuity.
            IP addresses are processed temporarily at the gateway for rate-limiting and brute-force mitigation.
          </li>
          <li>
            <strong>Code Submissions & Gameplay Data:</strong> When participating in Code Arena matches, your source
            code submissions, execution timings, pass/fail test results, match scores, and match-scoped chat messages
            are processed to determine match outcomes and maintain game statistics.
          </li>
        </ul>
      </section>

      <section className="policy-section">
        <h3>3. Sandboxed Execution & Code Privacy</h3>
        <p>
          All candidate code submissions are executed inside ephemeral, isolated containers with no external network
          access. Containers are subject to strict CPU, memory, process, and wall-time limits. Source code submitted
          to the judge is retained only as long as necessary for scoring verification and match integrity.
        </p>
      </section>

      <section className="policy-section">
        <h3>4. Client-Side Storage & Cookies</h3>
        <p>We use strictly necessary cookies and local storage:</p>
        <ul>
          <li>
            <strong>Authentication Cookie:</strong> A single <code>HttpOnly</code>, <code>Secure</code>,{' '}
            <code>SameSite=Lax</code> cookie (<code>auth-refresh</code>) scoped to <code>/api/auth/</code> is used
            to issue refreshed session tokens without exposing credentials to client-side scripts.
          </li>
          <li>
            <strong>In-Memory Tokens:</strong> Access tokens reside strictly in browser memory and are discarded
            upon tab closure or logout.
          </li>
          <li>
            <strong>Editor Drafts:</strong> Unsaved code drafts in the Arena are stored strictly within your browser’s
            local storage, scoped by match and player identifier, ensuring drafts never cross accounts and are never
            sent to the server until you explicitly trigger a Run or Submit action.
          </li>
        </ul>
      </section>

      <section className="policy-section">
        <h3>5. Data Sharing & Third Parties</h3>
        <p>
          We do not sell, rent, or monetize your personal data. We do not integrate tracking beacons, ad networks,
          or third-party analytics trackers. If you choose to link an external authentication provider (such as
          GitHub or Discord), we receive only the public profile identifier and email permitted by your provider authorization.
        </p>
      </section>

      <section className="policy-section">
        <h3>6. Your Rights & Data Control</h3>
        <p>Under applicable data protection laws (including GDPR), you retain the right to:</p>
        <ul>
          <li>Access the personal information held about your account.</li>
          <li>Rectify inaccurate or outdated profile information via your Account settings.</li>
          <li>Request deletion of your account and associated profile data.</li>
          <li>Revoke linked OAuth connections at any time from your settings page.</li>
        </ul>
      </section>

      <section className="policy-section">
        <h3>7. Contact</h3>
        <p>
          For privacy inquiries or data requests, contact the system administrators at <code>privacy@fieldnote.local</code>.
        </p>
      </section>

      <div className="form-actions policy-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => navigate('/')}
        >
          Return to Account
        </button>
      </div>
    </article>
  );
}
