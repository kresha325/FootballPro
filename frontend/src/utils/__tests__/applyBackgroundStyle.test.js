import { describe, expect, it, beforeEach } from 'vitest';
import { applyBackgroundStyle } from '../applyBackgroundStyle';

describe('applyBackgroundStyle', () => {
  beforeEach(() => {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundRepeat = '';
  });

  it('sets background image and color when bgImage provided', () => {
    applyBackgroundStyle('#fff', 'https://example.com/bg.png');

    expect(document.body.style.backgroundImage).toContain('bg.png');
    expect(document.body.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(document.body.style.backgroundSize).toBe('cover');
    expect(document.body.style.backgroundRepeat).toBe('no-repeat');
  });

  it('sets background color when only bgColor provided', () => {
    applyBackgroundStyle('#000');

    expect(document.body.style.backgroundImage).toBe('');
    expect(document.body.style.backgroundColor).toBe('rgb(0, 0, 0)');
    expect(document.body.style.backgroundSize).toBe('');
    expect(document.body.style.backgroundRepeat).toBe('');
  });

  it('clears background styles when no arguments provided', () => {
    applyBackgroundStyle();

    expect(document.body.style.backgroundImage).toBe('');
    expect(document.body.style.backgroundColor).toBe('');
    expect(document.body.style.backgroundSize).toBe('');
    expect(document.body.style.backgroundRepeat).toBe('');
  });
});
