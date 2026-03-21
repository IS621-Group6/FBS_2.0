const MAX_BOOKING_MINUTES = 180;

function invalid(res) {
  return res.status(400).json({ message: "Invalid input" });
}

function isValidDate(dateStr) {
  if (typeof dateStr !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidTime(timeStr) {
  if (typeof timeStr !== "string") return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
}

function toMinutes(timeStr) {
  if (!isValidTime(timeStr)) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function containsMaliciousInput(value) {
  if (typeof value !== "string") return false;

  const suspiciousPatterns = [
    /<script/i,
    /<\/script>/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /drop\s+table/i,
    /union\s+select/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /--/,
    /;/,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(value));
}

function sanitizeText(value) {
  if (typeof value !== "string") return value;
  return value.trim();
}

function validateBookingInput(req, res, next) {
  const { facilityId, date, start, end, userEmail, reason } = req.body || {};

  // required fields
  if (!facilityId || !date || !start || !end) {
    return invalid(res);
  }

  // type checks
  if (
    typeof facilityId !== "string" ||
    typeof date !== "string" ||
    typeof start !== "string" ||
    typeof end !== "string"
  ) {
    return invalid(res);
  }

  if (userEmail !== undefined && typeof userEmail !== "string") {
    return invalid(res);
  }

  if (reason !== undefined && typeof reason !== "string") {
    return invalid(res);
  }

  // sanitize optional/free-text fields
  const cleanFacilityId = sanitizeText(facilityId);
  const cleanDate = sanitizeText(date);
  const cleanStart = sanitizeText(start);
  const cleanEnd = sanitizeText(end);
  const cleanUserEmail = userEmail !== undefined ? sanitizeText(userEmail) : undefined;
  const cleanReason = reason !== undefined ? sanitizeText(reason) : undefined;

  // format checks
  if (!isValidDate(cleanDate) || !isValidTime(cleanStart) || !isValidTime(cleanEnd)) {
    return invalid(res);
  }

  // malicious input checks
  const valuesToCheck = [
    cleanFacilityId,
    cleanDate,
    cleanStart,
    cleanEnd,
    cleanUserEmail,
    cleanReason,
  ].filter((v) => typeof v === "string");

  for (const value of valuesToCheck) {
    if (containsMaliciousInput(value)) {
      return invalid(res);
    }
  }

  // logical consistency
  const startMin = toMinutes(cleanStart);
  const endMin = toMinutes(cleanEnd);

  if (startMin === null || endMin === null || startMin >= endMin) {
    return invalid(res);
  }

  // booking duration constraint
  if (endMin - startMin > MAX_BOOKING_MINUTES) {
    return invalid(res);
  }

  // overwrite body with sanitized values
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