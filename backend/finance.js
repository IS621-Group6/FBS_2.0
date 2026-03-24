const STUDENT_ANNUAL_LIMIT = 4500;
const STUDENT_BOOKING_CREDIT_COST = 100;
const _studentBalance = Object.create(null);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function ensureBalanceRow(db, email) {
  if (!db) return;
  db.prepare(
    `INSERT INTO student_credit_balances (email, remaining_credits)
     VALUES (?, ?)
     ON CONFLICT(email) DO NOTHING`
  ).run(email, STUDENT_ANNUAL_LIMIT);
}

function getStudentBalance(email, { db } = {}) {
  const key = normalizeEmail(email);
  if (!key) return 0;

  if (db) {
    ensureBalanceRow(db, key);
    const row = db
      .prepare(`SELECT remaining_credits FROM student_credit_balances WHERE email = ? LIMIT 1`)
      .get(key);
    return Number(row?.remaining_credits) || 0;
  }

  if (_studentBalance[key] === undefined) _studentBalance[key] = STUDENT_ANNUAL_LIMIT;
  return _studentBalance[key];
}

function deductCredits(email, amount, { db } = {}) {
  const key = normalizeEmail(email);
  if (!key) return { allowed: false, deducted: 0, remaining: 0 };

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { allowed: true, deducted: 0, remaining: getStudentBalance(key, { db }) };
  }

  const current = getStudentBalance(key, { db });
  if (current < numericAmount) {
    return { allowed: false, deducted: 0, remaining: current };
  }

  const deducted = numericAmount;

  if (db) {
    db.prepare(
      `UPDATE student_credit_balances
       SET remaining_credits = remaining_credits - ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE email = ?`
    ).run(deducted, key);
    return { allowed: true, deducted, remaining: current - deducted };
  }

  _studentBalance[key] = current - deducted;
  return { allowed: true, deducted, remaining: _studentBalance[key] };
}

function refundCredits(email, amount, { db } = {}) {
  const key = normalizeEmail(email);
  if (!key) return { refunded: 0, remaining: 0 };

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { refunded: 0, remaining: getStudentBalance(key, { db }) };
  }

  const current = getStudentBalance(key, { db });
  const refunded = Math.max(0, Math.min(numericAmount, STUDENT_ANNUAL_LIMIT - current));

  if (db) {
    db.prepare(
      `UPDATE student_credit_balances
       SET remaining_credits = remaining_credits + ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
       WHERE email = ?`
    ).run(refunded, key);
    return { refunded, remaining: current + refunded };
  }

  _studentBalance[key] = current + refunded;
  return { refunded, remaining: _studentBalance[key] };
}

function getCancellationCreditRefund(bookingStartIso, creditsCharged, creditsRefunded = 0) {
  const charged = Math.max(0, Number(creditsCharged) || 0);
  const alreadyRefunded = Math.max(0, Number(creditsRefunded) || 0);
  const remainingEligible = Math.max(0, charged - alreadyRefunded);
  if (remainingEligible <= 0) return 0;

  const bookingStart = new Date(String(bookingStartIso || ""));
  if (Number.isNaN(bookingStart.getTime())) {
    return remainingEligible;
  }

  const msUntilStart = bookingStart.getTime() - Date.now();
  if (msUntilStart < 24 * 60 * 60 * 1000) {
    return Math.max(0, Math.floor(remainingEligible * 0.5));
  }

  return remainingEligible;
}

function getCostCentre(email) {
  if (!email) return "UNKNOWN";
  const hash = (email.length * 7 + email.charCodeAt(0)) % 10000;
  return `RCA-${String(hash).padStart(4, "0")}`;
}

module.exports = {
  STUDENT_ANNUAL_LIMIT,
  STUDENT_BOOKING_CREDIT_COST,
  getCancellationCreditRefund,
  getStudentBalance,
  deductCredits,
  refundCredits,
  getCostCentre,
};