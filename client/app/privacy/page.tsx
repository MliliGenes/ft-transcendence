import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy | Nook",
  description: "What information a Nook instance processes and how to ask its operator about your data.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" updatedAt="9 November 2026">
      <section>
        <h2>About this notice</h2>
        <p>Nook is a student-built social and gaming project. Each deployed instance is operated using its own hosting, storage and configuration. The operator of the instance you use is responsible for that deployment and is your contact for questions about its data. This notice describes the data handled by the current Nook codebase; an operator should update it if their deployment adds services or changes retention.</p>
      </section>

      <section>
        <h2>Information the service handles</h2>
        <ul>
          <li><strong className="text-foreground">Account and profile:</strong> email address, username, display name, optional name and profile text, avatar and banner images, password hash, email-verification state and account timestamps.</li>
          <li><strong className="text-foreground">Sign-in connections:</strong> when you choose GitHub or Discord sign-in, the service receives provider identity and profile information needed to create or link your account. The service also keeps authentication and session records.</li>
          <li><strong className="text-foreground">Social activity:</strong> friend requests and relationships, blocks, group membership, presence, and account status.</li>
          <li><strong className="text-foreground">Messages and files:</strong> message text, conversation and author IDs, timestamps, edits, deletions, reactions, read state, attachment references, and files you upload. Chat files are stored in the instance&apos;s object storage.</li>
          <li><strong className="text-foreground">Code Arena:</strong> match participants, mode, timing, rounds, outcomes and scores. Submitted source code and collaborative editor snapshots are persisted by the game service so it can evaluate submissions and recover match state. The judge worker receives code and test inputs to run an evaluation.</li>
          <li><strong className="text-foreground">Operations:</strong> the HTTPS gateway records the requesting IP address, request method and path, and response status. Services also produce operational logs and metrics. Your browser may store session and interface preferences such as theme, recent emoji, and sidebar state.</li>
        </ul>
      </section>

      <section>
        <h2>Why information is used</h2>
        <p>The services use this information to create and secure accounts, show profiles, deliver conversations and files to their intended participants, coordinate matches, evaluate code, recover service state, and diagnose or protect the instance. Account information is not used by this project code to build advertising profiles.</p>
      </section>

      <section>
        <h2>Where information goes</h2>
        <p>Information is processed by the Nook services that provide the feature: the account service and its database, Chat and its database and object storage, and Code Arena and its database and judge worker. The instance&apos;s operator and administrators can access service data as needed to operate the deployment. If you use GitHub or Discord sign-in, those providers process your sign-in under their own privacy terms. Hosting, backups and service locations depend on the instance operator&apos;s configuration.</p>
      </section>

      <section>
        <h2>Storage and deletion</h2>
        <p>This codebase does not define one retention period for every data type. The operator controls database volumes, object storage, logs and any backups, so retention depends on the instance configuration. Ask that operator how long data is retained and where it is hosted.</p>
        <p>You can edit profile information in account settings. The current client does not expose a self-service account deletion control. The account service has an account deletion operation that removes the core account and authentication records and publishes a deletion event to Chat and Code Arena. Chat clears the cached profile identity, but existing conversation messages remain.</p>
        <p>When Code Arena processes a deletion event, it removes the account from matchmaking and private-room records and removes that person&apos;s messages from the session-only team-chat history. An unfinished match is recorded as a forfeit. Code Arena removes that participant&apos;s submitted source, run output, judge diagnostics and collaborative editor documents, then replaces the participant identifier with an anonymous identifier in the retained match result. Scores and results remain available to the other participants; anonymous participants are omitted from public opponent identifiers and leaderboard rows. In 2v2, source and editor state are shared by a side, so deleting one member removes that entire side&apos;s shared code, including code contributed by their teammate.</p>
        <p>Code Arena temporarily retains a one-way hash of the deleted account identifier for 20 minutes to reject access tokens issued before deletion; an automatic cleanup removes the hash within one additional minute. Database backups, copied volumes and operational logs are controlled by the instance operator and may have separate retention periods. Contact that operator to request access, correction or deletion and to ask how backups and logs are handled.</p>
      </section>

      <section>
        <h2>Security and changes</h2>
        <p>The project uses authenticated service endpoints, protected session cookies and isolated containers for code evaluation. No internet-connected service can promise perfect security. Development certificates are intended for local testing; the operator must configure trusted HTTPS and suitable storage and backup controls for a public deployment.</p>
        <p>This notice may change when the software or instance configuration changes. The date above identifies the latest version shown here. For information about personal-data rights in Morocco, see the <a href="https://www.cndp.ma/vos-droits-en-matiere-de-protection-des-donnees-a-caractere-personnel/" target="_blank" rel="noreferrer">CNDP information on data protection rights</a> and contact the instance operator about the particular data they hold.</p>
      </section>
    </LegalDocument>
  );
}
