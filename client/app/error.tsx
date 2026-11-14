'use client';

import { ErrorPage, errorDigest } from '@/components/error-page';

export default function RootError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <ErrorPage
      standalone
      code="500"
      eyebrow="Something went wrong"
      title="We hit an unexpected snag"
      description="It’s not you — something broke on our side. Try again, and if it keeps happening, come back in a little while."
      onRetry={retry}
      reference={errorDigest(error)}
    />
  );
}
