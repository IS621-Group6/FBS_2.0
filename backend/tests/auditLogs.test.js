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
  const jitterDays = Math.floor((Date.now() % 1000000) / 1000);
  uniqueDayCounter += 1;
  return isoDateOffset(700 + jitterDays + uniqueDayCounter);
}

async function getAnyFacilityId() {
  const response = await request(app).get("/api/facilities").query({ pageSize: 1 });
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body.items)).toBe(true);
  expect(response.body.items.length).toBeGreaterThan(0);
  return response.body.items[0].id;
}

async function getAuthToken(email, role) {
  const response = await request(app).post("/__debug/login").send({ email, role });
  expect(response.status).toBe(200);
  expect(response.body.token).toBeTruthy();
  return response.body.token;
}

describe("audit logging", () => {
  test("booking creation and cancellation are written to audit logs and visible to admins", async () => {
    const facilityId = await getAnyFacilityId();
    const studentEmail = "audit.student@smu.edu.sg";
    const studentToken = await getAuthToken(studentEmail, "student");
    const adminToken = await getAuthToken("rachel.wong@smu.edu.sg", "admin");

    const createResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        facilityId,
        date: uniqueFutureDate(),
        start: "11:00",
        end: "12:00",
        reason: "Audit logging integration test",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.id).toMatch(/^B-\d+$/);

    const bookingId = createResponse.body.id;

    const cancelResponse = await request(app)
      .delete(`/api/bookings/${encodeURIComponent(bookingId)}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(cancelResponse.status).toBe(200);

    const logsResponse = await request(app)
      .get("/api/admin/logs")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ user_email: studentEmail });

    expect(logsResponse.status).toBe(200);
    expect(Array.isArray(logsResponse.body.logs)).toBe(true);

    const createLog = logsResponse.body.logs.find((entry) => entry.action === "CREATE");
    const cancelLog = logsResponse.body.logs.find((entry) => entry.action === "CANCEL");

    expect(createLog).toMatchObject({
      action: "CREATE",
      user_email: studentEmail,
      booking_id: Number(bookingId.replace(/^B-/, "")),
    });
    expect(cancelLog).toMatchObject({
      action: "CANCEL",
      user_email: studentEmail,
      booking_id: Number(bookingId.replace(/^B-/, "")),
    });
    expect(JSON.parse(createLog.details)).toMatchObject({ facilityId });
    expect(JSON.parse(cancelLog.details)).toMatchObject({ bookingId });
  });

  test("non-admin users cannot retrieve admin audit logs", async () => {
    const studentToken = await getAuthToken("audit.nonadmin@smu.edu.sg", "student");

    const response = await request(app)
      .get("/api/admin/logs")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/admin access required/i);
  });
});