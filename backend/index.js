const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { getDb, sqliteHealth } = require("./sqlite");
const rateLimit = require("express-rate-limit");

const {
  recordFailedLogin,
  resetFailureCount,
  isLockedOut,
  getRemainingLockoutMs,
  MAX_LOGIN_FAILURES,
} = require("./authLimiter");
const { hashPasswordSync, normalizeEmail, resolveBookingRole, verifyPassword } = require("./authUtils");
const { insertAuditLog, selectAuditLogs } = require("./auditLogs");
const { FACILITIES, SINGLE_CAMPUS_LABEL, facilityTypeForCapacity } = require("./facilityData");
const {
  STUDENT_BOOKING_CREDIT_COST,
  deductCredits,
  getCancellationCreditRefund,
  getCostCentre,
  getStudentBalance,
  refundCredits,
} = require("./finance");
const validateBookingInput = require("./middleware/validateBookingInput");
const { createRequestAuthHelpers } = require("./requestAuth");
const { buildSearchCacheKey, rankFacilities } = require("./searchUtils");
const {
  isIsoYmd,
  overlaps,
  singaporeTodayIso,
  toHHMM,
  toIsoUtcFromDateAndMinutes,
  toMinutes,
} = require("./timeUtils");

const compression = require("compression");
const NodeCache = require("node-cache");

const app = express();
const envJwtSecret = process.env.JWT_SECRET;
const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";
const DEFAULT_DEV_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW) || 60000,
  max: Number(process.env.RATE_LIMIT_GLOBAL) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(
      `[RATE LIMIT] ${new Date().toISOString()} | IP: ${req.ip} | Endpoint: ${req.originalUrl}`
    );

    res.status(429).json({
      error: "Too many requests. Please try again later.",
    });
  },
});

const searchLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW) || 60000,
  max: Number(process.env.RATE_LIMIT_SEARCH) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(
      `[RATE LIMIT] ${new Date().toISOString()} | IP: ${req.ip} | Endpoint: ${req.originalUrl}`
    );

    res.status(429).json({
      error: "Too many search requests. Please slow down.",
    });
  },
});

const searchCache = new NodeCache({ stdTTL: 60 });

function parseAllowedOrigins(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const configuredAllowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const allowedOrigins = new Set(
  configuredAllowedOrigins.length > 0
    ? configuredAllowedOrigins
    : isProduction
      ? []
      : DEFAULT_DEV_ALLOWED_ORIGINS
);

if (!envJwtSecret && !isProduction && !isTest) {
  console.warn("[SECURITY] JWT_SECRET not set; using an ephemeral development secret.");
}

if (!isProduction && !isTest && configuredAllowedOrigins.length === 0) {
  console.warn("[SECURITY] ALLOWED_ORIGINS not set; defaulting CORS to local development origins.");
}

const JWT_SECRET = envJwtSecret || crypto.randomBytes(32).toString("hex");

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(origin));
  },
};

