// utils/sponsor.js

export function isUserSponsored(userId) {
  try {
    const data = localStorage.getItem('sponsorData');
    if (!data) return false;
    const parsed = JSON.parse(data);
    if (!parsed[userId]) return false;
    return Array.isArray(parsed[userId]) && parsed[userId].some(s => s && s.name);
  } catch {
    return false;
  }
}
