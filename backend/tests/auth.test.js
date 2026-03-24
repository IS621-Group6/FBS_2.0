const request = require("supertest");
const app = require("../index");

async function getAnyFacilityId() {
  const response = await request(app).get("/api/facilities").query({ pageSize: 1 });
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body.items)).toBe(true);
  expect(response.body.items.length).toBeGreaterThan(0);
  return response.body.items[0].id;
}

describe("POST /api/login", () => {
  test("signs in a seeded student user with bcrypt password", async () => {
    const response = await request(app).post("/api/login").send({
      email: "alicia.tan.2027@smu.edu.sg",
      password: "password",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      email: "alicia.tan.2027@smu.edu.sg",
      role: "student",
    });
    expect(response.body.token).toBeTruthy();
  });

  test("rejects an incorrect password", async () => {
    const response = await request(app).post("/api/login").send({
      email: "marcus.goh@smu.edu.sg",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid email or password/i);
  });

  test("debug-auth bookings do not create a reusable password login", async () => {
    const facilityId = await getAnyFacilityId();
    const email = `debug.persist.${Date.now()}@smu.edu.sg`;
    const debugLogin = await request(app).post("/__debug/login").send({ email, role: "student" });

    expect(debugLogin.status).toBe(200);
    expect(debugLogin.body.token).toBeTruthy();

    const createBooking = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${debugLogin.body.token}`)
      .send({
        facilityId,
        date: "2030-12-01",
        start: "10:00",
        end: "11:00",
        reason: "Create debug-owned user record",
      });

    expect(createBooking.status).toBe(201);

    const loginResponse = await request(app).post("/api/login").send({
      email,
      password: "password",
    });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.message).toMatch(/invalid email or password/i);
  });
});