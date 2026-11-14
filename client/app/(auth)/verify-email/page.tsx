import type { Metadata } from 'next';
import { VerifyEmailView } from '@/components/auth/verify-email-view';

export const metadata: Metadata = { title: 'Verify email — Nook' };

export default function VerifyEmailPage() {
  return <VerifyEmailView />;
}
