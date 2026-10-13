import React from 'react';
import { ExternalE2EEKeyProvider } from 'livekit-client';
import { decodePassphrase } from './client-utils';

export function useSetupE2EE() {
  const e2eePassphrase =
    typeof window !== 'undefined' ? decodePassphrase(location.hash.substring(1)) : undefined;

  // Create one worker per passphrase instead of one per render.
  const worker: Worker | undefined = React.useMemo(
    () =>
      typeof window !== 'undefined' && e2eePassphrase
        ? new Worker(new URL('livekit-client/e2ee-worker', import.meta.url))
        : undefined,
    [e2eePassphrase],
  );

  return { worker, e2eePassphrase };
}
