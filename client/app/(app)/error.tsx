'use client';

import { ErrorPage, errorDigest } from '@/components/error-page';

export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <ErrorPage
      code="500"
      eyebrow="Something went wrong"
      title="We hit an unexpected snag"
      description="This page couldn’t load. Try again, and if it keeps happening, come back in a little while."
      onRetry={retry}
      homeHref="/chat"
      homeLabel="Back to chat"
      reference={errorDigest(error)}
    />
  );
}
