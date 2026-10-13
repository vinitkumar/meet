'use client';

import React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RemoteParticipant, RoomEvent } from 'livekit-client';
import { ControlSession } from './remote-control/ControlSession';
import { CAPABILITIES_TOPIC, supportsControl } from './remote-control/protocol';

// Enables remote control of the participant whose /capabilities message
// advertises supports_control, such as a remote-agent screen share.
export function RemoteControl() {
  const room = useRoomContext();
  const [agentIdentity, setAgentIdentity] = React.useState<string>();

  React.useEffect(() => {
    const clearIfAgent = (participant: RemoteParticipant) =>
      setAgentIdentity((current) => (current === participant.identity ? undefined : current));

    function handleData(
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) {
      if (topic !== CAPABILITIES_TOPIC || !participant) {
        return;
      }

      if (supportsControl(payload)) {
        setAgentIdentity(participant.identity);
        return;
      }

      clearIfAgent(participant);
    }

    room.on(RoomEvent.DataReceived, handleData);
    room.on(RoomEvent.ParticipantDisconnected, clearIfAgent);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
      room.off(RoomEvent.ParticipantDisconnected, clearIfAgent);
    };
  }, [room]);

  React.useEffect(() => {
    if (!agentIdentity) {
      return;
    }

    const session = new ControlSession(room, agentIdentity);
    return () => session.dispose();
  }, [room, agentIdentity]);

  return null;
}
