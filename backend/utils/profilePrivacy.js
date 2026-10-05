'use strict';

const LEVELS = ['public', 'followers', 'private'];

const PRIVACY_KEYS = [
  'dateOfBirth',
  'contact',
  'agent',
  'location',
  'email',
  'phone',
  'videos',
  'gallery',
  'career',
];

/** Email and phone stay private until the player opens them. Other fields stay public so existing CVs do not go blank. */
const DEFAULT_PRIVACY = {
  dateOfBirth: 'public',
  contact: 'public',
  agent: 'followers',
  location: 'public',
  email: 'private',
  phone: 'private',
  videos: 'public',
  gallery: 'public',
  career: 'public',
};

const PROFESSIONAL_ROLES = new Set(['scout', 'club', 'manager', 'federation', 'coach', 'admin']);

function normalizeLevel(value, fallback) {
  const level = String(value || '').trim().toLowerCase();
  if (LEVELS.includes(level)) return level;
  return fallback;
}

function normalizePrivacy(raw) {
  const privacy = { ...DEFAULT_PRIVACY };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return privacy;
  for (const key of PRIVACY_KEYS) {
    if (raw[key] == null || raw[key] === '') continue;
    privacy[key] = normalizeLevel(raw[key], privacy[key]);
  }
  return privacy;
}

function parsePrivacyInput(raw) {
  if (raw == null || raw === '') return { ok: true, privacy: null };
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, msg: 'Privacy settings must be an object.', field: 'privacy' };
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, msg: 'Privacy settings must be an object.', field: 'privacy' };
  }
  const privacy = {};
  for (const key of Object.keys(value)) {
    if (!PRIVACY_KEYS.includes(key)) {
      return { ok: false, msg: `Unknown privacy field: ${key}`, field: 'privacy' };
    }
    const level = String(value[key] || '').trim().toLowerCase();
    if (!LEVELS.includes(level)) {
      return { ok: false, msg: `${key} must be public, followers, or private.`, field: 'privacy' };
    }
    privacy[key] = level;
  }
  return { ok: true, privacy };
}

function isProfessionalRole(role) {
  return PROFESSIONAL_ROLES.has(String(role || '').toLowerCase());
}

function canView(level, { isOwner = false, isFollower = false, isProfessional = false } = {}) {
  if (isOwner) return true;
  const vis = normalizeLevel(level, 'private');
  if (vis === 'public') return true;
  if (vis === 'followers') return Boolean(isFollower || isProfessional);
  return false;
}

function canViewGalleryItem(item, profilePrivacy, viewer) {
  if (viewer.isOwner) return true;
  if (!canView(profilePrivacy.gallery, viewer)) return false;
  const itemLevel = normalizeLevel(item?.visibility, 'public');
  if (itemLevel === 'private') return false;
  if (itemLevel === 'followers') return canView('followers', viewer);
  if (String(item?.type || '').toLowerCase() === 'video' || String(item?.type || '').toLowerCase() === 'highlight') {
    return canView(profilePrivacy.videos, viewer);
  }
  return true;
}

function applyProfilePrivacy(response, viewer, privacyInput) {
  if (!response || typeof response !== 'object') return response;
  const privacy = normalizePrivacy(privacyInput ?? response.privacy);
  response.privacy = viewer.isOwner ? privacy : undefined;

  if (!viewer.isOwner) {
    delete response.email;
    delete response.joncoinBalance;
    delete response.parentVerificationToken;
  }

  if (!canView(privacy.dateOfBirth, viewer)) {
    response.dateOfBirth = null;
  }

  if (!canView(privacy.location, viewer)) {
    response.city = null;
  }

  if (!canView(privacy.career, viewer)) {
    response.careerHistory = [];
  }

  const stats =
    response.stats && typeof response.stats === 'object' && !Array.isArray(response.stats)
      ? { ...response.stats }
      : null;
  if (stats && !canView(privacy.agent, viewer)) {
    delete stats.agentName;
    delete stats.agencyName;
    delete stats.agent;
    delete stats.agency;
  }
  if (stats) response.stats = stats;

  if (!response.contact || typeof response.contact !== 'object' || Array.isArray(response.contact)) {
    response.contact = response.contact && typeof response.contact === 'object' ? response.contact : {};
  }
  if (!canView(privacy.agent, viewer)) {
    delete response.contact.agent;
    delete response.contact.agency;
    delete response.contact.agentName;
    delete response.contact.agencyName;
  }
  if (!canView(privacy.contact, viewer)) {
    response.contact = {};
  } else {
    if (!canView(privacy.email, viewer)) delete response.contact.email;
    if (!canView(privacy.phone, viewer)) delete response.contact.phone;
  }
  if (response.contact && Object.keys(response.contact).length === 0) {
    response.contact = {};
  }

  if (Array.isArray(response.galleryPreview) && !canView(privacy.gallery, viewer)) {
    response.galleryPreview = [];
    response.galleryCount = 0;
  } else if (Array.isArray(response.galleryPreview)) {
    response.galleryPreview = response.galleryPreview.filter((item) => canViewGalleryItem(item, privacy, viewer));
    if (!canView(privacy.videos, viewer)) {
      response.galleryPreview = response.galleryPreview.filter((item) => {
        const type = String(item?.type || '').toLowerCase();
        return type !== 'video' && type !== 'highlight' && !item?.videoUrl;
      });
    }
  }

  if (!canView(privacy.videos, viewer) && Array.isArray(response.liveVideos)) {
    response.liveVideos = [];
  }

  return response;
}

module.exports = {
  LEVELS,
  PRIVACY_KEYS,
  DEFAULT_PRIVACY,
  PROFESSIONAL_ROLES,
  normalizePrivacy,
  parsePrivacyInput,
  isProfessionalRole,
  canView,
  canViewGalleryItem,
  applyProfilePrivacy,
};
