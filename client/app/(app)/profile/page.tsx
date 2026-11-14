import type { Metadata } from 'next';
import { PublicProfile } from '@/components/app/public-profile';

export const metadata: Metadata = { title: 'Profile — Nook' };

export default function ProfilePage() {
  return <PublicProfile ownerRoute />;
}
