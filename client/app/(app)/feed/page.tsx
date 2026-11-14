import type { Metadata } from 'next';
import { FeedView } from '@/components/app/feed/feed-view';

export const metadata: Metadata = { title: 'Feed — Nook' };

export default function FeedPage() {
  return <FeedView />;
}
