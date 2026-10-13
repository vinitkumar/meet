// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const rooms = vi.hoisted(() => [] as any[]);

vi.mock('livekit-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('livekit-client')>();
  return {
    ...original,
    Room: vi.fn(function () {
      const room = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        off: vi.fn(),
        localParticipant: {
          enableCameraAndMicrophone: vi.fn().mockResolvedValue(undefined),
        },
      };
      rooms.push(room);
      return room;
    }),
  };
});

vi.mock('@livekit/components-react', () => ({
  RoomContext: React.createContext(undefined),
  VideoConference: () => null,
  formatChatMessageLinks: () => null,
}));
vi.mock('@/lib/Debug', () => ({ DebugMode: () => null }));
vi.mock('@/lib/KeyboardShortcuts', () => ({ KeyboardShortcuts: () => null }));
vi.mock('@/lib/RemoteControl', () => ({ RemoteControl: () => null }));
vi.mock('@/lib/SettingsMenu', () => ({ SettingsMenu: () => null }));
vi.mock('@/lib/usePerfomanceOptimiser', () => ({ useLowCPUOptimizer: () => false }));

import { VideoConferenceClientImpl } from './VideoConferenceClientImpl';

const props = {
  liveKitUrl: 'wss://example.test',
  token: 'token',
  codec: undefined,
  singlePeerConnection: false,
};

describe('VideoConferenceClientImpl', () => {
  afterEach(() => {
    cleanup();
    rooms.length = 0;
  });

  // A re-render, such as the low-CPU optimizer's state update, must not
  // connect a second room that kicks the first for a duplicate identity.
  it('connects one room across re-renders', () => {
    const { rerender } = render(<VideoConferenceClientImpl {...props} />);
    rerender(<VideoConferenceClientImpl {...props} />);
    rerender(<VideoConferenceClientImpl {...props} />);

    const connected = rooms.filter((room) => room.connect.mock.calls.length > 0);
    expect(connected).toHaveLength(1);
    expect(connected[0].localParticipant.enableCameraAndMicrophone).toHaveBeenCalledTimes(1);
  });

  it('disconnects the room on unmount', () => {
    const { unmount } = render(<VideoConferenceClientImpl {...props} />);
    unmount();

    const connected = rooms.filter((room) => room.connect.mock.calls.length > 0);
    expect(connected[0].disconnect).toHaveBeenCalled();
  });
});
