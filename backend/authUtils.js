const bcrypt = require("bcrypt");

const BCRYPT_ROUNDS = 10;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeRole(role, fallback = "student") {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized || fallback;
}

function resolveBookingRole({ userRole, headerRole, bodyRole, fallback = "student" } = {}) {
  return normalizeRole(userRole || headerRole || bodyRole || fallback, fallback);
}

function hashPasswordSync(password) {
  return bcrypt.hashSync(String(password || ""), BCRYPT_ROUNDS);
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(String(password || ""), String(passwordHash));
}

module.exports = {
  BCRYPT_ROUNDS,
  hashPasswordSync,
  normalizeEmail,
  normalizeRole,
  resolveBookingRole,
  verifyPassword,
};