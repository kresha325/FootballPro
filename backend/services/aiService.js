'use strict';

const { isAiConfigured, getOpenAiModel } = require('../config/ai');

async function chatCompletion(systemPrompt, userPrompt, maxTokens = 450) {
  if (!isAiConfigured()) {
    const err = new Error('AI_NOT_CONFIGURED');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.65,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `OpenAI HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = 'AI_PROVIDER_ERROR';
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const err = new Error('Empty AI response');
    err.code = 'AI_EMPTY';
    throw err;
  }
  return text;
}

function buildProfileContext(user, profile, hints = {}) {
  const role = user?.role || hints.role || 'athlete';
  const stats = profile?.stats && typeof profile.stats === 'object' ? profile.stats : {};
  const lines = [
    `Roli: ${role}`,
    `Emri: ${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
    profile?.position ? `Pozicioni: ${profile.position}` : null,
    profile?.club ? `Klubi: ${profile.club}` : null,
    profile?.city ? `Qyteti: ${profile.city}` : null,
    profile?.country ? `Shteti: ${profile.country}` : null,
    stats.goals != null ? `Gola: ${stats.goals}` : null,
    stats.assists != null ? `Asistime: ${stats.assists}` : null,
    stats.matches != null ? `Ndeshje: ${stats.matches}` : null,
    hints.extra ? `Shtesë nga përdoruesi: ${hints.extra}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

async function generateProfileBio(user, profile, hints = {}) {
  const lang = hints.language === 'en' ? 'English' : 'Albanian';
  const system = `You write short football profile bios for X Talenti (talent platform).
Write in ${lang}. Max 2-3 sentences, max 480 characters. Professional, motivating, no hashtags, no emojis.
Do not invent stats not provided. Output only the bio text.`;

  const userPrompt = `Write a profile bio for:\n${buildProfileContext(user, profile, hints)}`;
  let bio = await chatCompletion(system, userPrompt, 350);
  if (bio.length > 500) bio = bio.slice(0, 497) + '…';
  return bio;
}

async function generateScoutSummary(targetUser, targetProfile, scoutUser) {
  const stats = targetProfile?.stats && typeof targetProfile.stats === 'object' ? targetProfile.stats : {};
  const system = `You are a football scout assistant for X Talenti.
Write a concise scouting note in Albanian (3-5 bullet points as plain text, use • for bullets).
Be factual based only on provided data. Mention strengths, fit, and one risk or unknown.
Max 600 characters. No invented statistics.`;

  const userPrompt = [
    `Skauti: ${scoutUser?.firstName || ''} ${scoutUser?.lastName || ''}`.trim(),
    `Lojtari: ${targetUser?.firstName || ''} ${targetUser?.lastName || ''}`.trim(),
    targetProfile?.position ? `Pozicioni: ${targetProfile.position}` : '',
    targetProfile?.club ? `Klubi: ${targetProfile.club}` : '',
    targetProfile?.city || targetProfile?.country
      ? `Vendndodhja: ${[targetProfile.city, targetProfile.country].filter(Boolean).join(', ')}`
      : '',
    targetProfile?.bio ? `Bio aktuale: ${targetProfile.bio}` : '',
    stats.goals != null ? `Gola: ${stats.goals}` : '',
    stats.assists != null ? `Asistime: ${stats.assists}` : '',
    stats.matches != null ? `Ndeshje: ${stats.matches}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return chatCompletion(system, userPrompt, 500);
}

async function suggestPostCaption(hints = {}) {
  const system = `You suggest short social post captions for football players on X Talenti.
Albanian, max 120 characters, optional 2-3 hashtags at end. Output caption only.`;
  const topic = hints.topic || hints.content || 'futboll';
  const parts = [
    `Tema: ${topic}`,
    hints.hasMedia ? 'Ka foto/video të bashkangjitur.' : null,
    hints.location ? `Vendndodhja: ${hints.location}` : null,
    hints.role ? `Roli i autorit: ${hints.role}` : null,
  ].filter(Boolean);
  const userPrompt = parts.join('\n') || 'Postim futbolli në X Talenti';
  let caption = await chatCompletion(system, userPrompt, 120);
  if (caption.length > 200) caption = caption.slice(0, 197) + '…';
  return caption;
}

module.exports = {
  generateProfileBio,
  generateScoutSummary,
  suggestPostCaption,
  isAiConfigured,
};
