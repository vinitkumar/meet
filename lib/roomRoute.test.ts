import { describe, expect, it } from 'vitest';
import { parseRoomRoute } from './roomRoute';

describe('parseRoomRoute', () => {
  it('reads the room name under a base path', () => {
    const route = parseRoomRoute('/meet/rooms/abc-123/', '');

    expect(route).toEqual({
      roomName: 'abc-123',
      region: undefined,
      hq: false,
      codec: 'vp9',
      singlePeerConnection: true,
    });
  });

  it('reads room options from the query', () => {
    const route = parseRoomRoute('/rooms/abc', '?hq=true&codec=h264&singlePC=false&region=eu');

    expect(route).toMatchObject({
      hq: true,
      codec: 'h264',
      singlePeerConnection: false,
      region: 'eu',
    });
  });

  it('ignores paths outside rooms', () => {
    expect(parseRoomRoute('/meet/unknown', '')).toBeUndefined();
  });
});
