import { describe, it, expect } from 'vitest';
import {
  ButtonState,
  InputType,
  MAX_CLIPBOARD_BYTES,
  MouseButton,
  buttonEvent,
  clipboardSet,
  keyEvent,
  supportsControl,
  toMouseButton,
  toVideoPoint,
} from './protocol';

const NO_MODIFIERS = { shift: false, ctrl: false, alt: false, meta: false };

describe('toVideoPoint', () => {
  const box = { left: 100, top: 0, width: 1600, height: 1000 };
  const video = { width: 1600, height: 900 };

  it('excludes contain letterboxing', () => {
    expect(toVideoPoint({ x: 900, y: 50 }, box, video, 'contain')).toEqual({ x: 0.5, y: 0 });
    expect(toVideoPoint({ x: 1700, y: 950 }, box, video, 'contain')).toEqual({ x: 1, y: 1 });
  });

  it('rejects points on the letterbox bars', () => {
    expect(toVideoPoint({ x: 900, y: 10 }, box, video, 'contain')).toBeUndefined();
  });

  it('accounts for cover cropping', () => {
    // Scale is 1000/900, so the picture is ~1777px wide and cropped at both sides.
    const point = toVideoPoint({ x: 900, y: 500 }, box, video, 'cover');
    expect(point?.x).toBeCloseTo(0.5);
    expect(point?.y).toBeCloseTo(0.5);
  });

  it('stretches with fill', () => {
    expect(toVideoPoint({ x: 500, y: 250 }, box, video, 'fill')).toEqual({ x: 0.25, y: 0.25 });
  });

  it('rejects a video without dimensions', () => {
    expect(toVideoPoint({ x: 0, y: 0 }, box, { width: 0, height: 0 }, 'contain')).toBeUndefined();
  });
});

describe('toMouseButton', () => {
  it('maps DOM buttons to protocol buttons', () => {
    expect(toMouseButton(0)).toBe(MouseButton.Left);
    expect(toMouseButton(1)).toBe(MouseButton.Middle);
    expect(toMouseButton(2)).toBe(MouseButton.Right);
    expect(toMouseButton(3)).toBeUndefined();
  });
});

describe('buttonEvent', () => {
  it('keeps a top-left position explicit', () => {
    const event = JSON.parse(
      JSON.stringify(
        buttonEvent(MouseButton.Left, ButtonState.Pressed, { x: 0, y: 0 }, NO_MODIFIERS),
      ),
    );
    expect(event).toMatchObject({
      v: 1,
      type: 'mouse_button',
      x: 0,
      y: 0,
      button: 1,
      pressed: true,
    });
  });

  it('omits the position when none is given', () => {
    const event = buttonEvent(MouseButton.Right, ButtonState.Released, undefined, NO_MODIFIERS);
    expect(event).not.toHaveProperty('x');
    expect(event).toMatchObject({ button: 3, pressed: false });
  });
});

describe('keyEvent', () => {
  it('carries the DOM code and modifiers', () => {
    const event = keyEvent(InputType.KeyDown, 'KeyC', { ...NO_MODIFIERS, meta: true });
    expect(event).toMatchObject({ v: 1, type: 'key_down', key: 'KeyC', meta: true });
  });
});

describe('clipboardSet', () => {
  it('builds a plain-text envelope', () => {
    expect(clipboardSet('héllo ✓')).toEqual({
      type: 'clipboard_set',
      data: { text: 'héllo ✓', mime_type: 'text/plain' },
    });
  });

  it('enforces the byte limit, not the character limit', () => {
    expect(clipboardSet('a'.repeat(MAX_CLIPBOARD_BYTES))).toBeDefined();
    expect(clipboardSet('é'.repeat(MAX_CLIPBOARD_BYTES / 2 + 1))).toBeUndefined();
  });
});

describe('supportsControl', () => {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

  it('accepts an agent that advertises control', () => {
    expect(supportsControl(encode({ type: '/capabilities', supports_control: true }))).toBe(true);
  });

  it('rejects view-only agents and malformed payloads', () => {
    expect(supportsControl(encode({ type: '/capabilities', supports_control: false }))).toBe(false);
    expect(supportsControl(new TextEncoder().encode('not json'))).toBe(false);
  });
});
