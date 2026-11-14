import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument, LegalSection } from '@/components/legal/legal-document';

export const metadata: Metadata = { title: 'Privacy Policy — Nook' };

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      intro="Nook is a social space built by students at 1337, part of the 42 network, as their ft_transcendence project. This page explains what we collect, why, who can see it, and how long we keep it."
    >
      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong>Account details:</strong> your email address, username and a
            securely hashed password. We never store your password in readable
            form.
          </li>
          <li>
            <strong>GitHub or Discord sign-in:</strong> if you use one, your
            account identifier and the profile details that provider shares with
            us.
          </li>
          <li>
            <strong>Profile details you choose to add:</strong> first and last
            name, display name, avatar, banner, bio and status.
          </li>
          <li>
            <strong>Social activity:</strong> friend requests, friendships and
            the people you block.
          </li>
          <li>
            <strong>What you share:</strong> feed posts, direct messages, group
            messages, files you attach, and which messages you have read.
          </li>
          <li>
            <strong>Code Arena:</strong> match participants, mode, timing,
            rounds, outcomes and scores. Submitted source code and collaborative
            editor snapshots are persisted by the game service so it can
            evaluate submissions and recover match state. The judge worker
            receives code and test inputs to run an evaluation.
          </li>
          <li>
            <strong>Online status:</strong> whether you are online or away. This
            is held in memory while you are connected and is not saved.
          </li>
          <li>
            <strong>Technical logs:</strong> your IP address and the method,
            path and status of each request, plus service metrics. Message
            contents are not written to logs.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Why we use it">
        <ul>
          <li>
            To create your account, sign you in and keep your session secure.
          </li>
          <li>To show your profile and deliver your posts and messages.</li>
          <li>
            To send emails you need, such as address verification and password
            resets.
          </li>
          <li>
            To coordinate Code Arena matches, evaluate submitted programs and
            recover match state.
          </li>
          <li>To keep Nook running, limit abuse and diagnose problems.</li>
        </ul>
        <p>
          We do not sell your data, show advertising or use third-party
          analytics.
        </p>
      </LegalSection>

      <LegalSection title="Who can see what">
        <ul>
          <li>
            <strong>Anyone, without logging in:</strong> your username, display
            name, avatar, banner, bio, status and the date you joined.
          </li>
          <li>
            <strong>Everyone logged in to Nook:</strong> your feed posts and the
            files attached to them.
          </li>
          <li>
            <strong>The people in the conversation:</strong> your direct
            messages and group messages.
          </li>
          <li>
            <strong>Code Arena players:</strong> completed match summaries,
            scores and leaderboard entries are available to signed-in users.
            Collaborative source is shared with your team and is accessible to
            the instance operator and judge worker; public summaries do not
            include source or hidden tests.
          </li>
          <li>
            <strong>The Nook team:</strong> administrators can view and manage
            accounts. Messages are protected in transit but are not end-to-end
            encrypted, so they can be read by someone with access to the
            database.
          </li>
        </ul>
        <p>Your email address is never shown on your public profile.</p>
      </LegalSection>

      <LegalSection title="Services we rely on">
        <ul>
          <li>
            <strong>GitHub and Discord</strong>, only if you choose to sign in
            with them. Their own privacy policies apply to your use of those
            services.
          </li>
          <li>
            <strong>An email delivery provider</strong>, which receives your
            address and the message when we send you an email.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies and browser storage">
        <p>
          We use one essential, HTTP-only cookie to keep you signed in, and
          short-lived cookies during GitHub or Discord sign-in. A separate
          preference cookie remembers whether your sidebar is open. Your browser
          also stores your theme and recently used emoji, plus small temporary
          values during sign-in. We do not use tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <ul>
          <li>
            <strong>Account and profile data:</strong> until your account is
            deleted.
          </li>
          <li>
            <strong>Technical logs and metrics:</strong> retention depends on
            the instance operator and monitoring configuration.
          </li>
          <li>
            <strong>Deleted messages and posts:</strong> the text is erased
            straight away. Attached files are no longer available in Nook, but
            they may remain in storage.
          </li>
        </ul>
        <p>
          When an account is deleted, its credentials, sessions, profile and
          friendships are removed. Messages already sent stay in their
          conversations so that other people’s history remains intact, but they
          no longer show your name or picture.
        </p>
      </LegalSection>

      <LegalSection title="Code Arena storage and account erasure">
        <p>
          The current client does not expose self-service account deletion. The
          account service publishes deletion events to Chat and Code Arena when
          an account is deleted.
        </p>
        <p>
          When Code Arena processes a deletion event, it removes the account
          from matchmaking and private-room records and removes that
          person&apos;s messages from the session-only team-chat history. An
          unfinished match is recorded as a forfeit. Code Arena removes that
          participant&apos;s submitted source, run output, judge diagnostics and
          collaborative editor documents, then replaces the participant
          identifier with an anonymous identifier in the retained match result.
          Scores and results remain available to the other participants;
          anonymous participants are omitted from public opponent identifiers
          and leaderboard rows. In 2v2, source and editor state are shared by a
          side, so deleting one member removes that entire side&apos;s shared
          code, including code contributed by their teammate.
        </p>
        <p>
          Code Arena temporarily retains a one-way hash of the deleted account
          identifier for 20 minutes to reject access tokens issued before
          deletion; an automatic cleanup removes the hash within one additional
          minute. Database backups, copied volumes and operational logs are
          controlled by the instance operator and may have separate retention
          periods. Contact that operator to request access, correction or
          deletion and to ask how backups and logs are handled.
        </p>
      </LegalSection>

      <LegalSection title="How we protect it">
        <p>
          Connections use HTTPS, passwords are hashed with bcrypt, sessions use
          short-lived tokens, and attachments sit in private storage that can
          only be reached through links that expire after a few minutes. No
          system is perfectly secure, so please use a unique password.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <ul>
          <li>
            You can view and correct your profile and account details in your
            settings at any time.
          </li>
          <li>
            You can edit or delete your own messages and posts, and block other
            people.
          </li>
          <li>
            You can ask the Nook team for a copy of your data, or to delete your
            account.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Contact and changes">
        <p>
          Questions or requests can be sent to the Nook team, the students who
          run this project. If this policy changes, we will update the date at
          the top of this page. See also our{' '}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
