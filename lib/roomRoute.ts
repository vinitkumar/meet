import { VideoCodec } from 'livekit-client';
import { isVideoCodec } from './types';

const DEFAULT_CODEC: VideoCodec = 'vp9';

// Matches the room segment at the end of a path, e.g. `/meet/rooms/abc-123/`.
const ROOM_PATH_PATTERN = /\/rooms\/([^/]+)\/?$/;

export type RoomOptions = {
  region?: string;
  hq: boolean;
  codec: VideoCodec;
  singlePeerConnection: boolean;
};

export type RoomRoute = RoomOptions & { roomName: string };

export function parseRoomOptions(params: {
  region?: string;
  hq?: string;
  codec?: string;
  singlePC?: string;
}): RoomOptions {
  const codec =
    typeof params.codec === 'string' && isVideoCodec(params.codec) ? params.codec : DEFAULT_CODEC;

  return {
    region: params.region,
    hq: params.hq === 'true',
    codec,
    singlePeerConnection: params.singlePC !== 'false',
  };
}

// Resolves a room from a URL. Static hosts serve unknown room paths through the 404 page.
export function parseRoomRoute(pathname: string, search: string): RoomRoute | undefined {
  const match = ROOM_PATH_PATTERN.exec(pathname);
  if (!match) {
    return undefined;
  }

  const params = Object.fromEntries(new URLSearchParams(search));
  return { roomName: decodeURIComponent(match[1]), ...parseRoomOptions(params) };
}
