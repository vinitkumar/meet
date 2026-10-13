import { Room, Track } from 'livekit-client';
import { ControlChannel } from './ControlChannel';
import {
  ButtonState,
  InputType,
  Modifiers,
  MouseButton,
  Point,
  buttonEvent,
  keyEvent,
  toModifiers,
  toMouseButton,
  toVideoPoint,
} from './protocol';

// Outlines the agent's video while it receives input.
const ACTIVE_CLASS = 'lk-remote-control-active';

const META_CODES = new Set(['MetaLeft', 'MetaRight']);

// Synthetic releases carry no modifier snapshot, so none are reapplied.
const NO_MODIFIERS: Modifiers = { shift: false, ctrl: false, alt: false, meta: false };

function isMacPlatform(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

// Cmd+V on macOS and Ctrl+V elsewhere trigger the browser paste event.
function isPasteShortcut(event: KeyboardEvent): boolean {
  const modifier = isMacPlatform() ? event.metaKey : event.ctrlKey;
  return event.code === 'KeyV' && modifier && !event.altKey;
}

// Captures clicks, keys, and pastes on an agent's screen share and forwards
// them to the agent. Clicking the agent's video starts control; clicking
// elsewhere or leaving the window ends it and releases held input.
export class ControlSession {
  private readonly channel: ControlChannel;
  private readonly heldKeys = new Set<string>();
  private readonly heldButtons = new Set<MouseButton>();
  private activeVideo?: HTMLVideoElement;

  constructor(
    private readonly room: Room,
    private readonly agentIdentity: string,
  ) {
    this.channel = new ControlChannel(room.localParticipant, agentIdentity);

    // Capture phase runs before Meet's own shortcut and focus handlers.
    document.addEventListener('pointerdown', this.onPointerDown, true);
    document.addEventListener('pointerup', this.onPointerUp, true);
    document.addEventListener('contextmenu', this.onContextMenu, true);
    document.addEventListener('paste', this.onPaste, true);
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.deactivate);
  }

  dispose(): void {
    this.deactivate();

    document.removeEventListener('pointerdown', this.onPointerDown, true);
    document.removeEventListener('pointerup', this.onPointerUp, true);
    document.removeEventListener('contextmenu', this.onContextMenu, true);
    document.removeEventListener('paste', this.onPaste, true);
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.deactivate);
  }

  private onPointerDown = (event: PointerEvent) => {
    const video = this.agentVideo(event.target);
    if (!video) {
      this.deactivate();
      return;
    }

    event.preventDefault();
    this.activate(video);

    const button = toMouseButton(event.button);
    const point = this.videoPoint(video, event);
    if (button === undefined || !point) {
      return;
    }

    this.heldButtons.add(button);
    this.channel.send(buttonEvent(button, ButtonState.Pressed, point, toModifiers(event)));
  };

  // Releases are forwarded wherever the pointer is, so a button never sticks.
  private onPointerUp = (event: PointerEvent) => {
    const button = toMouseButton(event.button);
    if (button === undefined || !this.heldButtons.delete(button)) {
      return;
    }

    event.preventDefault();
    const point = this.activeVideo ? this.videoPoint(this.activeVideo, event) : undefined;
    this.channel.send(buttonEvent(button, ButtonState.Released, point, toModifiers(event)));
  };

  private onContextMenu = (event: MouseEvent) => {
    if (this.agentVideo(event.target)) {
      event.preventDefault();
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.activeVideo || !event.code) {
      return;
    }

    event.stopPropagation();
    if (isPasteShortcut(event)) {
      // Let the browser fire the paste event so the text reaches the agent first.
      this.channel.beginPaste();
    } else {
      event.preventDefault();
    }

    this.heldKeys.add(event.code);
    this.channel.send(keyEvent(InputType.KeyDown, event.code, toModifiers(event)));
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (!this.heldKeys.has(event.code)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // macOS browsers skip keyup for keys released while Cmd is held.
    if (META_CODES.has(event.code)) {
      this.releaseKeys((code) => !META_CODES.has(code));
    }

    this.heldKeys.delete(event.code);
    this.channel.send(keyEvent(InputType.KeyUp, event.code, toModifiers(event)));
  };

  private onPaste = (event: ClipboardEvent) => {
    if (!this.activeVideo) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Non-text clipboards release a waiting paste without clearing the agent's clipboard.
    const text = event.clipboardData?.getData('text/plain') || undefined;
    if (this.channel.completePaste(text) || text === undefined) {
      return;
    }

    this.channel.setClipboard(text);
  };

  private activate(video: HTMLVideoElement): void {
    if (this.activeVideo === video) {
      return;
    }

    this.activeVideo?.classList.remove(ACTIVE_CLASS);
    this.activeVideo = video;
    video.classList.add(ACTIVE_CLASS);
  }

  private deactivate = () => {
    if (!this.activeVideo) {
      return;
    }

    for (const button of this.heldButtons) {
      this.channel.send(buttonEvent(button, ButtonState.Released, undefined, NO_MODIFIERS));
    }
    this.heldButtons.clear();
    this.releaseKeys(() => true);

    this.activeVideo.classList.remove(ACTIVE_CLASS);
    this.activeVideo = undefined;
  };

  private releaseKeys(shouldRelease: (code: string) => boolean): void {
    for (const code of this.heldKeys) {
      if (!shouldRelease(code)) {
        continue;
      }

      this.heldKeys.delete(code);
      this.channel.send(keyEvent(InputType.KeyUp, code, NO_MODIFIERS));
    }
  }

  private agentVideo(target: EventTarget | null): HTMLVideoElement | undefined {
    if (!(target instanceof HTMLVideoElement)) {
      return undefined;
    }

    const track = this.room.remoteParticipants
      .get(this.agentIdentity)
      ?.getTrackPublication(Track.Source.ScreenShare)?.videoTrack;
    return track?.attachedElements.includes(target) ? target : undefined;
  }

  private videoPoint(video: HTMLVideoElement, event: MouseEvent): Point | undefined {
    return toVideoPoint(
      { x: event.clientX, y: event.clientY },
      video.getBoundingClientRect(),
      { width: video.videoWidth, height: video.videoHeight },
      getComputedStyle(video).objectFit,
    );
  }
}
