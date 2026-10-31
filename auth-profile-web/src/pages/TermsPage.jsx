import { navigate } from '../lib/navigation.js';

export function TermsPage() {
  return (
    <article className="card settings-card policy-card" aria-labelledby="terms-heading">
      <header className="policy-header">
        <h2 id="terms-heading">Terms of Service</h2>
        <p className="muted">Last updated: October 2026 · Fieldnote & Code Arena</p>
      </header>

      <section className="policy-section">
        <h3>1. Acceptance of Terms</h3>
        <p>
          By creating an account on Fieldnote or entering a Code Arena match, you agree to comply with and be bound
          by these Terms of Service. If you do not agree with these terms, please do not use the service.
        </p>
      </section>

      <section className="policy-section">
        <h3>2. Account Integrity & Security</h3>
        <ul>
          <li>
            You are responsible for safeguarding your login credentials and for all activities that occur under your account.
          </li>
          <li>
            You agree to notify administrators immediately of any unauthorized access or security breach.
          </li>
          <li>
            Multiple accounts used to circumvent rating systems, manipulate matchmaking, or evade penalties are prohibited.
          </li>
        </ul>
      </section>

      <section className="policy-section">
        <h3>3. Code Execution & Arena Sandbox Rules</h3>
        <p>
          Code Arena provides automated compilation and execution of user-submitted source code in Python, C, and C++.
          You agree strictly to adhere to the following security boundaries:
        </p>
        <ul>
          <li>
            <strong>No Malicious Payloads:</strong> You must not attempt to execute code designed to exploit kernel
            vulnerabilities, escape container isolation, access host resources, probe internal network sockets, or disrupt
            the judge infrastructure.
          </li>
          <li>
            <strong>Resource Constraints:</strong> Submissions are subject to enforced execution ceilings (CPU time,
            wall-clock time, memory consumption, and standard output size). Programs attempting deliberate denial-of-service
            or fork bombs will be terminated immediately.
          </li>
          <li>
            <strong>Educational & Fair Play:</strong> Arena problems must be solved algorithmically within the game rules.
            Tampering with the test runner, mock harnesses, or judge contracts constitutes a violation of these terms.
          </li>
        </ul>
      </section>

      <section className="policy-section">
        <h3>4. Fair Play, Collaboration & Match Etiquette</h3>
        <ul>
          <li>
            <strong>Authoritative Resolution:</strong> Match outcomes, scores, deadlines, and rankings are calculated
            authoritatively on the server. Client-side state manipulations or forged packets are rejected.
          </li>
          <li>
            <strong>Forfeit Policy:</strong> Deliberately leaving an active match via the Leave match button triggers
            an immediate forfeit to ensure opposing players are not delayed.
          </li>
          <li>
            <strong>Team Collaboration (2v2):</strong> In collaborative matches, team members share an editor document
            and team communication channel. Users must not engage in deliberate sabotaging of team code, harassment,
            or spamming of quick-ping channels.
          </li>
        </ul>
      </section>

      <section className="policy-section">
        <h3>5. Service Availability & Limitations</h3>
        <p>
          Fieldnote and Code Arena are provided as-is for educational and competitive development purposes. While we
          strive for continuous uptime and rigorous container isolation, we do not warrant that the service will be
          uninterrupted, error-free, or resilient against catastrophic hardware failures.
        </p>
      </section>

      <section className="policy-section">
        <h3>6. Termination</h3>
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms, attempt to bypass security
          controls, or engage in abusive behavior toward other participants.
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
