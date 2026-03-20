const {
  buildSeedFacilities,
  inferCapacityFromType,
  inferFloorFromName,
  inferTypeFromName,
} = require("../facilityCatalog");

describe("facilityCatalog unit tests", () => {
  it("buildSeedFacilities creates realistic, unique facilities", () => {
    const facilities = buildSeedFacilities({ campusLabel: "SMU" });

    expect(Array.isArray(facilities)).toBe(true);
    expect(facilities.length).toBeGreaterThan(100);

    const ids = facilities.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const f of facilities) {
      expect(f).toHaveProperty("name");
      expect(f).toHaveProperty("building");
      expect(f).toHaveProperty("type");
      expect(f).toHaveProperty("capacity");
      expect(f.campus).toBe("SMU");
      expect(Number.isFinite(Number(f.capacity))).toBe(true);
    }
  });

  it("infers floor from common room naming patterns", () => {
    expect(inferFloorFromName("YPHSL Seminar Room B1-01")).toBe(-1);
    expect(inferFloorFromName("KGC-4.01-PR")).toBe(4);
    expect(inferFloorFromName("SOE/SCIS2 Catering Area 3C (Near to GSR 3-10)")).toBe(3);
  });

  it("infers type from room name", () => {
    expect(inferTypeFromName("LKCSB GSR 2-1")).toBe("Group Study Room");
    expect(inferTypeFromName("LKSLIB Project Room 5-8")).toBe("Project Room");
    expect(inferTypeFromName("Admin Badminton Court-1")).toBe("MPH / Sports Hall");
  });

  it("maps canonical capacities by type", () => {
    expect(inferCapacityFromType("Phone Booth")).toBe(1);
    expect(inferCapacityFromType("Seminar Room")).toBe(20);
    expect(inferCapacityFromType("Classroom")).toBe(40);
  });
});
