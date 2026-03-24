const request = require("supertest");
const app = require("../index");
const { getDb } = require("../sqlite");

async function getAuthToken(email, role = "user") {
  const response = await request(app).post("/__debug/login").send({ email, role });
  expect(response.status).toBe(200);
  expect(response.body.token).toBeTruthy();
  return response.body.token;
}

async function getAnyFacilityId() {
  const response = await request(app).get("/api/facilities").query({ pageSize: 1 });
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body.items)).toBe(true);
  expect(response.body.items.length).toBeGreaterThan(0);
  return response.body.items[0].id;
}

function setStudentBalance(email, remainingCredits) {
  const db = getDb();
  db.prepare(
    `INSERT INTO student_credit_balances (email, remaining_credits)
     VALUES (?, ?)
     ON CONFLICT(email) DO UPDATE SET
       remaining_credits = excluded.remaining_credits,
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')`
  ).run(String(email || "").trim().toLowerCase(), Number(remainingCredits));
}

describe("GET /api/me/credits", () => {
  test("returns remaining credits for a signed-in student", async () => {
    const token = await getAuthToken("credits.student@smu.edu.sg", "student");

    const response = await request(app)
      .get("/api/me/credits")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      email: "credits.student@smu.edu.sg",
      role: "student",
      creditsRemaining: 4500,
    });
  });

  test("requires an access token", async () => {
    const response = await request(app).get("/api/me/credits");

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/access token required/i);
  });

  test("booking creation deducts credits and cancellation refunds them for a future booking", async () => {
    const facilityId = await getAnyFacilityId();
    const email = `credits.flow.${Date.now()}@smu.edu.sg`;
    const token = await getAuthToken(email, "student");

    const createResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        facilityId,
        date: "2030-11-01",
        start: "09:00",
        end: "10:00",
        reason: "Credits deduction and refund flow",
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.deducted).toBe(100);
    expect(createResponse.body.creditsRemaining).toBe(4400);

    const balanceAfterCreate = await request(app)
      .get("/api/me/credits")
      .set("Authorization", `Bearer ${token}`);

    expect(balanceAfterCreate.status).toBe(200);
    expect(balanceAfterCreate.body.creditsRemaining).toBe(4400);

    const cancelResponse = await request(app)
      .delete(`/api/bookings/${encodeURIComponent(createResponse.body.id)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.refundedCredits).toBe(100);
    expect(cancelResponse.body.creditsRemaining).toBe(4500);

    const balanceAfterCancel = await request(app)
      .get("/api/me/credits")
      .set("Authorization", `Bearer ${token}`);

    expect(balanceAfterCancel.status).toBe(200);
    expect(balanceAfterCancel.body.creditsRemaining).toBe(4500);
  });

  test("student booking is rejected when remaining credits are insufficient", async () => {
    const facilityId = await getAnyFacilityId();
    const email = `credits.low.${Date.now()}@smu.edu.sg`;
    const token = await getAuthToken(email, "student");

    setStudentBalance(email, 50);

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        facilityId,
        date: "2030-11-02",
        start: "10:00",
        end: "11:00",
        reason: "Should fail for low balance",
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/insufficient credits/i);

    const balanceResponse = await request(app)
      .get("/api/me/credits")
      .set("Authorization", `Bearer ${token}`);

    expect(balanceResponse.status).toBe(200);
    expect(balanceResponse.body.creditsRemaining).toBe(50);
  });
});