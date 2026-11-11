import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal/legal-document";

export const metadata: Metadata = { title: "Terms of Service — Nook" };

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      intro="These terms apply when you use Nook, a social space built by students at 1337, part of the 42 network, as their ft_transcendence project. By creating an account or using Nook, you agree to them."
    >
      <LegalSection title="Your account">
        <ul>
          <li>Give accurate details and keep your password to yourself.</li>
          <li>You are responsible for what happens under your account.</li>
          <li>You must be old enough to agree to these terms where you live.</li>
          <li>Do not impersonate another person or create accounts to get around a block or a removal.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your content">
        <p>You keep ownership of what you post. You give Nook permission to store it and show it to the people it is meant for, as far as is needed to run the service. Your feed posts are visible to everyone logged in to Nook, and your public profile is visible to anyone.</p>
        <p>Only share content you have the right to share. You can edit or delete your own messages and posts.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Be decent to the people here. You must not use Nook to:</p>
        <ul>
          <li>harass, threaten or hate on other people;</li>
          <li>share illegal content, malware, or anything that exposes someone’s private information;</li>
          <li>send spam or abuse automated access;</li>
          <li>try to break, overload or bypass the security of the service, or access accounts and data that are not yours.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Files and limits">
        <p>You can attach images, PDFs and MP4, WebM or MOV videos. Images and PDFs can be up to 10 MB and videos up to 50 MB, with up to 5 files per message. Requests are rate limited to keep the service available for everyone.</p>
      </LegalSection>

      <LegalSection title="Code Arena">
        <p>Code Arena runs submitted programs against game test cases in a worker isolated from the application network. The game service stores submissions and match state to evaluate results and recover matches. Your code may be visible to your teammates in a collaborative match and to the instance operator. Do not submit confidential material or code that attempts to harm other users or the service.</p>
        <p>Match results are produced by the game service from its configured problems and scoring rules. The operator may pause or stop a match when needed to protect the instance or address a technical problem.</p>
        <p>Do not put passwords, private keys or other secrets in submissions, chat, attachments or profiles.</p>
      </LegalSection>

      <LegalSection title="Moderation and removal">
        <p>The Nook team can remove content and delete accounts that break these terms or put the service or its users at risk. You can block anyone you do not want to hear from.</p>
      </LegalSection>

      <LegalSection title="A student project">
        <p>Nook is an educational project, provided as is and without warranties. Features can change, data can be lost, and the service can go offline or end at any time, so keep your own copy of anything important. To the extent the law allows, the Nook team is not liable for losses that come from using it.</p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>Our <Link href="/privacy">Privacy Policy</Link> explains how we handle your data.</p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>If these terms change, we will update the date at the top of this page. Continuing to use Nook after a change means you accept the new terms. Questions can be sent to the Nook team, the students who run this project.</p>
      </LegalSection>
    </LegalDocument>
  );
}
