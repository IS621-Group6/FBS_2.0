function pad2(n) {
  return String(n).padStart(2, "0");
}

function singaporeTodayIso() {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const day = parts.find((p) => p.type === "day")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const year = parts.find((p) => p.type === "year")?.value;
    if (day && month && year) {
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Fall through to UTC+8 fallback.
  }

  const now = new Date();
  const utcMillis = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const singaporeMillis = utcMillis + 8 * 60 * 60 * 1000;
  const singaporeDate = new Date(singaporeMillis);

  const year = singaporeDate.getUTCFullYear();
  const month = pad2(singaporeDate.getUTCMonth() + 1);
  const day = pad2(singaporeDate.getUTCDate());
  return `${year}-${month}-${day}`;
}

function isIsoYmd(value) {
  const str = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = str.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === str;
}

function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function toHHMM(minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function toIsoUtcFromDateAndMinutes(dateYmd, minutesFromMidnight) {
  const raw = String(dateYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const [yy, mm, dd] = raw.split("-").map((x) => Number(x));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;

  const mins = Number(minutesFromMidnight);
  if (!Number.isFinite(mins)) return null;

  const base = Date.UTC(yy, mm - 1, dd, 0, 0, 0);
  const dt = new Date(base + mins * 60 * 1000);
  const Y = dt.getUTCFullYear();
  const M = pad2(dt.getUTCMonth() + 1);
  const D = pad2(dt.getUTCDate());
  const H = pad2(dt.getUTCHours());
  const Min = pad2(dt.getUTCMinutes());
  return `${Y}-${M}-${D}T${H}:${Min}:00Z`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

module.exports = {
  isIsoYmd,
  overlaps,
  pad2,
  singaporeTodayIso,
  toHHMM,
  toIsoUtcFromDateAndMinutes,
  toMinutes,
};