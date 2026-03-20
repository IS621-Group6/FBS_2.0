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
});