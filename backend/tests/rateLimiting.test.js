const request = require("supertest");

describe("rate limiting integration", () => {
  const prev = {
    RATE_LIMIT_GLOBAL: process.env.RATE_LIMIT_GLOBAL,
    RATE_LIMIT_SEARCH: process.env.RATE_LIMIT_SEARCH,
    RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW,
  };

  afterAll(() => {
    process.env.RATE_LIMIT_GLOBAL = prev.RATE_LIMIT_GLOBAL;
    process.env.RATE_LIMIT_SEARCH = prev.RATE_LIMIT_SEARCH;
    process.env.RATE_LIMIT_WINDOW = prev.RATE_LIMIT_WINDOW;
    jest.resetModules();
  });

  it("returns 429 after exceeding global limiter threshold", async () => {
    process.env.RATE_LIMIT_GLOBAL = "2";
    process.env.RATE_LIMIT_WINDOW = "60000";

    jest.resetModules();
    const app = require("../index");

    const r1 = await request(app).get("/__debug/routes");
    const r2 = await request(app).get("/__debug/routes");
    const r3 = await request(app).get("/__debug/routes");

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.body).toHaveProperty("error");
  });
});
