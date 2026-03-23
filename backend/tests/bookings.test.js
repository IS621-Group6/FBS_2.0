const request = require("supertest");
const app = require("../index");

function isoDateOffset(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

let uniqueDayCounter = 0;
function uniqueFutureDate() {
  // Keep dates well in the future and vary per run to avoid collisions with persisted SQLite bookings.
  const jitterDays = Math.floor((Date.now() % 1000000) / 1000);
  uniqueDayCounter += 1;
  return isoDateOffset(500 + jitterDays + uniqueDayCounter);
}

function singaporeTodayIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dayPart = parts.find((p) => p.type === "day");
  const monthPart = parts.find((p) => p.type === "month");
  const yearPart = parts.find((p) => p.type === "year");
  if (!dayPart?.value || !monthPart?.value || !yearPart?.value) {
    throw new Error("Failed to compute Singapore ISO date for tests");
  }
  const day = dayPart.value;
  const month = monthPart.value;
  const year = yearPart.value;
  return `${year}-${month}-${day}`;
}

function isoDateOffsetFrom(baseIso, deltaDays) {
  const [yy, mm, dd] = String(baseIso).split("-").map(Number);
  const d = new Date(Date.UTC(yy, mm - 1, dd));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getAnyFacilityId() {
  const resp = await request(app).get("/api/facilities").query({ pageSize: 1 });
  expect(resp.status).toBe(200);
  expect(Array.isArray(resp.body.items)).toBe(true);
  expect(resp.body.items.length).toBeGreaterThan(0);
  return resp.body.items[0].id;
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function toHHMM(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function getFreeOneHourSlot(facilityId, date) {
  const availability = await request(app)
    .get(`/api/facilities/${encodeURIComponent(facilityId)}/availability`)
    .query({ date });

  expect(availability.status).toBe(200);
  const reservations = Array.isArray(availability.body.reservations)
    ? availability.body.reservations
    : [];
  const booked = reservations
    .map((r) => ({ start: toMinutes(r.start), end: toMinutes(r.end) }))
    .filter((r) => r.start !== null && r.end !== null);

  for (let t = 8 * 60; t + 60 <= 22 * 60; t += 30) {
    const end = t + 60;
    const conflict = booked.some((b) => overlaps(t, end, b.start, b.end));
    if (!conflict) return { start: toHHMM(t), end: toHHMM(end) };
  }

  throw new Error(`No free one-hour slot found for ${facilityId} on ${date}`);
}

describe("Facilities and bookings API integration", () => {
  test("view facility details returns data for valid facility", async () => {
    const facilityId = await getAnyFacilityId();
    const resp = await request(app).get(`/api/facilities/${encodeURIComponent(facilityId)}`);

    expect(resp.status).toBe(200);
    expect(resp.body).toMatchObject({
      id: facilityId,
    });
    expect(resp.body).toHaveProperty("name");
    expect(resp.body).toHaveProperty("building");
    expect(resp.body).toHaveProperty("capacity");
  });

  test("view facility details returns 404 for unknown facility", async () => {
    const resp = await request(app).get("/api/facilities/DOES-NOT-EXIST");
    expect(resp.status).toBe(404);
  });

  test("search facilities supports building filter", async () => {
    const first = await request(app).get("/api/facilities").query({ pageSize: 1 });
    const building = first.body.items[0].building;

    const resp = await request(app).get("/api/facilities").query({ building, pageSize: 25 });

    expect(resp.status).toBe(200);
    expect(resp.body.items.length).toBeGreaterThan(0);
    expect(resp.body.items.every((f) => f.building === building)).toBe(true);
  });

  test("create booking succeeds and returns confirmation payload", async () => {
    const facilityId = await getAnyFacilityId();
    const payload = {
      facilityId,
      date: uniqueFutureDate(),
      start: "09:00",
      end: "10:00",
      userEmail: "student.integration@smu.edu.sg",
      reason: "Integration test booking",
    };

    const resp = await request(app).post("/api/bookings").set("x-user-role", "student").send(payload);

    expect(resp.status).toBe(201);
    expect(resp.body).toMatchObject({
      facilityId: payload.facilityId,
      date: payload.date,
      start: payload.start,
      end: payload.end,
      userEmail: payload.userEmail,
    });
    expect(resp.body.id).toMatch(/^B-\d+$/);
  });

  test("same-day booking is allowed (Singapore time)", async () => {
    const facilityId = await getAnyFacilityId();
    const date = singaporeTodayIso();
    const slot = await getFreeOneHourSlot(facilityId, date);
    const resp = await request(app).post("/api/bookings").send({
      facilityId,
      date,
      start: slot.start,
      end: slot.end,
      userEmail: "same.day@smu.edu.sg",
      reason: "Same day booking should be allowed",
    });

    expect(resp.status).toBe(201);
    expect(resp.body.date).toBe(date);
  });

  test("cannot create booking before today (Singapore time)", async () => {
    const facilityId = await getAnyFacilityId();
    const yesterdaySg = isoDateOffsetFrom(singaporeTodayIso(), -1);
    const resp = await request(app).post("/api/bookings").send({
      facilityId,
      date: yesterdaySg,
      start: "10:00",
      end: "11:00",
      userEmail: "past.create@smu.edu.sg",
      reason: "Past date should be blocked",
    });

    expect(resp.status).toBe(400);
    expect(resp.body.message).toMatch(/cannot be before today/i);
  });

  test("prevent double booking on same facility/date/time", async () => {
    const facilityId = await getAnyFacilityId();
    const date = uniqueFutureDate();
    const slot = {
      facilityId,
      date,
      start: "11:00",
      end: "12:00",
    };

    const first = await request(app).post("/api/bookings").send({
      ...slot,
      userEmail: "first.user@smu.edu.sg",
      reason: "Create initial booking",
    });
    expect(first.status).toBe(201);

    const second = await request(app).post("/api/bookings").send({
      ...slot,
      userEmail: "second.user@smu.edu.sg",
      reason: "Attempt overlap",
    });

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({
      error: "DOUBLE_BOOKING",
    });
  });

  test("modify booking requires login header", async () => {
    const facilityId = await getAnyFacilityId();
    const create = await request(app).post("/api/bookings").send({
      facilityId,
      date: uniqueFutureDate(),
      start: "13:00",
      end: "14:00",
      userEmail: "needs.auth@smu.edu.sg",
      reason: "Create for modify auth test",
    });
    expect(create.status).toBe(201);

    const bookingId = create.body.id;
    const modify = await request(app).put(`/api/bookings/${bookingId}`).send({
      date: uniqueFutureDate(),
      start: "14:00",
      end: "15:00",
    });

    expect(modify.status).toBe(401);
  });

  test("modify booking succeeds for owner", async () => {
    const facilityId = await getAnyFacilityId();
    const ownerEmail = "booking.owner@smu.edu.sg";
    const date = uniqueFutureDate();

    const create = await request(app).post("/api/bookings").send({
      facilityId,
      date,
      start: "15:00",
      end: "16:00",
      userEmail: ownerEmail,
      reason: "Create for modify success",
    });
    expect(create.status).toBe(201);

    const bookingId = create.body.id;
    const modify = await request(app)
      .put(`/api/bookings/${bookingId}`)
      .set("x-user-email", ownerEmail)
      .send({
        date,
        start: "16:00",
        end: "17:00",
      });

    expect(modify.status).toBe(200);
    expect(modify.body).toMatchObject({
      id: bookingId,
      date,
      start: "16:00",
      end: "17:00",
      userEmail: ownerEmail,
    });
  });

  test("cannot modify booking to a past date (Singapore time)", async () => {
    const facilityId = await getAnyFacilityId();
    const ownerEmail = "modify.past@smu.edu.sg";
    const futureDate = isoDateOffsetFrom(singaporeTodayIso(), 2);
    const pastDate = isoDateOffsetFrom(singaporeTodayIso(), -1);
    const slot = await getFreeOneHourSlot(facilityId, futureDate);

    const create = await request(app).post("/api/bookings").send({
      facilityId,
      date: futureDate,
      start: slot.start,
      end: slot.end,
      userEmail: ownerEmail,
      reason: "Create for past-date modify test",
    });
    expect(create.status).toBe(201);

    const bookingId = create.body.id;
    const modify = await request(app)
      .put(`/api/bookings/${bookingId}`)
      .set("x-user-email", ownerEmail)
      .send({
        date: pastDate,
        start: "10:00",
        end: "11:00",
      });

    expect(modify.status).toBe(400);
    expect(modify.body.message).toMatch(/cannot be before today/i);
  });

  test("cancel booking returns cancellation confirmation", async () => {
    const facilityId = await getAnyFacilityId();
    const ownerEmail = "cancel.owner@smu.edu.sg";

    const create = await request(app).post("/api/bookings").send({
      facilityId,
      date: uniqueFutureDate(),
      start: "09:30",
      end: "10:30",
      userEmail: ownerEmail,
      reason: "Create for cancellation",
    });
    expect(create.status).toBe(201);

    const bookingId = create.body.id;
    const cancel = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set("x-user-email", ownerEmail);

    expect(cancel.status).toBe(200);
    expect(cancel.body).toMatchObject({
      message: "Booking cancelled successfully.",
      booking: {
        id: bookingId,
        userEmail: ownerEmail,
        status: "cancelled",
      },
    });
  });

  test("bookings list can be scoped by x-user-email", async () => {
    const facilityId = await getAnyFacilityId();
    const targetEmail = "scoped.user@smu.edu.sg";

    const create = await request(app).post("/api/bookings").send({
      facilityId,
      date: uniqueFutureDate(),
      start: "12:00",
      end: "13:00",
      userEmail: targetEmail,
      reason: "Create for bookings list scope",
    });
    expect(create.status).toBe(201);

    const list = await request(app).get("/api/bookings").set("x-user-email", targetEmail);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(list.body.items.every((b) => String(b.userEmail).toLowerCase() === targetEmail)).toBe(true);
  });

  test("real-time availability shows booked slot", async () => {
    const facilityId = await getAnyFacilityId();
    const date = uniqueFutureDate();

    const create = await request(app).post("/api/bookings").send({
      facilityId,
      date,
      start: "18:00",
      end: "19:00",
      userEmail: "availability.user@smu.edu.sg",
      reason: "Create for availability",
    });
    expect(create.status).toBe(201);

    const availability = await request(app)
      .get(`/api/facilities/${encodeURIComponent(facilityId)}/availability`)
      .query({ date });

    expect(availability.status).toBe(200);
    expect(Array.isArray(availability.body.reservations)).toBe(true);
    expect(
      availability.body.reservations.some((r) => r.start === "18:00" && r.end === "19:00")
    ).toBe(true);
  });
});
