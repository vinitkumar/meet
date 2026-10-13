import type { LocalParticipant } from 'livekit-client';
import { CONTROL_TOPIC, ControlMessage, clipboardSet } from './protocol';

// How long to wait for the browser paste event after a paste shortcut.
const PASTE_TIMEOUT_MS = 1000;

// The agent applies clipboard text on a worker, separately from its input
// queue, so give it time to land before the paste keystroke arrives.
const CLIPBOARD_SETTLE_MS = 150;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends control messages to one agent, in order, over reliable data packets.
export class ControlChannel {
  private readonly encoder = new TextEncoder();
  private queue: Promise<void> = Promise.resolve();
  private resolvePaste?: (text: string | undefined) => void;

  constructor(
    private readonly participant: LocalParticipant,
    private readonly agentIdentity: string,
  ) {}

  send(message: ControlMessage): void {
    this.enqueue(() => this.publish(message));
  }

  // Copies text to the agent's clipboard.
  setClipboard(text: string): void {
    this.enqueue(() => this.publishClipboard(text));
  }

  // Holds later messages until completePaste() supplies the pasted text or
  // the timeout passes, so the agent pastes the viewer's clipboard.
  beginPaste(): void {
    const text = new Promise<string | undefined>((resolve) => {
      this.resolvePaste = resolve;
      setTimeout(() => this.completePaste(undefined), PASTE_TIMEOUT_MS);
    });

    this.enqueue(async () => {
      const pasted = await text;
      if (pasted === undefined) {
        return;
      }

      await this.publishClipboard(pasted);
      await delay(CLIPBOARD_SETTLE_MS);
    });
  }

  // Returns false when no paste shortcut is waiting for this text.
  // Undefined releases the waiting messages without touching the clipboard.
  completePaste(text: string | undefined): boolean {
    const resolve = this.resolvePaste;
    if (!resolve) {
      return false;
    }

    this.resolvePaste = undefined;
    resolve(text);
    return true;
  }

  private async publishClipboard(text: string): Promise<void> {
    const message = clipboardSet(text);
    if (!message) {
      console.warn('Remote control: clipboard text exceeds the agent limit and was not sent');
      return;
    }

    await this.publish(message);
  }

  private publish(message: ControlMessage): Promise<void> {
    return this.participant.publishData(this.encoder.encode(JSON.stringify(message)), {
      reliable: true,
      topic: CONTROL_TOPIC,
      destinationIdentities: [this.agentIdentity],
    });
  }

  // A failed send is logged so it does not stall the messages behind it.
  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue
      .then(task)
      .catch((error) => console.error('Remote control: failed to send', error));
  }
}
