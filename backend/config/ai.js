'use strict';

function isAiConfigured() {
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  return key.length > 10 && !key.startsWith('sk-your');
}

function getOpenAiModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function getDailyLimit() {
  const n = parseInt(process.env.AI_DAILY_LIMIT_PER_USER || '15', 10);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

module.exports = {
  isAiConfigured,
  getOpenAiModel,
  getDailyLimit,
};
