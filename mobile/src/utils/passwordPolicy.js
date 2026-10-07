const MIN_PASSWORD_LENGTH = 10;

const COMMON_PASSWORDS = new Set([
  '1234567890', '123456789', '0123456789', '1111111111', '0000000000',
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'passw0rd1',
  'qwerty123', 'qwerty1234', 'qwerty12345', 'qwertyuiop', '1q2w3e4r', '1q2w3e4r5t', '1qaz2wsx',
  'abc123456', 'abc1234567', 'iloveyou', 'iloveyou1', 'iloveyou123', 'letmein', 'letmein123',
  'welcome1', 'welcome123', 'admin123', 'admin1234', 'changeme', 'changeme123',
  'football', 'football1', 'football123', 'sunshine1', 'sunshine123', 'princess1', 'princess123',
  'monkey123', 'monkey1234', 'dragon123', 'master123', 'shadow123', 'superman1', 'superman123',
  'batman123', 'starwars1', 'starwars123', 'baseball1', 'baseball123', 'trustno1', 'whatever1',
  'internet1', 'internet123', 'computer1', 'computer123',
]);

export const PASSWORD_TOO_SHORT = 'Fjalëkalimi duhet të ketë të paktën 10 karaktere';
export const PASSWORD_TOO_COMMON = 'Ky fjalëkalim është shumë i zakonshëm. Zgjidh një tjetër.';

export function passwordPolicyMessage(password) {
  const value = password == null ? '' : String(password);
  if (value.length < MIN_PASSWORD_LENGTH) return PASSWORD_TOO_SHORT;
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return PASSWORD_TOO_COMMON;
  return '';
}
