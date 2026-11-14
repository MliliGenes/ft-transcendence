import type { Metadata } from 'next';
import { MatchView } from '@/components/arena/MatchView';

export const metadata: Metadata = { title: 'Match — Code Arena — Nook' };
export const instant = false;

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchView matchId={id} />;
}
