// Simple in-memory financial helpers for demonstration purposes
const STUDENT_ANNUAL_LIMIT = 4500;
const _studentBalance = Object.create(null); // email -> remaining credits

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getStudentBalance(email) {
  const key = normalizeEmail(email);
  if (!key) return 0;
  if (_studentBalance[key] === undefined) _studentBalance[key] = STUDENT_ANNUAL_LIMIT;
  return _studentBalance[key];
}

function deductCredits(email, amount) {
  const key = normalizeEmail(email);
  if (!key) return { deducted: 0, remaining: 0 };

  const current = getStudentBalance(key);
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return { deducted: 0, remaining: current };
  }

  const deducted = Math.min(numericAmount, current);
  _studentBalance[key] = current - deducted;
  return { deducted, remaining: _studentBalance[key] };
}

function getCostCentre(email) {
  // stub: in a real system we'd look up the staff's cost centre or RCA
  // here we just return a fixed string or hash on email for demo
  if (!email) return "UNKNOWN";
  const hash = (email.length * 7 + email.charCodeAt(0)) % 10000;
  return `RCA-${String(hash).padStart(4, "0")}`;
}

module.exports = {
  getStudentBalance,
  deductCredits,
  getCostCentre,
};
