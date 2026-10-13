'use client';

import React from 'react';
import { PageClientImpl } from './rooms/[roomName]/PageClientImpl';
import { parseRoomRoute, RoomRoute } from '@/lib/roomRoute';

// GitHub Pages serves this page for every unknown path, including `/rooms/<name>`,
// so it renders the room when the path names one.
export default function NotFound() {
  const [route, setRoute] = React.useState<RoomRoute | null>();

  React.useEffect(() => {
    setRoute(parseRoomRoute(window.location.pathname, window.location.search) ?? null);
  }, []);

  if (route === undefined) {
    return null;
  }
  if (route === null) {
    return <h2>Page not found</h2>;
  }

  return <PageClientImpl {...route} />;
}
