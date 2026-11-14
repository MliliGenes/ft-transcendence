import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicProfile } from '@/components/app/public-profile';

export const metadata: Metadata = { title: 'Profile — Nook' };
export const instant = false;

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    notFound();
  return <PublicProfile id={id} />;
}
