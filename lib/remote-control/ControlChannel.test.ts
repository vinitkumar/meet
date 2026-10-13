import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { LocalParticipant } from 'livekit-client';
import { ControlChannel } from './ControlChannel';
import { CONTROL_TOPIC, InputType, keyEvent } from './protocol';

const NO_MODIFIERS = { shift: false, ctrl: false, alt: false, meta: false };

function fakeParticipant() {
  const sent: { message: any; options: any }[] = [];
  const participant = {
    publishData: async (payload: Uint8Array, options: unknown) => {
      sent.push({ message: JSON.parse(new TextDecoder().decode(payload)), options });
    },
  } as unknown as LocalParticipant;
  return { participant, sent };
}

describe('ControlChannel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends reliable packets on the control topic to the agent only', async () => {
    const { participant, sent } = fakeParticipant();
    new ControlChannel(participant, 'agent').send(
      keyEvent(InputType.KeyDown, 'KeyA', NO_MODIFIERS),
    );
    await vi.runAllTimersAsync();

    expect(sent[0].options).toEqual({
      reliable: true,
      topic: CONTROL_TOPIC,
      destinationIdentities: ['agent'],
    });
  });

  it('sends pasted text before the paste keystroke', async () => {
    const { participant, sent } = fakeParticipant();
    const channel = new ControlChannel(participant, 'agent');
    channel.beginPaste();
    channel.send(keyEvent(InputType.KeyDown, 'KeyV', { ...NO_MODIFIERS, meta: true }));
    expect(channel.completePaste('copied')).toBe(true);
    await vi.runAllTimersAsync();

    expect(sent.map((s) => s.message.type)).toEqual(['clipboard_set', 'key_down']);
    expect(sent[0].message.data.text).toBe('copied');
  });

  it('releases the keystroke when no paste event arrives', async () => {
    const { participant, sent } = fakeParticipant();
    const channel = new ControlChannel(participant, 'agent');
    channel.beginPaste();
    channel.send(keyEvent(InputType.KeyDown, 'KeyV', NO_MODIFIERS));
    await vi.runAllTimersAsync();

    expect(sent.map((s) => s.message.type)).toEqual(['key_down']);
    expect(channel.completePaste('late')).toBe(false);
  });

  it('keeps sending after a failed publish', async () => {
    const sent: string[] = [];
    let calls = 0;
    const participant = {
      publishData: async (payload: Uint8Array) => {
        calls++;
        if (calls === 1) {
          throw new Error('offline');
        }
        sent.push(JSON.parse(new TextDecoder().decode(payload)).key);
      },
    } as unknown as LocalParticipant;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const channel = new ControlChannel(participant, 'agent');
    channel.send(keyEvent(InputType.KeyDown, 'KeyA', NO_MODIFIERS));
    channel.send(keyEvent(InputType.KeyDown, 'KeyB', NO_MODIFIERS));
    await vi.runAllTimersAsync();

    expect(sent).toEqual(['KeyB']);
    error.mockRestore();
  });
});
