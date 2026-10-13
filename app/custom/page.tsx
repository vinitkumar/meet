'use client';

import { videoCodecs } from 'livekit-client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { VideoConferenceClientImpl } from './VideoConferenceClientImpl';
import { isVideoCodec } from '@/lib/types';

// Reads the query on the client so the page also works as a static export.
function CustomRoomConnectionImpl() {
  const searchParams = useSearchParams();
  const liveKitUrl = searchParams.get('liveKitUrl');
  const token = searchParams.get('token');
  const codec = searchParams.get('codec') ?? undefined;
  const singlePC = searchParams.get('singlePC');

  if (liveKitUrl === null) {
    return <h2>Missing LiveKit URL</h2>;
  }
  if (token === null) {
    return <h2>Missing LiveKit token</h2>;
  }
  if (codec !== undefined && !isVideoCodec(codec)) {
    return <h2>Invalid codec, if defined it has to be [{videoCodecs.join(', ')}].</h2>;
  }

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      <VideoConferenceClientImpl
        liveKitUrl={liveKitUrl}
        token={token}
        codec={codec}
        singlePeerConnection={singlePC === 'true'}
      />
    </main>
  );
}

export default function CustomRoomConnection() {
  return (
    <Suspense>
      <CustomRoomConnectionImpl />
    </Suspense>
  );
}
