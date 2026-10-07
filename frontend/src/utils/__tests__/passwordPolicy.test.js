import { describe, expect, it } from 'vitest';
import { PASSWORD_TOO_COMMON, PASSWORD_TOO_SHORT, passwordPolicyMessage } from '../passwordPolicy';

describe('passwordPolicyMessage', () => {
  it('matches the server messages for short and common passwords', () => {
    expect(passwordPolicyMessage('short')).toBe(PASSWORD_TOO_SHORT);
    expect(passwordPolicyMessage('Password123')).toBe(PASSWORD_TOO_COMMON);
    expect(passwordPolicyMessage('Korra-nates-2026')).toBe('');
  });
});
