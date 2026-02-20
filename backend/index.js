const express = require("express");
const cors = require("cors");
const { getDb, sqliteHealth } = require("./sqlite");

const app = express();
app.use(cors());
app.use(express.json());

function pad2(n) {
  return String(n).padStart(2, "0");
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

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

const SINGLE_CAMPUS_LABEL = "SMU";
const EQUIPMENT_POOL = [
  "Projector",
  "Whiteboard",
  "Video Conferencing",
  "Microphone",
  "PC Lab",
];

function stableHash(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function equipmentForFacilityCode(code) {
  const h = stableHash(code);
  const picked = [];
  for (let i = 0; i < EQUIPMENT_POOL.length; i++) {
    if (((h >> i) & 1) === 1) picked.push(EQUIPMENT_POOL[i]);
  }
  // Always return at least one item to keep UI interesting.
  return picked.length ? picked : [EQUIPMENT_POOL[h % EQUIPMENT_POOL.length]];
}

function makeFacilities() {
  const buildings = [
    "Library",
    "Academic Building",
    "Student Centre",
    "Business School",
    "Tech Hub",
  ];

  const facilities = [];
  let counter = 1;
  for (const building of buildings) {
    for (let i = 0; i < 10; i++) {
      const id = `R-${pad2(counter)}${pad2(i + 1)}`;
      const capacity = 4 + ((counter * 7 + i * 3) % 80);
      const equipment = equipmentForFacilityCode(id);

      facilities.push({
        id,
        name: `Room ${id} — ${building}`,
        campus: SINGLE_CAMPUS_LABEL,
        building,
        capacity,
        equipment,
      });
    }
    counter++;
  }
  return facilities;
}

const FACILITIES = makeFacilities();

/**
 * In-memory bookings for demo purposes.
 * Shape: { id, facilityId, date, start, end, userEmail, reason? }
 */
const BOOKINGS = [
  {
    id: "B-10001",
    facilityId: "R-0101",
    date: "2026-02-20",
    start: "10:00",
    end: "11:00",
    userEmail: "someone@smu.edu.sg",
  },
  {
    id: "B-10002",
    facilityId: "R-0101",
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

app.get("/api/health", (req, res) => {
  const db = sqliteHealth();
  res.json({ ok: true, service: "smu-fbs", time: new Date().toISOString(), db });
});

app.get("/api/facilities", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const minCapacity = Number(req.query.minCapacity || 0) || 0;
  const equipment = String(req.query.equipment || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 12)));

  const db = getDb();
  if (db) {
    try {
      const clauses = ["is_active = 1"];
      const params = [];
      if (q) {
        params.push(`%${q}%`);
        clauses.push(
          `(facility_code LIKE ? OR facility_name LIKE ? OR building LIKE ?)`
        );
      }
      if (minCapacity > 0) {
        params.push(minCapacity);
        clauses.push(`capacity >= ?`);
      }

      let whereParams = [];
      let whereSql = "";
      if (clauses.length) {
        whereSql = `WHERE ${clauses.join(" AND ")}`;
        // For the q clause we need three copies of the same parameter.
        if (q) {
          const qLike = `%${q}%`;
          whereParams.push(qLike, qLike, qLike);
        }
        if (minCapacity > 0) whereParams.push(minCapacity);
      }

      const rows = db
        .prepare(
          `SELECT facility_code, facility_name, building, floor, capacity
           FROM facilities
           ${whereSql}
           ORDER BY facility_name ASC, facility_code ASC`
        )
        .all(whereParams);

      let items = rows.map((r) => {
        const id = r.facility_code;
        return {
          id,
          name: r.facility_name,
          campus: SINGLE_CAMPUS_LABEL,
          building: r.building,
          capacity: Number(r.capacity) || 0,
          equipment: equipmentForFacilityCode(id),
        };
      });

      if (equipment.length) {
        items = items.filter((f) => equipment.every((e) => (f.equipment || []).includes(e)));
      }

      const total = items.length;
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, pageCount);
      const startIdx = (safePage - 1) * pageSize;
      const slice = items.slice(startIdx, startIdx + pageSize);

      res.json({ items: slice, total, page: safePage, pageSize, pageCount });
      return;
    } catch (e) {
      void e;
    }
  }

  let items = FACILITIES;
  if (q) {
    items = items.filter((f) => {
      const hay = `${f.name} ${f.building} ${f.campus}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (minCapacity > 0) {
    items = items.filter((f) => f.capacity >= minCapacity);
  }
  if (equipment.length) {
    items = items.filter((f) => equipment.every((e) => (f.equipment || []).includes(e)));
  }

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const slice = items.slice(start, end);

  res.json({ items: slice, total, page: safePage, pageSize, pageCount });
});

app.get("/api/facilities/:id", (req, res) => {
  const db = getDb();
  if (db) {
    try {
      const r = db
        .prepare(
          `SELECT facility_code, facility_name, building, floor, capacity
           FROM facilities
           WHERE facility_code = ? AND is_active = 1`
        )
        .get(req.params.id);
      if (!r) {
        res.status(404).json({ message: "Facility not found" });
        return;
      }
      res.json({
        id: r.facility_code,
        name: r.facility_name,
        campus: SINGLE_CAMPUS_LABEL,
        building: r.building,
        capacity: Number(r.capacity) || 0,
        equipment: equipmentForFacilityCode(r.facility_code),
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
      void e;
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

      const businessStart = toMinutes(String(req.query.businessStart || "08:00"));
      const businessEnd = toMinutes(String(req.query.businessEnd || "22:00"));
      const step = 60;
      const preferredStartMin = toMinutes(preferredStart) ?? businessStart;

      function ceilToHour(mins) {
        const rem = mins % 60;
        if (rem === 0) return mins;
        return mins + (60 - rem);
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
      void e;
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

app.post("/api/bookings", (req, res) => {
  const { facilityId, date, start, end, userEmail, reason } = req.body || {};

  if (!facilityId || !date || !start || !end) {
    res.status(400).json({ message: "Missing required booking fields" });
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
      const startTs = `${date} ${start}:00`;
      const endTs = `${date} ${end}:00`;

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
          message: "Double booking prevented",
          conflict: { id: conflict.id, start: conflict.start, end: conflict.end },
        });
        return;
      }

      const email = String(userEmail || "guest@smu.edu.sg").trim();
      const reasonTrimmed = typeof reason === "string" && reason.trim() ? reason.trim() : null;

      const tx = db.transaction(() => {
        const user = db
          .prepare(
            `INSERT INTO users (first_name, last_name, email)
             VALUES ('Guest', 'User', ?)
             ON CONFLICT(email) DO UPDATE SET email = excluded.email
             RETURNING user_id`
          )
          .get(email);

        const booking = db
          .prepare(
            `INSERT INTO bookings (user_id, booking_reason)
             VALUES (?, ?)
             RETURNING booking_id`
          )
          .get(Number(user.user_id), reasonTrimmed);

        db
          .prepare(
            `INSERT INTO booking_detail (booking_id, facility_id, start_time, end_time)
             VALUES (?, ?, ?, ?)`
          )
          .run(Number(booking.booking_id), facilityDbId, startTs, endTs);

        return Number(booking.booking_id);
      });

      const bookingId = tx();
      res.status(201).json({
        id: `B-${bookingId}`,
        facilityId,
        date,
        start,
        end,
        userEmail: email,
        reason: reasonTrimmed || undefined,
      });
      return;
    } catch (e) {
      res.status(500).json({ message: e?.message || "Booking failed" });
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
      message: "Double booking prevented",
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
    userEmail: userEmail || "unknown@smu.edu.sg",
    reason: typeof reason === "string" && reason.trim() ? reason.trim() : undefined,
  };

  BOOKINGS.push(booking);
  res.status(201).json(booking);
});

app.get("/", (req, res) => {
  res.send("FBS 2.0 backend running");
});

app.listen(3001, () => {
  console.log("Backend running on port 3001");
});
