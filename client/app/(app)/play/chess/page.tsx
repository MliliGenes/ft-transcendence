import type { Metadata } from 'next';
import { ComingSoon } from '@/components/app/coming-soon';

export const metadata: Metadata = { title: 'Chess — Nook' };

export default function ChessPage() {
  return <ComingSoon title="Chess" />;
}
