const request = require("supertest");
const app = require("../index");

describe("GET /api/health", () => {
  it("returns service health payload", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        service: "smu-fbs",
      })
    );
  });

  it("accepts Alicia login on both auth endpoints and returns profile metadata", async () => {
    const authRouteResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: "alicia.tan.2027@smu.edu.sg", password: "password" });

    const legacyRouteResponse = await request(app)
      .post("/api/login")
      .send({ email: "alicia.tan.2027@smu.edu.sg", password: "password" });

    expect(authRouteResponse.status).toBe(200);
    expect(legacyRouteResponse.status).toBe(200);
    expect(authRouteResponse.body).toEqual(
      expect.objectContaining({
        email: "alicia.tan.2027@smu.edu.sg",
        name: "Alicia Tan",
        role: "student",
        token: expect.any(String),
      })
    );
    expect(legacyRouteResponse.body).toEqual(
      expect.objectContaining({
        email: "alicia.tan.2027@smu.edu.sg",
        name: "Alicia Tan",
        role: "student",
        token: expect.any(String),
      })
    );
  });

  it("keeps the demo login working", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@smu.edu.sg", password: "demo123" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        email: "demo@smu.edu.sg",
        name: "Demo User",
        role: "student",
        token: expect.any(String),
      })
    );
  });
});