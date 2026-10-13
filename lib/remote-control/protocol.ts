// Wire format for the remote-agent control protocol.
// See remote-agent/lat.md/control.md and docs/LIVEKIT_TOPICS.md.

export const CONTROL_TOPIC = '/control';
export const CAPABILITIES_TOPIC = '/capabilities';
export const PROTOCOL_VERSION = 1;

// The agent rejects clipboard text larger than 256 KiB.
export const MAX_CLIPBOARD_BYTES = 256 * 1024;

const CLIPBOARD_SET_TYPE = 'clipboard_set';
const PLAIN_TEXT_MIME_TYPE = 'text/plain';

export enum InputType {
  MouseButton = 'mouse_button',
  KeyDown = 'key_down',
  KeyUp = 'key_up',
}

export enum MouseButton {
  Left = 1,
  Middle = 2,
  Right = 3,
}

export enum ButtonState {
  Released,
  Pressed,
}

export type Point = { x: number; y: number };

export type Rect = { left: number; top: number; width: number; height: number };

export type Size = { width: number; height: number };

export type Modifiers = { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean };

export type InputEvent = {
  v: number;
  type: InputType;
  ts: number;
  x?: number;
  y?: number;
  button?: MouseButton;
  pressed?: boolean;
  key?: string;
} & Modifiers;

export type ClipboardSetMessage = {
  type: typeof CLIPBOARD_SET_TYPE;
  data: { text: string; mime_type: string };
};

export type ControlMessage = InputEvent | ClipboardSetMessage;

// DOM MouseEvent.button values: 0 = main, 1 = auxiliary, 2 = secondary.
const DOM_BUTTONS: Record<number, MouseButton> = {
  0: MouseButton.Left,
  1: MouseButton.Middle,
  2: MouseButton.Right,
};

export function toMouseButton(domButton: number): MouseButton | undefined {
  return DOM_BUTTONS[domButton];
}

export function toModifiers(event: {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}): Modifiers {
  return { shift: event.shiftKey, ctrl: event.ctrlKey, alt: event.altKey, meta: event.metaKey };
}

// Maps a client point to normalized coordinates on the video picture,
// excluding letterboxing added by object-fit. Returns undefined outside it.
// Example: a 1600x900 video in a 1600x1000 "contain" box has 50px bars,
// so client (800, 50) maps to (0.5, 0).
export function toVideoPoint(
  client: Point,
  box: Rect,
  video: Size,
  objectFit: string,
): Point | undefined {
  if (video.width <= 0 || video.height <= 0 || box.width <= 0 || box.height <= 0) {
    return undefined;
  }

  let contentWidth = box.width;
  let contentHeight = box.height;
  if (objectFit === 'contain' || objectFit === 'cover') {
    const scaleX = box.width / video.width;
    const scaleY = box.height / video.height;
    const scale = objectFit === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
    contentWidth = video.width * scale;
    contentHeight = video.height * scale;
  }

  const offsetX = (box.width - contentWidth) / 2;
  const offsetY = (box.height - contentHeight) / 2;
  const x = (client.x - box.left - offsetX) / contentWidth;
  const y = (client.y - box.top - offsetY) / contentHeight;
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    return undefined;
  }

  return { x, y };
}

// A release may omit the position so a button never sticks when the
// pointer leaves the picture before it is released.
export function buttonEvent(
  button: MouseButton,
  state: ButtonState,
  point: Point | undefined,
  modifiers: Modifiers,
): InputEvent {
  return {
    v: PROTOCOL_VERSION,
    type: InputType.MouseButton,
    ts: Date.now(),
    ...point,
    button,
    pressed: state === ButtonState.Pressed,
    ...modifiers,
  };
}

// code is a DOM KeyboardEvent.code such as "KeyA" or "ShiftLeft".
export function keyEvent(
  type: InputType.KeyDown | InputType.KeyUp,
  code: string,
  modifiers: Modifiers,
): InputEvent {
  return { v: PROTOCOL_VERSION, type, ts: Date.now(), key: code, ...modifiers };
}

// Returns undefined when the text exceeds the agent's size limit.
export function clipboardSet(text: string): ClipboardSetMessage | undefined {
  if (new TextEncoder().encode(text).length > MAX_CLIPBOARD_BYTES) {
    return undefined;
  }

  return { type: CLIPBOARD_SET_TYPE, data: { text, mime_type: PLAIN_TEXT_MIME_TYPE } };
}

// Parses an agent /capabilities payload and reports whether it accepts control.
export function supportsControl(payload: Uint8Array): boolean {
  try {
    const message = JSON.parse(new TextDecoder().decode(payload));
    return message?.type === CAPABILITIES_TOPIC && message.supports_control === true;
  } catch {
    return false;
  }
}
