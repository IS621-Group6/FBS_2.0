// Simple in-memory financial helpers for demonstration purposes
const STUDENT_ANNUAL_LIMIT = 4500;
const _studentBalance = {}; // email -> remaining credits

function getStudentBalance(email) {
  if (!email) return 0;
  if (_studentBalance[email] === undefined) _studentBalance[email] = STUDENT_ANNUAL_LIMIT;
  return _studentBalance[email];
}

function deductCredits(email, amount) {
  const current = getStudentBalance(email);
  const deducted = Math.min(amount, current);
  _studentBalance[email] = current - deducted;
  return { deducted, remaining: _studentBalance[email] };
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
