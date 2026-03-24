const NodeCache = require("node-cache");

const MAX_LOGIN_FAILURES = Number(process.env.MAX_LOGIN_FAILURES) || 5;
const LOCKOUT_DURATION_MS = Number(process.env.LOGIN_LOCKOUT_MS) || 15 * 60 * 1000;

const cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 });

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

function getFailureRecord(email) {
  return cache.get(normalizeEmail(email)) || { count: 0, lockedUntil: null };
}

function recordFailedLogin(email) {
  const key = normalizeEmail(email);
  const record = getFailureRecord(key);

  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    cache.set(key, record);
    return record;
  }

  record.count = (record.count || 0) + 1;
  if (record.count >= MAX_LOGIN_FAILURES) {
    record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }

  cache.set(key, record);
  return record;
}

function resetFailureCount(email) {
  cache.del(normalizeEmail(email));
}

function isLockedOut(email) {
  const record = getFailureRecord(email);
  return Boolean(record.lockedUntil && Date.now() < record.lockedUntil);
}

function getRemainingLockoutMs(email) {
  const record = getFailureRecord(email);
  if (!record.lockedUntil) return 0;
  return Math.max(0, record.lockedUntil - Date.now());
}

module.exports = {
  MAX_LOGIN_FAILURES,
  LOCKOUT_DURATION_MS,
  getFailureRecord,
  recordFailedLogin,
  resetFailureCount,
  isLockedOut,
  getRemainingLockoutMs,
};