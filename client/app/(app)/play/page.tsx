import type { Metadata } from 'next';
import { PlayLandingView } from '@/components/arena/PlayLandingView';

export const metadata: Metadata = {
  title: 'Play — Code Arena — Nook',
  description: 'Competitive multiplayer programming matches in Nook.',
};

export default function PlayPage() {
  return <PlayLandingView />;
}
