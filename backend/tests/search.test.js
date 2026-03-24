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
  return isoDateOffset(600 + jitterDays + uniqueDayCounter);
}

async function getAnyFacilityId() {
  const resp = await request(app).get("/api/facilities").query({ pageSize: 1 });
  expect(resp.status).toBe(200);
  expect(Array.isArray(resp.body.items)).toBe(true);
  expect(resp.body.items.length).toBeGreaterThan(0);
  return resp.body.items[0].id;
}

async function getAuthToken(email, role = "student") {
  const resp = await request(app).post("/__debug/login").send({ email, role });
  expect(resp.status).toBe(200);
  expect(resp.body.token).toBeTruthy();
  return resp.body.token;
}

describe("facility search behavior", () => {
  test("tokenized ranked search resolves mixed building and room phrases", async () => {
    const resp = await request(app)
      .get("/api/facilities")
      .query({ q: "kgc 401", pageSize: 5 });

    expect(resp.status).toBe(200);
    expect(resp.headers["x-search-cache"]).toBe("MISS");
    expect(resp.body.items[0].id).toBe("KGC-4-01-PR");
  });

  test("search cache is reused and invalidated after booking creation", async () => {
    const query = { q: "law library 401", pageSize: 5 };

    const first = await request(app).get("/api/facilities").query(query);
    expect(first.status).toBe(200);
    expect(first.headers["x-search-cache"]).toBe("MISS");
    expect(first.body.items[0].id).toBe("KGC-4-01-PR");

    const second = await request(app).get("/api/facilities").query(query);
    expect(second.status).toBe(200);
    expect(second.headers["x-search-cache"]).toBe("HIT");

    const facilityId = await getAnyFacilityId();
    const token = await getAuthToken("search.cache@smu.edu.sg", "student");
    const create = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        facilityId,
        date: uniqueFutureDate(),
        start: "09:00",
        end: "10:00",
        reason: "Invalidate cached search results",
      });

    expect(create.status).toBe(201);

    const third = await request(app).get("/api/facilities").query(query);
    expect(third.status).toBe(200);
    expect(third.headers["x-search-cache"]).toBe("MISS");
    expect(third.body.items[0].id).toBe("KGC-4-01-PR");
  });
});