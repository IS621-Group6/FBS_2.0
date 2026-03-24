const MAX_BOOKING_MINUTES = 180;
const MAX_REASON_LENGTH = 200;
const MAX_FACILITY_ID_LENGTH = 50;
const MAX_EMAIL_LENGTH = 254;

function invalid(res, message = "Invalid input") {
  return res.status(400).json({ message });
}

function sanitizeText(value) {
  if (typeof value !== "string") return value;
  return value.trim();
}

function isValidDate(dateStr) {
  if (typeof dateStr !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidTime(timeStr) {
  if (typeof timeStr !== "string") return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
}

function isValidFacilityId(value) {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > MAX_FACILITY_ID_LENGTH) return false;
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  if (value.length < 3 || value.length > MAX_EMAIL_LENGTH) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
}

function isValidReason(value) {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > MAX_REASON_LENGTH) return false;
  return /^[A-Za-z0-9 .,:()&/_-]+$/.test(value);
}

function toMinutes(timeStr) {
  if (!isValidTime(timeStr)) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function validateBookingInput(req, res, next) {
  const { facilityId, date, start, end, userEmail, reason } = req.body || {};

  if (!facilityId || !date || !start || !end) {
    return invalid(res, "Missing required booking fields");
  }

  if (
    typeof facilityId !== "string" ||
    typeof date !== "string" ||
    typeof start !== "string" ||
    typeof end !== "string"
  ) {
    return invalid(res);
  }

  // optional type checks
  if (userEmail !== undefined && typeof userEmail !== "string") {
    return invalid(res);
  }

  if (reason !== undefined && typeof reason !== "string") {
    return invalid(res);
  }

  const cleanFacilityId = sanitizeText(facilityId);
  const cleanDate = sanitizeText(date);
  const cleanStart = sanitizeText(start);
  const cleanEnd = sanitizeText(end);
  const cleanUserEmail =
    userEmail !== undefined ? sanitizeText(userEmail) : undefined;
  const cleanReason =
    reason !== undefined ? sanitizeText(reason) : undefined;

  if (!isValidFacilityId(cleanFacilityId)) {
    return invalid(res);
  }

  if (!isValidDate(cleanDate)) {
    return invalid(res, "Invalid date format. Use YYYY-MM-DD.");
  }

  if (!isValidTime(cleanStart) || !isValidTime(cleanEnd)) {
    return invalid(res, "Invalid time range");
  }

  if (cleanUserEmail !== undefined && !isValidEmail(cleanUserEmail)) {
    return invalid(res);
  }

  if (cleanReason !== undefined && !isValidReason(cleanReason)) {
    return invalid(res);
  }

  const startMin = toMinutes(cleanStart);
  const endMin = toMinutes(cleanEnd);

  if (startMin === null || endMin === null || startMin >= endMin) {
    return invalid(res, "Invalid time range");
  }

  if (endMin - startMin > MAX_BOOKING_MINUTES) {
    return invalid(res, "Bookings are limited to 3 hours.");
  }

  req.body = {
    ...req.body,
    facilityId: cleanFacilityId,
    date: cleanDate,
    start: cleanStart,
    end: cleanEnd,
    userEmail: cleanUserEmail,
    reason: cleanReason,
  };

  next();
}

module.exports = validateBookingInput;