app.use(compression());

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${duration}ms`);
  });

  next();
});

app.use(cors(corsOptions));
app.use(express.json());

function globalLimiterUnlessSearch(req, res, next) {
  if (req.method === "GET" && req.path === "/api/facilities") {
    return next();
  }

  return globalLimiter(req, res, next);
}

app.use(globalLimiterUnlessSearch);

if (isProduction && !envJwtSecret) {
  throw new Error("JWT_SECRET environment variable must be set in production.");
}

const { authenticateToken } = createRequestAuthHelpers({
  jwtSecret: JWT_SECRET,
  normalizeEmail,
});

const MAX_BOOKING_MINUTES = 180;

function respondWithCachedSearch(res, cacheKey, payload, status = "MISS") {
  res.set("X-Search-Cache", status);
  if (status === "MISS") {
    searchCache.set(cacheKey, payload);
  }
  res.json(payload);
}

function invalidateSearchCache() {
  searchCache.flushAll();
}

function createSystemPasswordHash(email) {
  return hashPasswordSync(`system:${email}:${crypto.randomUUID()}`);
}

/**
 * In-memory bookings for demo purposes.
 * Shape: { id, facilityId, date, start, end, userEmail, reason? }
 */
const BOOKINGS = [
  {
    id: "B-10001",
    facilityId: FACILITIES[0]?.id || "",
    date: "2026-02-20",
    start: "10:00",
    end: "11:00",
    userEmail: "someone@smu.edu.sg",
  },
  {
    id: "B-10002",
    facilityId: FACILITIES[0]?.id || "",
    date: "2026-02-20",
    start: "14:00",
    end: "15:30",
    userEmail: "someone@smu.edu.sg",
  },
];

function nextBookingId() {
  const base = 10000 + BOOKINGS.length + 1;
  return `B-${base}`;
}

app.get("/api/health", async (req, res) => {
  const startTime = Date.now();

  try {
    const db = sqliteHealth();

    // 🔹 Determine DB status
    const dbStatus = db?.ok ? "CONNECTED" : "DISCONNECTED";

    // 🔹 Determine overall system status
    const status = dbStatus === "CONNECTED" ? "OK" : "DEGRADED";

    const responseTime = Date.now() - startTime;

    // 🔹 Logging
    console.log(
      `[HEALTH] ${new Date().toISOString()} | status=${status} | db=${dbStatus} | ${responseTime}ms`
    );

    res.status(200).json({
      ok: status === "OK",
      status,
      service: "smu-fbs",
      database: dbStatus,
      responseTimeMs: responseTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error(
      `[HEALTH ERROR] ${new Date().toISOString()} | ${error.message}`
    );

    res.status(500).json({
      status: "ERROR",
      message: "Health check failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// Filter metadata for building/type/equipment chips.
app.get('/api/filters', (req, res) => {
  const db = getDb();
  if (db) {
    try {
      const buildings = db
        .prepare('SELECT DISTINCT building AS name FROM facilities WHERE is_active = 1 ORDER BY building ASC')
        .all()
        .map((r) => r.name)
        .filter(Boolean);

      const types = db
        .prepare('SELECT type_name AS name FROM facility_type ORDER BY type_name ASC')
        .all()
        .map((r) => r.name)
        .filter(Boolean);

      const equipment = db
        .prepare('SELECT name FROM equipment ORDER BY name ASC')
        .all()
        .map((r) => r.name)
        .filter(Boolean);

      const cap = db.prepare('SELECT MIN(capacity) AS min, MAX(capacity) AS max FROM facilities WHERE is_active = 1').get();
      res.json({ buildings, types, equipment, capacity: { min: Number(cap?.min) || 0, max: Number(cap?.max) || 0 } });
      return;
    } catch (e) {
      console.error('Error building /api/filters from SQLite; falling back to in-memory:', e);
    }
  }

  const buildings = Array.from(new Set(FACILITIES.map((f) => f.building).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const types = Array.from(new Set(FACILITIES.map((f) => f.type).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const equipment = Array.from(
    new Set(
      FACILITIES.flatMap((f) => (Array.isArray(f.equipment) ? f.equipment : [])).filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const caps = FACILITIES.map((f) => Number(f.capacity) || 0).filter((n) => Number.isFinite(n) && n > 0);
  const min = caps.length ? Math.min(...caps) : 0;
  const max = caps.length ? Math.max(...caps) : 0;
  res.json({ buildings, types, equipment, capacity: { min, max } });
});

// Debug info (non-production only).
app.get('/api/debug', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  const db = getDb();
  const out = {
    inMemoryFacilities: FACILITIES.length,
    dbEnabled: Boolean(db),
    dbPath: sqliteHealth()?.path,
    dbCounts: null,
  };

  if (db) {
    try {
      out.dbCounts = {
        facilities: db.prepare('SELECT COUNT(*) AS c FROM facilities').get()?.c || 0,
        activeFacilities: db.prepare('SELECT COUNT(*) AS c FROM facilities WHERE is_active = 1').get()?.c || 0,
        facilityTypes: db.prepare('SELECT COUNT(*) AS c FROM facility_type').get()?.c || 0,
        equipment: db.prepare('SELECT COUNT(*) AS c FROM equipment').get()?.c || 0,
        facilityEquipment: db.prepare('SELECT COUNT(*) AS c FROM facility_equipment').get()?.c || 0,
        bookingDetail: db.prepare('SELECT COUNT(*) AS c FROM booking_detail').get()?.c || 0,
      };
    } catch (e) {
      out.dbCounts = { error: e?.message || String(e) };
    }
  }

  res.json(out);
});

app.get("/api/facilities", searchLimiter, async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const building = String(req.query.building || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const floor = String(req.query.floor || "")
    .split(",")
    .map((s) => String(s).trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  const type = String(req.query.type || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const capacityRaw = String(req.query.capacity || "").trim();
  const capacityMinRaw = Number(req.query.capacityMin || 0) || 0;
  const capacityMaxRaw = Number(req.query.capacityMax || 0) || 0;
  const minCapacityLegacy = Number(req.query.minCapacity || 0) || 0;

  let capacityMin = capacityMinRaw;
  let capacityMax = capacityMaxRaw;

  if (capacityRaw) {
    const plus = capacityRaw.match(/^\s*(\d+)\s*\+\s*$/);
    const range = capacityRaw.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    const single = capacityRaw.match(/^\s*(\d+)\s*$/);

    if (plus?.[1]) {
      capacityMin = Number(plus[1]) || 0;
      capacityMax = 0;
    } else if (range?.[1] && range?.[2]) {
      const a = Number(range[1]) || 0;
      const b = Number(range[2]) || 0;
      capacityMin = Math.min(a, b);
      capacityMax = Math.max(a, b);
    } else if (single?.[1]) {
      capacityMin = Number(single[1]) || 0;
      capacityMax = 0;
    }
  }

  if (capacityMin <= 0 && minCapacityLegacy > 0) capacityMin = minCapacityLegacy;
  const equipment = String(req.query.equipment || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Availability filter: only apply when the user explicitly provides date + start + end.
  // Frontend always sends a default start for previews; do NOT filter unless end is present.
  const date = String(req.query.date || '').trim();
  const startQ = String(req.query.start || '').trim();
  const endQ = String(req.query.end || '').trim();
  const slotStartMin = toMinutes(startQ);
  const slotEndMin = toMinutes(endQ);
  const shouldFilterByAvailability =
    Boolean(date) &&
    Boolean(startQ) &&
    Boolean(endQ) &&
    slotStartMin !== null &&
    slotEndMin !== null &&
    slotEndMin > slotStartMin;
  const slotStartIso = shouldFilterByAvailability ? toIsoUtcFromDateAndMinutes(date, slotStartMin) : null;
  const slotEndIso = shouldFilterByAvailability ? toIsoUtcFromDateAndMinutes(date, slotEndMin) : null;
  const hasValidAvailabilityWindow = shouldFilterByAvailability && slotStartIso && slotEndIso;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 12)));
  const cacheKey = buildSearchCacheKey(req.query);
  const cachedResponse = searchCache.get(cacheKey);

  if (cachedResponse) {
    respondWithCachedSearch(res, cacheKey, cachedResponse, "HIT");
    return;
  }

  const db = getDb();
  if (db) {
    try {
      const clauses = ["is_active = 1"];
      if (capacityMin > 0) {
        clauses.push(`capacity >= ?`);
      }
      if (capacityMax > 0) {
        clauses.push(`capacity <= ?`);
      }
      if (building.length) {
        clauses.push(`building IN (${building.map(() => "?").join(",")})`);
      }
      if (floor.length) {
        clauses.push(`floor IN (${floor.map(() => "?").join(",")})`);
      }

      if (hasValidAvailabilityWindow) {
        clauses.push(
          `NOT EXISTS (
             SELECT 1
             FROM booking_detail bd
             WHERE bd.facility_id = f.facility_id
               AND bd.start_time < ?
               AND bd.end_time > ?
           )`
        );
      }

      // Require that each requested equipment item exists for the facility.
      // Implemented as EXISTS per equipment, so all requested items must match.
      for (const _ of equipment) {
        clauses.push(
          `EXISTS (
             SELECT 1
             FROM facility_equipment fe
             JOIN equipment e ON e.equipment_id = fe.equipment_id
             WHERE fe.facility_id = f.facility_id AND e.name = ?
           )`
        );
      }

      let whereParams = [];
      let whereSql = "";
      if (clauses.length) {
        whereSql = `WHERE ${clauses.join(" AND ")}`;
        if (capacityMin > 0) whereParams.push(capacityMin);
        if (capacityMax > 0) whereParams.push(capacityMax);
        if (building.length) whereParams.push(...building);
        if (floor.length) whereParams.push(...floor);
        if (hasValidAvailabilityWindow) whereParams.push(slotEndIso, slotStartIso);

        // Add equipment params (in same order as clauses added).
        if (equipment.length) whereParams.push(...equipment);
      }

      const rows = db
        .prepare(
            `SELECT f.facility_id,
                    f.facility_code,
                    f.facility_name,
                    f.building,
                    f.floor,
                    f.capacity,
                    ft.type_name AS type_name,
                    group_concat(e.name) AS equipment_csv
             FROM facilities f
             LEFT JOIN facility_type ft ON ft.facility_type_id = f.facility_type_id
             LEFT JOIN facility_equipment fe ON fe.facility_id = f.facility_id
             LEFT JOIN equipment e ON e.equipment_id = fe.equipment_id
             ${whereSql}
             GROUP BY f.facility_id
             ORDER BY f.facility_name ASC, f.facility_code ASC`
        )
        .all(whereParams);

      let items = rows.map((r) => {
        const id = r.facility_code;
        const capacity = Number(r.capacity) || 0;
          const equipmentList = String(r.equipment_csv || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        return {
          id,
          name: r.facility_name,
          campus: SINGLE_CAMPUS_LABEL,
          building: r.building,
          floor: Number(r.floor) || 0,
          capacity,
          type: r.type_name || facilityTypeForCapacity(capacity),
            equipment: equipmentList,
        };
      });

      if (type.length) {
        const set = new Set(type);
        items = items.filter((f) => set.has(f.type));
      }

      items = rankFacilities(items, q);

      // Equipment filtering is already applied in SQL via EXISTS,
      // but keep this as a safety net for any unexpected data.
      if (equipment.length) items = items.filter((f) => equipment.every((e) => (f.equipment || []).includes(e)));

      const total = items.length;
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, pageCount);
      const startIdx = (safePage - 1) * pageSize;
      const slice = items.slice(startIdx, startIdx + pageSize);

      respondWithCachedSearch(res, cacheKey, { items: slice, total, page: safePage, pageSize, pageCount });
      return;
    } catch (e) {
      console.error("Error while querying facilities from SQLite, falling back to in-memory data:", e);
    }
  }

  let items = FACILITIES;
  if (capacityMin > 0) {
    items = items.filter((f) => f.capacity >= capacityMin);
  }
  if (capacityMax > 0) {
    items = items.filter((f) => f.capacity <= capacityMax);
  }
  if (building.length) {
    const set = new Set(building);
    items = items.filter((f) => set.has(f.building));
  }
  if (floor.length) {
    const set = new Set(floor);
    items = items.filter((f) => set.has(Number(f.floor) || 0));
  }
  if (type.length) {
    const set = new Set(type);
    items = items.filter((f) => set.has(f.type));
  }
  if (equipment.length) {
    items = items.filter((f) => equipment.every((e) => (f.equipment || []).includes(e)));
  }

  items = rankFacilities(items, q);

  if (hasValidAvailabilityWindow) {
    items = items.filter((f) => {
      const facilityId = String(f.id);
      const conflicts = BOOKINGS.filter((b) => b.facilityId === facilityId && b.date === date);
      if (!conflicts.length) return true;
      return !conflicts.some((b) => {
        const bStart = toMinutes(b.start);
        const bEnd = toMinutes(b.end);
        if (bStart === null || bEnd === null) return false;
        return overlaps(slotStartMin, slotEndMin, bStart, bEnd);
      });
    });
  }

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const slice = items.slice(start, end);

  respondWithCachedSearch(res, cacheKey, { items: slice, total, page: safePage, pageSize, pageCount });
});

app.get("/api/facilities/:id", (req, res) => {
  const db = getDb();
  if (db) {
    try {
      const r = db
        .prepare(
          `SELECT f.facility_code,
                  f.facility_name,
                  f.building,
                  f.floor,
                  f.capacity,
                  ft.type_name AS type_name,
                  group_concat(DISTINCT e.name) AS equipment_csv
           FROM facilities f
           LEFT JOIN facility_type ft ON ft.facility_type_id = f.facility_type_id
           LEFT JOIN facility_equipment fe ON fe.facility_id = f.facility_id
           LEFT JOIN equipment e ON e.equipment_id = fe.equipment_id
           WHERE f.facility_code = ? AND f.is_active = 1
           GROUP BY f.facility_id`
        )
        .get(req.params.id);
      if (!r) {
        res.status(404).json({ message: "Facility not found" });
        return;
      }
      const capacity = Number(r.capacity) || 0;
      const equipmentList = String(r.equipment_csv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      res.json({
        id: r.facility_code,
        name: r.facility_name,
        campus: SINGLE_CAMPUS_LABEL,
        building: r.building,
        floor: Number(r.floor) || 0,
        capacity,
        type: r.type_name || facilityTypeForCapacity(capacity),
        equipment: equipmentList,
      });
      return;
    } catch (e) {
      void e;
    }
  }

  const facility = FACILITIES.find((f) => f.id === req.params.id);
  if (!facility) {
    res.status(404).json({ message: "Facility not found" });
    return;
  }
  res.json(facility);
});

app.get("/api/facilities/:id/availability", (req, res) => {
  const date = String(req.query.date || "").trim();
  if (!date) {
    res.status(400).json({ message: "Missing date" });
    return;
  }

  const db = getDb();
  if (db) {
    try {
      const rows = db
        .prepare(
          `SELECT bd.booking_id AS id,
                  substr(bd.start_time, 12, 5) AS start,
                  substr(bd.end_time, 12, 5) AS end
           FROM booking_detail bd
           JOIN facilities f ON f.facility_id = bd.facility_id
           WHERE f.facility_code = ?
             AND date(bd.start_time) = date(?)
           ORDER BY bd.start_time ASC`
        )
        .all(req.params.id, date);
      res.json({ facilityId: req.params.id, date, reservations: rows || [] });
      return;
    } catch (e) {
      console.error(
        "Error fetching DB availability for facility %s on %s:",
        req.params.id,
        date,
        e
      );
    }
  }

  const facility = FACILITIES.find((f) => f.id === req.params.id);
  if (!facility) {
    res.status(404).json({ message: "Facility not found" });
    return;
  }

  const reservations = BOOKINGS.filter(
    (b) => b.facilityId === facility.id && b.date === date
  ).map((b) => ({ id: b.id, start: b.start, end: b.end }));

  res.json({ facilityId: facility.id, date, reservations });
});

// Returns a "glimpse" (next available start/end) for a list of facility IDs.
// This avoids per-card availability calls in the UI.
app.get("/api/availability-glimpse", (req, res) => {
  const ids = String(req.query.ids || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const date = String(req.query.date || "").trim();
  const preferredStart = String(req.query.start || "").trim();
  // Card previews are intentionally hour-by-hour blobs.
  const duration = 60;
  const limit = Math.min(6, Math.max(1, Number(req.query.limit || 3)));

  if (!date) {
    res.status(400).json({ message: "Missing date" });
    return;
  }
  if (ids.length === 0) {
    res.json({ date, duration, items: {} });
    return;
  }

  const businessStart = toMinutes(String(req.query.businessStart || "08:00"));
  const businessEnd = toMinutes(String(req.query.businessEnd || "22:00"));
  const step = 60;

  const preferredStartMin = toMinutes(preferredStart) ?? businessStart;

  function ceilToHour(mins) {
    const rem = mins % 60;
    if (rem === 0) return mins;
    return mins + (60 - rem);
  }

  const items = {};
  const db = getDb();
  if (db) {
    try {
      const facilityRows = db
        .prepare(
          `SELECT facility_id, facility_code
           FROM facilities
           WHERE is_active = 1 AND facility_code IN (${ids.map(() => "?").join(",")})`
        )
        .all(...ids);

      const codeById = new Map();
      const idByCode = new Map();
      for (const f of facilityRows) {
        codeById.set(Number(f.facility_id), f.facility_code);
        idByCode.set(f.facility_code, Number(f.facility_id));
      }

      for (const facilityId of ids) {
        if (!idByCode.has(facilityId)) items[facilityId] = { status: "not_found" };
      }

      const numericIds = Array.from(codeById.keys());
      if (numericIds.length === 0) {
        res.json({ date, duration, items });
        return;
      }

      const bookings = db
        .prepare(
          `SELECT facility_id, start_time, end_time, booking_id AS id
           FROM booking_detail
           WHERE facility_id IN (${numericIds.map(() => "?").join(",")})
             AND date(start_time) = date(?)`
        )
        .all(...numericIds, date);

      const bookingsByCode = {};
      for (const b of bookings) {
        const code = codeById.get(Number(b.facility_id));
        if (!code) continue;
        if (!bookingsByCode[code]) bookingsByCode[code] = [];
        const startStr = String(b.start_time);
        const endStr = String(b.end_time);
        bookingsByCode[code].push({
          start: toMinutes(startStr.slice(11, 16)),
          end: toMinutes(endStr.slice(11, 16)),
          id: b.id,
        });
      }

      for (const code of idByCode.keys()) {
        const dayBookings = bookingsByCode[code] || [];
        const foundSlots = [];
        const searchStart = ceilToHour(Math.max(businessStart, preferredStartMin));
        for (let t = searchStart; t + duration <= businessEnd; t += step) {
          const endT = t + duration;
          const hasConflict = dayBookings.some((b) => overlaps(t, endT, b.start, b.end));
          if (!hasConflict) {
            foundSlots.push({ start: toHHMM(t), end: toHHMM(endT) });
            if (foundSlots.length >= limit) break;
          }
        }
        if (foundSlots.length === 0) items[code] = { status: "no_slots" };
        else items[code] = { status: "ok", nextSlots: foundSlots };
      }

      res.json({ date, duration, items });
      return;
    } catch (e) {
      console.error("Error while querying database for availability slots:", e);
    }
  }

  for (const facilityId of ids) {
    const facility = FACILITIES.find((f) => f.id === facilityId);
    if (!facility) {
      items[facilityId] = { status: "not_found" };
      continue;
    }

    const dayBookings = BOOKINGS.filter(
      (b) => b.facilityId === facilityId && b.date === date
    ).map((b) => ({
      start: toMinutes(b.start),
      end: toMinutes(b.end),
      id: b.id,
    }));

    const foundSlots = [];
    const searchStart = ceilToHour(Math.max(businessStart, preferredStartMin));
    for (let t = searchStart; t + duration <= businessEnd; t += step) {
      const endT = t + duration;
      const hasConflict = dayBookings.some((b) => overlaps(t, endT, b.start, b.end));
      if (!hasConflict) {
        foundSlots.push({ start: toHHMM(t), end: toHHMM(endT) });
        if (foundSlots.length >= limit) break;
      }
    }

    if (foundSlots.length === 0) {
      items[facilityId] = { status: "no_slots" };
    } else {
      items[facilityId] = { status: "ok", nextSlots: foundSlots };
    }
  }

  res.json({ date, duration, items });
});

app.get("/api/bookings", authenticateToken, (req, res) => {
  const userEmail = String(req.user?.email || "").trim().toLowerCase();
  const db = getDb();
  if (db) {
    try {
      const rows = db
        .prepare(
          `SELECT b.booking_id,
                  b.status,
                  b.booking_reason,
                  u.email AS user_email,
                  f.facility_code,
                  f.facility_name,
                  substr(bd.start_time, 1, 10) AS booking_date,
                  substr(bd.start_time, 12, 5) AS start_time,
                  substr(bd.end_time, 12, 5) AS end_time
           FROM bookings b
           JOIN users u ON u.user_id = b.user_id
           JOIN booking_detail bd ON bd.booking_id = b.booking_id
           JOIN facilities f ON f.facility_id = bd.facility_id
           WHERE (? = '' OR lower(u.email) = lower(?))
           ORDER BY bd.start_time DESC, b.booking_id DESC`
        )
        .all(userEmail, userEmail);

      const items = rows.map((row) => ({
        id: `B-${row.booking_id}`,
        facilityId: row.facility_code,
        facilityName: row.facility_name,
        date: row.booking_date,
        start: row.start_time,
        end: row.end_time,
        userEmail: row.user_email,
        reason: row.booking_reason || undefined,
        status: String(row.status || "CONFIRMED").toLowerCase(),
      }));

      res.json({ items });
      return;
    } catch (e) {
      res.status(500).json({ message: e?.message || "Failed to load bookings" });
      return;
    }
  }

  const items = BOOKINGS
    .filter((booking) => !userEmail || String(booking.userEmail).toLowerCase() === userEmail.toLowerCase())
    .map((booking) => ({
      id: booking.id,
      facilityId: booking.facilityId,
      date: booking.date,
      start: booking.start,
      end: booking.end,
      userEmail: booking.userEmail,
      reason: booking.reason,
      status: booking.status || "active",
    }))
    .sort((a, b) => `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`));

  res.json({ items });
});

app.post("/api/bookings", authenticateToken, validateBookingInput, (req, res) => {
  const { facilityId, date, start, end, reason } = req.body || {};
  const userRole = resolveBookingRole({
    userRole: req.user?.role,
    headerRole: req.headers["x-user-role"],
    bodyRole: req.body?.userRole,
  });

  if (!facilityId || !date || !start || !end) {
    res.status(400).json({ message: "Missing required booking fields" });
    return;
  }

  const userEmail = normalizeEmail(req.user?.email);

  if (!userEmail) {
    res.status(401).json({ message: "Access token required" });
    return;
  }

  if (!isIsoYmd(date)) {
    res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    return;
  }

  const todaySg = singaporeTodayIso();
  if (todaySg && String(date) < todaySg) {
    res.status(400).json({ message: "Booking date cannot be before today (Singapore time)." });
    return;
  }

  const db = getDb();
  if (db) {
    try {
      const facilityRow = db
        .prepare(
          `SELECT facility_id
           FROM facilities
           WHERE facility_code = ? AND is_active = 1`
        )
        .get(facilityId);
      if (!facilityRow) {
        res.status(404).json({ message: "Facility not found" });
        return;
      }

      const facilityDbId = Number(facilityRow.facility_id);

      const startMin = toMinutes(start);
      const endMin = toMinutes(end);
      if (startMin === null || endMin === null || endMin <= startMin) {
        res.status(400).json({ message: "Invalid time range" });
        return;
      }

      if (endMin - startMin > MAX_BOOKING_MINUTES) {
        res.status(400).json({ message: "Bookings are limited to 3 hours." });
        return;
      }

      const startTs = toIsoUtcFromDateAndMinutes(date, startMin);
      const endTs = toIsoUtcFromDateAndMinutes(date, endMin);
      if (!startTs || !endTs) {
        res.status(400).json({ message: "Invalid date/time" });
        return;
      }

      const conflict = db
        .prepare(
          `SELECT booking_id AS id,
                  substr(start_time, 12, 5) AS start,
                  substr(end_time, 12, 5) AS end
           FROM booking_detail
           WHERE facility_id = ?
             AND start_time < ?
             AND end_time   > ?
           LIMIT 1`
        )
        .get(facilityDbId, endTs, startTs);

      if (conflict) {
        res.status(409).json({
          error: "DOUBLE_BOOKING",
          message: "This timeslot is already booked.",
          conflict: { id: conflict.id, start: conflict.start, end: conflict.end },
        });
        return;
      }

      const email = userEmail;
      const reasonTrimmed = typeof reason === "string" && reason.trim() ? reason.trim() : null;
      const costCentreSnapshot = userRole === "staff" ? getCostCentre(email) : null;

      const tx = db.transaction(() => {
        const user = db
          .prepare(
            `INSERT INTO users (first_name, last_name, email, role, password_hash)
             VALUES ('Guest', 'User', ?, ?, ?)
             ON CONFLICT(email) DO UPDATE SET
               email = excluded.email,
               role = COALESCE(users.role, excluded.role),
               password_hash = COALESCE(NULLIF(users.password_hash, ''), excluded.password_hash)
             RETURNING user_id`
          )
          .get(email, userRole, createSystemPasswordHash(email));

        let creditSnapshot = { allowed: true, deducted: 0, remaining: null };
        if (userRole === "student") {
          creditSnapshot = deductCredits(email, STUDENT_BOOKING_CREDIT_COST, { db });
          if (!creditSnapshot.allowed) {
            const err = new Error("Insufficient credits remaining for this booking.");
            err.status = 409;
            throw err;
          }
        }

        const booking = db
          .prepare(
            `INSERT INTO bookings (user_id, booking_reason, booking_role, credits_charged, credits_refunded, cost_centre_snapshot)
             VALUES (?, ?, ?, ?, 0, ?)
             RETURNING booking_id`
          )
          .get(
            Number(user.user_id),
            reasonTrimmed,
            userRole,
            creditSnapshot.deducted,
            costCentreSnapshot
          );

        db
          .prepare(
            `INSERT INTO booking_detail (booking_id, facility_id, start_time, end_time)
             VALUES (?, ?, ?, ?)`
          )
          .run(Number(booking.booking_id), facilityDbId, startTs, endTs);

        return {
          bookingId: Number(booking.booking_id),
          deducted: creditSnapshot.deducted,
          creditsRemaining: creditSnapshot.remaining,
          costCentreSnapshot,
        };
      });

      const bookingResult = tx();
      const bookingId = bookingResult.bookingId;
      insertAuditLog(db, 'CREATE', email, bookingId, { facilityId, date, start, end, reason: reasonTrimmed });
      let extra = {};
      if (userRole === "student") {
        extra = {
          deducted: bookingResult.deducted,
          creditsRemaining: bookingResult.creditsRemaining,
        };
      } else if (userRole === "staff") {
        extra.costCentre = bookingResult.costCentreSnapshot;
      }
      console.log("BOOKING_CREATED", {
        bookingId: `B-${bookingId}`,
        userEmail: email,
        timestamp: new Date().toISOString(),
      });
      invalidateSearchCache();

      res.status(201).json({
        id: `B-${bookingId}`,
        facilityId,
        date,
        start,
        end,
        userEmail: email,
        reason: reasonTrimmed || undefined,
        ...extra,
      });
      return;
    } catch (e) {
      res.status(e?.status || 500).json({ message: e?.message || "Booking failed" });
      return;
    }
  }

  const facility = FACILITIES.find((f) => f.id === facilityId);
  if (!facility) {
    res.status(404).json({ message: "Facility not found" });
    return;
  }

  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === null || endMin === null || endMin <= startMin) {
    res.status(400).json({ message: "Invalid time range" });
    return;
  }

  if (endMin - startMin > MAX_BOOKING_MINUTES) {
    res.status(400).json({ message: "Bookings are limited to 3 hours." });
    return;
  }

  const existing = BOOKINGS.filter(
    (b) => b.facilityId === facilityId && b.date === date
  );
  const conflict = existing.find((b) => {
    const bStart = toMinutes(b.start);
    const bEnd = toMinutes(b.end);
    return overlaps(startMin, endMin, bStart, bEnd);
  });

  if (conflict) {
    res.status(409).json({
      error: "DOUBLE_BOOKING",
      message: "This timeslot is already booked.",
      conflict: { id: conflict.id, start: conflict.start, end: conflict.end },
    });
    return;
  }

  const booking = {
    id: nextBookingId(),
    facilityId,
    date,
    start,
    end,
    userEmail,
    status: "active",
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : undefined,
    userRole,
    creditsCharged: 0,
    creditsRefunded: 0,
    costCentreSnapshot: null,
  };

  BOOKINGS.push(booking);
  let extra = {};
  if (userRole === "student") {
    const charge = deductCredits(booking.userEmail, STUDENT_BOOKING_CREDIT_COST);
    if (!charge.allowed) {
      BOOKINGS.pop();
      res.status(409).json({ message: "Insufficient credits remaining for this booking." });
      return;
    }
    booking.creditsCharged = charge.deducted;
    extra = { deducted: charge.deducted, creditsRemaining: charge.remaining };
  } else if (userRole === "staff") {
    booking.costCentreSnapshot = getCostCentre(booking.userEmail);
    extra.costCentre = booking.costCentreSnapshot;
  }
  console.log("BOOKING_CREATED", {
    bookingId: booking.id,
    userEmail: booking.userEmail,
    timestamp: new Date().toISOString(),
  });
  invalidateSearchCache();

  res.status(201).json({ ...booking, ...extra });
});

app.put("/api/bookings/:id", authenticateToken, (req, res) => {
  const bookingIdRaw = String(req.params.id || "").trim();
  const bookingIdNumeric = Number(bookingIdRaw.replace(/^B-/i, ""));
  const { date, start, end } = req.body || {};
  const userEmail = String(req.user?.email || "").trim().toLowerCase();

  if (!userEmail) {
    res.status(401).json({ message: "Please log in to modify bookings." });
    return;
  }

  if (!date || !start || !end) {
    res.status(400).json({ message: "Missing required booking fields" });
    return;
  }

  if (!isIsoYmd(date)) {
    res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    return;
  }

  const todaySg = singaporeTodayIso();
  if (todaySg && String(date) < todaySg) {
    res.status(400).json({ message: "Booking date cannot be before today (Singapore time)." });
    return;
  }

  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === null || endMin === null || endMin <= startMin) {
    res.status(400).json({ message: "Invalid time range" });
    return;
  }

  if (endMin - startMin > MAX_BOOKING_MINUTES) {
    res.status(400).json({ message: "Bookings are limited to 3 hours." });
    return;
  }

  const db = getDb();
  if (db) {
    try {
      if (!Number.isFinite(bookingIdNumeric) || bookingIdNumeric <= 0) {
        res.status(400).json({ message: "Invalid booking id." });
        return;
      }

      const bookingRow = db
        .prepare(
          `SELECT b.booking_id,
                  b.status,
                  u.email AS user_email,
                  f.facility_code,
                  f.facility_name,
                  bd.facility_id AS facility_db_id
           FROM bookings b
           JOIN users u ON u.user_id = b.user_id
           JOIN booking_detail bd ON bd.booking_id = b.booking_id
           JOIN facilities f ON f.facility_id = bd.facility_id
           WHERE b.booking_id = ?`
        )
        .get(bookingIdNumeric);

      if (!bookingRow) {
        res.status(404).json({ message: "Booking not found." });
        return;
      }

      if (String(bookingRow.user_email).toLowerCase() !== userEmail.toLowerCase()) {
        res.status(403).json({ message: "Unauthorised: cannot modify another user's booking." });
        return;
      }

      if (String(bookingRow.status || "").toLowerCase() === "cancelled") {
        res.status(400).json({ message: "Cancelled bookings cannot be modified." });
        return;
      }

      const startTs = toIsoUtcFromDateAndMinutes(date, startMin);
      const endTs = toIsoUtcFromDateAndMinutes(date, endMin);
      if (!startTs || !endTs) {
        res.status(400).json({ message: "Invalid date/time" });
        return;
      }

      const conflict = db
        .prepare(
          `SELECT bd.booking_id AS id,
                  substr(bd.start_time, 12, 5) AS start,
                  substr(bd.end_time, 12, 5) AS end
           FROM booking_detail bd
           JOIN bookings b ON b.booking_id = bd.booking_id
           WHERE bd.facility_id = ?
             AND bd.booking_id <> ?
             AND lower(ifnull(b.status, 'confirmed')) <> 'cancelled'
             AND bd.start_time < ?
             AND bd.end_time   > ?
           LIMIT 1`
        )
        .get(Number(bookingRow.facility_db_id), bookingIdNumeric, endTs, startTs);

      if (conflict) {
        res.status(409).json({
          error: "DOUBLE_BOOKING",
          message: "This timeslot is already booked.",
          conflict: { id: conflict.id, start: conflict.start, end: conflict.end },
        });
        return;
      }

      // In SQLite, updating booking_detail rows by booking_id alone can cause
      // UNIQUE/PK conflicts when a booking has multiple segments for the same
      // facility. Use a small transaction that replaces existing rows for this
      // booking and facility with a single new row covering the requested time.
      // Use db.transaction(...) here for consistent and automatic rollback behavior.
      const replaceBookingSegments = db.transaction(
        (bookingId, facilityId, startTime, endTime) => {
          db.prepare(
            `DELETE FROM booking_detail
               WHERE booking_id = ?
                 AND facility_id = ?`
          ).run(bookingId, facilityId);

          db.prepare(
            `INSERT INTO booking_detail (booking_id, facility_id, start_time, end_time)
               VALUES (?, ?, ?, ?)`
          ).run(bookingId, facilityId, startTime, endTime);
        }
      );

      replaceBookingSegments(
        bookingIdNumeric,
        bookingRow.facility_db_id,
        startTs,
        endTs
      );
      invalidateSearchCache();
      res.json({
        id: `B-${bookingIdNumeric}`,
        facilityId: bookingRow.facility_code,
        facilityName: bookingRow.facility_name,
        date,
        start,
        end,
        userEmail: bookingRow.user_email,
        status: String(bookingRow.status || "confirmed").toLowerCase(),
      });
      return;
    } catch (e) {
      res.status(500).json({ message: e?.message || "Unable to modify booking." });
      return;
    }
  }

  const bookingIdString = String(bookingIdRaw);
  const bookingIdCore = bookingIdString.replace(/^B-/i, "");
  const normalizedBookingId = `B-${bookingIdCore}`;

  const booking = BOOKINGS.find(
    (b) => b.id === bookingIdString || b.id === normalizedBookingId
  );

  if (!booking) {
    res.status(404).json({ message: "Booking not found." });
    return;
  }

  if (String(booking.userEmail).toLowerCase() !== userEmail.toLowerCase()) {
    res.status(403).json({ message: "Unauthorised: cannot modify another user's booking." });
    return;
  }

  if (String(booking.status || "").toLowerCase() === "cancelled") {
    res.status(400).json({ message: "Cancelled bookings cannot be modified." });
    return;
  }

  const conflict = BOOKINGS.find((b) => {
    if (b.id === booking.id) return false;
    if (String(b.status || "active").toLowerCase() === "cancelled") return false;
    if (b.facilityId !== booking.facilityId) return false;
    if (b.date !== date) return false;

    const bStart = toMinutes(b.start);
    const bEnd = toMinutes(b.end);
    return overlaps(startMin, endMin, bStart, bEnd);
  });

  if (conflict) {
    res.status(409).json({
      error: "DOUBLE_BOOKING",
      message: "This timeslot is already booked.",
      conflict: { id: conflict.id, start: conflict.start, end: conflict.end },
    });
    return;
  }

  booking.date = date;
  booking.start = start;
  booking.end = end;
  invalidateSearchCache();

  res.json({
    id: booking.id,
    facilityId: booking.facilityId,
    date: booking.date,
    start: booking.start,
    end: booking.end,
    userEmail: booking.userEmail,
    status: String(booking.status || "active").toLowerCase(),
    reason: booking.reason,
  });
});

app.delete("/api/bookings/:id", authenticateToken, (req, res) => {
  const bookingId = req.params.id
  const userEmail = String(req.user?.email || "").trim().toLowerCase()

  if (!userEmail) {
    res.status(401).json({ message: "Please log in to cancel bookings." })
    return
  }

  const db = getDb();
  if (db) {
    try {
      let numericId;
      if (typeof bookingId === "string" && bookingId.startsWith("B-")) {
        numericId = Number(bookingId.slice(2));
      } else {
        numericId = Number(bookingId);
      }

      if (!Number.isFinite(numericId) || numericId <= 0) {
        res.status(400).json({ message: "Invalid booking ID." });
        return;
      }
      const bookingRow = db.prepare(`SELECT b.*, u.email FROM bookings b JOIN users u ON b.user_id = u.user_id WHERE b.booking_id = ?`).get(numericId);
      if (!bookingRow) {
        res.status(404).json({ message: "Booking not found." });
        return;
      }

      if (bookingRow.email !== userEmail) {
        res.status(403).json({ message: "Unauthorised: cannot cancel another user's booking." });
        return;
      }

      if (bookingRow.status === 'CANCELLED') {
        res.json({ message: "This booking is already cancelled." });
        return;
      }

      const cancelResult = db.transaction(() => {
        let refundedCredits = 0;
        let creditsRemaining = null;

        if (String(bookingRow.booking_role || "").toLowerCase() === "student") {
          const startRow = db
            .prepare(`SELECT MIN(start_time) AS start_time FROM booking_detail WHERE booking_id = ?`)
            .get(numericId);
          const refundAmount = getCancellationCreditRefund(
            startRow?.start_time,
            bookingRow.credits_charged,
            bookingRow.credits_refunded
          );

          if (refundAmount > 0) {
            const refundResult = refundCredits(userEmail, refundAmount, { db });
            refundedCredits = refundResult.refunded;
            creditsRemaining = refundResult.remaining;
          } else {
            creditsRemaining = getStudentBalance(userEmail, { db });
          }
        }

        db.prepare(
          `UPDATE bookings
           SET status = 'CANCELLED',
               credits_refunded = credits_refunded + ?
           WHERE booking_id = ?`
        ).run(refundedCredits, numericId);

        return { refundedCredits, creditsRemaining };
      })();
      insertAuditLog(db, 'CANCEL', userEmail, numericId, { bookingId });
      invalidateSearchCache();
      res.json({
        message: "Booking cancelled successfully.",
        refundedCredits: cancelResult.refundedCredits,
        creditsRemaining: cancelResult.creditsRemaining,
        booking: {
          id: bookingId,
          userEmail,
          status: "cancelled",
        },
      });
      return;
    } catch (e) {
      console.error("Error cancelling booking in DB:", e);
      res.status(500).json({ message: "An error occurred while cancelling the booking." });
      return;
    }
  }

  const bookingIndex = BOOKINGS.findIndex((b) => b.id === bookingId)

  if (bookingIndex === -1) {
    res.status(404).json({ message: "Booking not found." })
    return
  }

  const booking = BOOKINGS[bookingIndex]

  // AC2 — user must own the booking
  if (booking.userEmail !== userEmail) {
    res.status(403).json({ message: "Unauthorised: cannot cancel another user's booking." })
    return
  }

  // AC6 — idempotent cancellation
  if (booking.status === "cancelled") {
    res.json({ message: "This booking is already cancelled." })
    return
  }

  // AC3 + AC4 — mark cancelled and free slot
  booking.status = "cancelled"

  let refundedCredits = 0
  let creditsRemaining = null
  if (String(booking.userRole || "").toLowerCase() === "student") {
    const bookingStartMinutes = toMinutes(booking.start)
    const bookingStartIso = bookingStartMinutes === null
      ? null
      : toIsoUtcFromDateAndMinutes(booking.date, bookingStartMinutes)
    const refundAmount = getCancellationCreditRefund(
      bookingStartIso,
      booking.creditsCharged,
      booking.creditsRefunded
    )
    if (refundAmount > 0) {
      const refundResult = refundCredits(userEmail, refundAmount)
      refundedCredits = refundResult.refunded
      creditsRemaining = refundResult.remaining
      booking.creditsRefunded = (Number(booking.creditsRefunded) || 0) + refundedCredits
    } else {
      creditsRemaining = getStudentBalance(userEmail)
    }
  }

  // AC8 — audit logging
  console.log("BOOKING_CANCELLED", {
    bookingId,
    userEmail,
    timestamp: new Date().toISOString(),
  })

  invalidateSearchCache();

  res.json({ message: "Booking cancelled successfully.", refundedCredits, creditsRemaining, booking })
})

app.get("/api/admin/logs", authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  const db = getDb();
  if (!db) {
    res.status(500).json({ message: "Database not available" });
    return;
  }

  try {
    const action = req.query.action;
    const userEmail = req.query.user_email;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    let where = [];
    let params = [];
    if (action) {
      where.push("action = ?");
      params.push(action);
    }
    if (userEmail) {
      where.push("user_email = ?");
      params.push(userEmail);
    }
    if (startDate) {
      where.push("timestamp >= ?");
      params.push(startDate + 'T00:00:00Z');
    }
    if (endDate) {
      where.push("timestamp <= ?");
      params.push(endDate + 'T23:59:59Z');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = selectAuditLogs(db, whereSql, params);

    res.json({ logs: rows });
  } catch (e) {
    console.error("Error fetching admin logs:", e);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});

app.get("/api/me/credits", authenticateToken, (req, res) => {
  const email = normalizeEmail(req.user?.email);
  const role = String(req.user?.role || "user").toLowerCase();
  const db = getDb();

  if (!email) {
    return res.status(401).json({ message: "Authenticated user email is required." });
  }

  return res.json({
    email,
    role,
    creditsRemaining: role === "student" ? getStudentBalance(email, { db }) : null,
  });
});

app.post("/api/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  if (isLockedOut(email)) {
    const remainingSec = Math.ceil(getRemainingLockoutMs(email) / 1000);
    const remainingMin = Math.ceil(remainingSec / 60);
    return res.status(429).json({
      error: "LOGIN_LOCKED",
      message: `Account locked after too many failed attempts. Please try again in ${remainingMin} minute${remainingMin === 1 ? "" : "s"}.`,
      retryAfterSeconds: remainingSec,
    });
  }

  const db = getDb();
  if (!db) {
    return res.status(503).json({ message: "Authentication database unavailable." });
  }

  try {
    const user = db
      .prepare(
        `SELECT user_id, first_name, last_name, email, role, password_hash
         FROM users
         WHERE lower(email) = ?
         LIMIT 1`
      )
      .get(email);

    if (!user?.password_hash) {
      const failure = recordFailedLogin(email);
      if (failure.lockedUntil && Date.now() < failure.lockedUntil) {
        const remainingSec = Math.ceil(getRemainingLockoutMs(email) / 1000);
        const remainingMin = Math.ceil(remainingSec / 60);
        return res.status(429).json({
          error: "LOGIN_LOCKED",
          message: `Account locked after too many failed attempts. Please try again in ${remainingMin} minute${remainingMin === 1 ? "" : "s"}.`,
          retryAfterSeconds: remainingSec,
        });
      }

      return res.status(401).json({
        message: "Invalid email or password.",
        attemptsRemaining: Math.max(0, MAX_LOGIN_FAILURES - failure.count),
      });
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) {
      const failure = recordFailedLogin(email);
      if (failure.lockedUntil && Date.now() < failure.lockedUntil) {
        const remainingSec = Math.ceil(getRemainingLockoutMs(email) / 1000);
        const remainingMin = Math.ceil(remainingSec / 60);
        return res.status(429).json({
          error: "LOGIN_LOCKED",
          message: `Account locked after too many failed attempts. Please try again in ${remainingMin} minute${remainingMin === 1 ? "" : "s"}.`,
          retryAfterSeconds: remainingSec,
        });
      }

      return res.status(401).json({
        message: "Invalid email or password.",
        attemptsRemaining: Math.max(0, MAX_LOGIN_FAILURES - failure.count),
      });
    }

    resetFailureCount(email);

    const role = String(user.role || "student").toLowerCase();
    const token = jwt.sign({ email: user.email, role }, JWT_SECRET, { expiresIn: "1h" });

    return res.json({
      email: user.email,
      role,
      token,
      name: `${user.first_name} ${user.last_name}`.trim(),
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Unable to sign in." });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.delete("/__debug/delete-test", (req, res) => {
    res.json({ ok: true, method: "DELETE" })
  });

  app.post("/__debug/login", (req, res) => {
    const { email, role } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }
    const token = jwt.sign({ email, role: role || 'user' }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  });

  app.get("/__debug/routes", (req, res) => res.json({ ok: true }));
}

app.get("/", (req, res) => {
  res.send("FBS 2.0 backend running");
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });
}

module.exports = app;
