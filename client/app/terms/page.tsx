import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Terms of Service | Nook",
  description: "Rules for using the Nook community and Code Arena project.",
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" updatedAt="9 November 2026">
      <section>
        <h2>Using Nook</h2>
        <p>Nook is a student project for community conversations and games. These terms apply when you access a Nook instance. The person or organization operating that instance controls its availability and may publish additional rules for it. If a local rule conflicts with these terms, ask the instance operator which rule applies.</p>
        <p>Use an account that belongs to you, keep your sign-in details private, and provide information you are allowed to share. You are responsible for activity performed through your account. Tell the instance operator if you believe someone else has accessed it.</p>
      </section>

      <section>
        <h2>Content and conduct</h2>
        <p>You keep the rights you have in content you create. To provide the service, you allow the instance to store, process, transmit and display your profile information, messages, files and game submissions to you and the people or services needed for the feature you chose. This permission is limited to operating and maintaining that instance.</p>
        <p>Do not impersonate someone, violate another person&apos;s rights, send unlawful or abusive material, disrupt the service, attempt to access another person&apos;s data, or use Nook to attack its infrastructure. Only upload files and submit code you have permission to use. Do not put passwords, private keys, or other secrets into chat, attachments, profiles or Code Arena submissions.</p>
      </section>

      <section>
        <h2>Code Arena</h2>
        <p>Code Arena runs submitted programs against game test cases in a worker isolated from the application network. The game service stores submissions and match state to evaluate results and recover matches. Your code may be visible to your teammates in a collaborative match and to the instance operator. Do not submit confidential material or code that attempts to harm other users or the service.</p>
        <p>Match results are produced by the game service from its configured problems and scoring rules. The operator may pause or stop a match when needed to protect the instance or address a technical problem.</p>
      </section>

      <section>
        <h2>Accounts and enforcement</h2>
        <p>The instance operator may restrict or end access if an account is used to break these rules, compromise the service, or create a serious risk for others. Account deletion and the handling of retained messages, game records, backups and logs depend on the instance&apos;s available controls and configuration; see the <a href="/privacy">Privacy Policy</a>.</p>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>This project is provided for educational and community use. Features may change, and the instance may be unavailable during maintenance or because of technical failure. This build has no payment or subscription feature. Do not rely on it for emergency communication, critical records, or confidential storage. Nothing in these terms removes rights that apply to you under local law.</p>
        <p>The operator of the Nook instance you use is the contact for questions or concerns about these terms.</p>
      </section>
    </LegalDocument>
  );
}
