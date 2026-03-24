const crypto = require("crypto");

function slugify(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function stableIdForFacilityName(name, { buildingCode }) {
  const base = slugify(name);
  if (base.length && base.length <= 64) return base;
  const h = crypto.createHash("sha1").update(String(name)).digest("hex").slice(0, 10);
  const clipped = base.slice(0, 48);
  return `${clipped || buildingCode || "FAC"}-${h}`;
}

function inferFloorFromName(name) {
  const s = String(name || "");

  // Basement formats: "B1-1", "B2-03", "B1-09", "B2-01".
  const basement = s.match(/\bB\s*(\d{1,2})\b/i);
  if (basement?.[1]) {
    const b = Number(basement[1]);
    if (Number.isFinite(b) && b > 0) return -b;
  }

  // Level formats:
  // - "2-1", "3-01", "4.01"
  // - "2.1" (phone booth)
  const levelDelimited = s.match(/\b(\d{1,2})(?=[-.])/);
  if (levelDelimited?.[1]) {
    const n = Number(levelDelimited[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // Catering areas: "3C", "4A".
  const levelLetter = s.match(/\b(\d{1,2})[A-Z]\b/i);
  if (levelLetter?.[1]) {
    const n = Number(levelLetter[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 1;
}

function inferTypeFromName(name) {
  const s = String(name || "").toLowerCase();

  if (s.includes("catering area")) return "Catering Area";
  if (s.includes("chatterbox")) return "Chatterbox";
  if (s.includes("seminar room")) return "Seminar Room";
  if (s.includes("meeting pod")) return "Meeting Pod";
  if (s.includes("phone booth")) return "Phone Booth";
  if (s.includes("study booth")) return "Study Booth";
  if (s.includes("gsr")) return "Group Study Room";

  // Project Rooms: explicit text or suffix "-PR" codes.
  if (s.includes("project room") || /\bpr\b/i.test(String(name))) return "Project Room";

  // Sports facilities (all map to MPH / Sports Hall).
  if (
    s.includes("badminton court") ||
    s.includes("basketball court") ||
    s.includes("floorball court") ||
    s.includes("netball court") ||
    s.includes("table tennis") ||
    s.includes("fencing")
  ) {
    return "MPH / Sports Hall";
  }

  // Everything else fits under Classroom or SMUC Facilities depending on usage.
  if (s.includes("active learning classroom")) return "Classroom";
  if (s.includes("classroom")) return "Classroom";
  if (s.includes("jamming room") || s.includes("meeting lounge")) return "SMUC Facilities";

  return "Classroom";
}

function inferCapacityFromType(type) {
  switch (type) {
    case "Phone Booth":
    case "Study Booth":
      return 1;
    case "Meeting Pod":
      return 4;
    case "Chatterbox":
      return 4;
    case "Group Study Room":
      return 8;
    case "Project Room":
    case "Project Room (Level 5)":
      return 10;
    case "Seminar Room":
      return 20;
    case "Catering Area":
      return 30;
    case "Classroom":
      return 40;
    case "SMUC Facilities":
      return 12;
    case "MPH / Sports Hall":
      return 10;
    case "Hostel Facilities":
      return 10;
    default:
      return 8;
  }
}

function normalizeCanonicalType(type, { name, building, floor }) {
  const raw = String(type || "");
  if (raw === "Project Room" && Number(floor) === 5) return "Project Room (Level 5)";
  if (raw === "Classroom" && String(building || "").toLowerCase().includes("smu connexion")) return "SMUC Facilities";
  if (raw === "Classroom" && String(name || "").toLowerCase().includes("active learning classroom")) return "Classroom";
  return raw;
}

const BUILDINGS = [
  {
    building: "Administration Building",
    buildingCode: "ADMIN",
    facilities: [
      "Admin Badminton Court-1",
      "Admin Badminton Court-2",
      "Admin Badminton Court-3",
      "Admin Basketball Court",
      "Admin Fencing",
      "Admin Floorball Court",
      "Admin Netball Court",
      "Admin Table Tennis table-1",
      "Admin Table Tennis table-2",
    ],
  },
  {
    building: "Lee Kong Chian School of Business",
    buildingCode: "LKCSB",
    facilities: [
      "LKCSB Classroom 2-1",
      "LKCSB Classroom 3-2",
      "LKCSB Classroom 3-3",
      "LKCSB Classroom 3-4",
      "LKCSB Classroom 3-5",
      "LKCSB GSR 1-1",
      "LKCSB GSR 1-2",
      "LKCSB GSR 2-1",
      "LKCSB GSR 2-10",
      "LKCSB GSR 2-11",
      "LKCSB GSR 2-12",
      "LKCSB GSR 2-13",
      "LKCSB GSR 2-14",
      "LKCSB GSR 2-15",
      "LKCSB GSR 2-16",
      "LKCSB GSR 2-17",
      "LKCSB GSR 2-18",
      "LKCSB GSR 2-19",
      "LKCSB GSR 2-2",
      "LKCSB GSR 2-20",
      "LKCSB GSR 2-21",
      "LKCSB GSR 2-22",
      "LKCSB GSR 2-23",
      "LKCSB GSR 2-24",
      "LKCSB GSR 2-25",
      "LKCSB GSR 2-3",
      "LKCSB GSR 2-4",
      "LKCSB GSR 2-5",
      "LKCSB GSR 2-6",
      "LKCSB GSR 2-7",
      "LKCSB GSR 2-8",
      "LKCSB GSR 2-9",
      "LKCSB GSR 3-1",
      "LKCSB GSR 3-11",
      "LKCSB GSR 3-12",
      "LKCSB GSR 3-13",
      "LKCSB GSR 3-14",
      "LKCSB GSR 3-15",
      "LKCSB GSR 3-16",
      "LKCSB GSR 3-17",
      "LKCSB GSR 3-18",
      "LKCSB GSR 3-19",
      "LKCSB GSR 3-2",
      "LKCSB GSR 3-20",
      "LKCSB GSR 3-21",
      "LKCSB GSR 3-22",
      "LKCSB GSR 3-23",
      "LKCSB GSR 3-24",
      "LKCSB GSR 3-25",
      "LKCSB GSR 3-26",
      "LKCSB GSR 3-27",
      "LKCSB GSR 3-28",
      "LKCSB GSR 3-29",
      "LKCSB GSR 3-3",
      "LKCSB GSR 3-30",
      "LKCSB GSR 3-31",
      "LKCSB GSR 3-32",
      "LKCSB GSR 3-33",
      "LKCSB GSR 3-34",
      "LKCSB GSR 3-35",
      "LKCSB GSR 3-4",
      "LKCSB GSR 3-5",
      "LKCSB GSR 3-6",
      "LKCSB GSR 3-7",
      "LKCSB GSR 3-8",
      "LKCSB GSR 3-9",
      "LKCSB Meeting Pod 3-1",
      "LKCSB Meeting Pod 3-2",
      "LKCSB Meeting Pod 3-3",
      "LKCSB Meeting Pod 3-4",
      "LKCSB Meeting Pod 3-5",
      "LKCSB Seminar Room 1-1",
      "LKCSB Seminar Room 1-2",
      "LKCSB Seminar Room 2-1",
      "LKCSB Seminar Room 2-2",
      "LKCSB Seminar Room 2-3",
      "LKCSB Seminar Room 2-4",
      "LKCSB Seminar Room 2-5",
      "LKCSB Seminar Room 2-6",
      "LKCSB Seminar Room 2-7",
      "LKCSB Seminar Room 2-8",
      "LKCSB Seminar Room 3-1",
      "LKCSB Seminar Room 3-10",
      "LKCSB Seminar Room 3-2",
      "LKCSB Seminar Room 3-3",
      "LKCSB Seminar Room 3-4",
      "LKCSB Seminar Room 3-5",
      "LKCSB Seminar Room 3-6",
      "LKCSB Seminar Room 3-7",
      "LKCSB Seminar Room 3-8",
      "LKCSB Seminar Room 3-9",
    ],
  },
  {
    building: "Li Ka Shing Library",
    buildingCode: "LKSLIB",
    facilities: [
      "LKSLIB Phone Booth 2.1",
      "LKSLIB Phone Booth 2.2",
      "LKSLIB Project Room 2-0",
      "LKSLIB Project Room 2-1",
      "LKSLIB Project Room 2-2",
      "LKSLIB Project Room 2-3",
      "LKSLIB Project Room 2-4",
      "LKSLIB Project Room 2-5",
      "LKSLIB Project Room 3-1",
      "LKSLIB Project Room 3-2",
      "LKSLIB Project Room 3-3",
      "LKSLIB Project Room 3-4",
      "LKSLIB Project Room 3-5",
      "LKSLIB Project Room 4-1",
      "LKSLIB Project Room 4-10",
      "LKSLIB Project Room 4-11",
      "LKSLIB Project Room 4-12",
      "LKSLIB Project Room 4-13",
      "LKSLIB Project Room 4-14",
      "LKSLIB Project Room 4-15",
      "LKSLIB Project Room 4-16",
      "LKSLIB Project Room 4-18",
      "LKSLIB Project Room 4-2",
      "LKSLIB Project Room 4-4",
      "LKSLIB Project Room 4-5",
      "LKSLIB Project Room 4-6",
      "LKSLIB Project Room 4-7",
      "LKSLIB Project Room 4-8",
      "LKSLIB Project Room 4-9",
      "LKSLIB Project Room 5-1",
      "LKSLIB Project Room 5-10",
      "LKSLIB Project Room 5-2",
      "LKSLIB Project Room 5-3",
      "LKSLIB Project Room 5-4",
      "LKSLIB Project Room 5-5",
      "LKSLIB Project Room 5-6",
      "LKSLIB Project Room 5-7",
      "LKSLIB Project Room 5-8",
      "LKSLIB Project Room 5-9",
      "LKSLIB Study Booth 2-1",
      "LKSLIB Study Booth 2-2",
      "LKSLIB Study Booth 2-3",
      "LKSLIB Study Booth 2-4",
      "LKSLIB Study Booth 2-5",
      "LKSLIB Study Booth 3-1",
      "LKSLIB Study Booth 4-1",
      "LKSLIB Study Booth 4-2",
      "LKSLIB Study Booth 4-3",
    ],
  },
  {
    building: "School of Accountancy",
    buildingCode: "SOA",
    facilities: [
      "SOA Classroom 2-1",
      "SOA GSR 2-1",
      "SOA GSR 2-2",
      "SOA GSR 2-3",
      "SOA GSR 2-4",
      "SOA GSR 2-5",
      "SOA GSR 2-6",
      "SOA GSR 2-7",
      "SOA GSR 2-8",
      "SOA GSR 2-9",
      "SOA GSR 3-1",
      "SOA GSR 3-10",
      "SOA GSR 3-2",
      "SOA GSR 3-3",
      "SOA GSR 3-4",
      "SOA GSR 3-5",
      "SOA GSR 3-6",
      "SOA GSR 3-7",
      "SOA GSR 3-8",
      "SOA GSR 3-9",
      "SOA Meeting Pod 3-1",
      "SOA Meeting Pod 3-2",
      "SOA Seminar Room 1-1",
      "SOA Seminar Room 1-2",
      "SOA Seminar Room 1-3",
      "SOA Seminar Room 2-1",
      "SOA Seminar Room 2-2",
      "SOA Seminar Room 2-3",
      "SOA Seminar Room 2-4",
      "SOA Seminar Room 2-5",
      "SOA Seminar Room 3-1",
      "SOA Seminar Room 3-2",
      "SOA Seminar Room 3-3",
      "SOA Seminar Room 3-4",
      "SOA Seminar Room 3-5",
    ],
  },
  {
    building: "School of Computing & Information Systems 1",
    buildingCode: "SCIS1",
    facilities: [
      "SCIS1 Classroom 3-1",
      "SCIS1 Classroom 3-2",
      "SCIS1 Classroom B1-1",
      "SCIS1 GSR 2-1",
      "SCIS1 GSR 2-2",
      "SCIS1 GSR 2-3",
      "SCIS1 GSR 2-4",
      "SCIS1 GSR 2-5",
      "SCIS1 GSR 2-6",
      "SCIS1 GSR 2-7",
      "SCIS1 GSR 3-1",
      "SCIS1 GSR 3-2",
      "SCIS1 GSR 3-3",
      "SCIS1 GSR 3-4",
      "SCIS1 GSR 3-5",
      "SCIS1 GSR 3-6",
      "SCIS1 Meeting Pod 3-1",
      "SCIS1 Meeting Pod 3-2",
      "SCIS1 Seminar Room 2-1",
      "SCIS1 Seminar Room 2-2",
      "SCIS1 Seminar Room 2-3",
      "SCIS1 Seminar Room 2-4",
      "SCIS1 Seminar Room 3-1",
      "SCIS1 Seminar Room 3-2",
      "SCIS1 Seminar Room 3-3",
      "SCIS1 Seminar Room 3-4",
      "SCIS1 Seminar Room B1-1",
    ],
  },
  {
    building: "School of Economics/School of Computing & Information Systems 2",
    buildingCode: "SOE-SCIS2",
    facilities: [
      "SOE/SCIS2 Catering Area 3C (Near to GSR 3-10)",
      "SOE/SCIS2 Catering Area 3D (Near to GSR 3-10)",
      "SOE/SCIS2 Catering Area 3E (Near to GSR 3-10)",
      "SOE/SCIS2 Catering Area 3F (Near to GSR 3-10)",
      "SOE/SCIS2 Catering Area 4A (Near to SR 4-2)",
      "SOE/SCIS2 Catering Area 4B (Near to SR 4-2)",
      "SOE/SCIS2 Catering Area 4C (Near to SR 4-4)",
      "SOE/SCIS2 Classroom 2-1",
      "SOE/SCIS2 Classroom 2-2",
      "SOE/SCIS2 Classroom 3-1",
      "SOE/SCIS2 Classroom 3-2",
      "SOE/SCIS2 Classroom 3-3",
      "SOE/SCIS2 Classroom 4-1",
      "SOE/SCIS2 Classroom 4-3",
      "SOE/SCIS2 GSR 2-1",
      "SOE/SCIS2 GSR 2-10",
      "SOE/SCIS2 GSR 2-11",
      "SOE/SCIS2 GSR 2-12",
      "SOE/SCIS2 GSR 2-13",
      "SOE/SCIS2 GSR 2-14",
      "SOE/SCIS2 GSR 2-15",
      "SOE/SCIS2 GSR 2-16",
      "SOE/SCIS2 GSR 2-17",
      "SOE/SCIS2 GSR 2-2",
      "SOE/SCIS2 GSR 2-3",
      "SOE/SCIS2 GSR 2-4",
      "SOE/SCIS2 GSR 2-5",
      "SOE/SCIS2 GSR 2-6",
      "SOE/SCIS2 GSR 2-7",
      "SOE/SCIS2 GSR 2-8",
      "SOE/SCIS2 GSR 2-9",
      "SOE/SCIS2 GSR 3-1",
      "SOE/SCIS2 GSR 3-10",
      "SOE/SCIS2 GSR 3-11",
      "SOE/SCIS2 GSR 3-12",
      "SOE/SCIS2 GSR 3-13",
      "SOE/SCIS2 GSR 3-14",
      "SOE/SCIS2 GSR 3-15",
      "SOE/SCIS2 GSR 3-16",
      "SOE/SCIS2 GSR 3-17",
      "SOE/SCIS2 GSR 3-18",
      "SOE/SCIS2 GSR 3-2",
      "SOE/SCIS2 GSR 3-3",
      "SOE/SCIS2 GSR 3-4",
      "SOE/SCIS2 GSR 3-5",
      "SOE/SCIS2 GSR 3-6",
      "SOE/SCIS2 GSR 3-7",
      "SOE/SCIS2 GSR 3-8",
      "SOE/SCIS2 GSR 3-9",
      "SOE/SCIS2 GSR 4-10",
      "SOE/SCIS2 GSR 4-4",
      "SOE/SCIS2 GSR 4-5",
      "SOE/SCIS2 GSR 4-6",
      "SOE/SCIS2 GSR 4-7",
      "SOE/SCIS2 GSR 4-8",
      "SOE/SCIS2 GSR 4-9",
      "SOE/SCIS2 Meeting Pod 3-1",
      "SOE/SCIS2 Meeting Pod 3-2",
      "SOE/SCIS2 Meeting Pod 3-3",
      "SOE/SCIS2 Meeting Pod 3-4",
      "SOE/SCIS2 Seminar Room 2-1",
      "SOE/SCIS2 Seminar Room 2-10",
      "SOE/SCIS2 Seminar Room 2-2",
      "SOE/SCIS2 Seminar Room 2-3",
      "SOE/SCIS2 Seminar Room 2-4",
      "SOE/SCIS2 Seminar Room 2-5",
      "SOE/SCIS2 Seminar Room 2-6",
      "SOE/SCIS2 Seminar Room 2-7",
      "SOE/SCIS2 Seminar Room 2-8",
      "SOE/SCIS2 Seminar Room 2-9",
      "SOE/SCIS2 Seminar Room 3-1",
      "SOE/SCIS2 Seminar Room 3-10",
      "SOE/SCIS2 Seminar Room 3-2",
      "SOE/SCIS2 Seminar Room 3-3",
      "SOE/SCIS2 Seminar Room 3-4",
      "SOE/SCIS2 Seminar Room 3-5",
      "SOE/SCIS2 Seminar Room 3-6",
      "SOE/SCIS2 Seminar Room 3-7",
      "SOE/SCIS2 Seminar Room 3-8",
      "SOE/SCIS2 Seminar Room 3-9",
      "SOE/SCIS2 Seminar Room 4-1",
      "SOE/SCIS2 Seminar Room 4-2",
      "SOE/SCIS2 Seminar Room 4-3",
      "SOE/SCIS2 Seminar Room 4-4",
      "SOE/SCIS2 Seminar Room 5-1",
      "SOE/SCIS2 Seminar Room 5-2",
      "SOE/SCIS2 Seminar Room B1-1",
      "SOE/SCIS2 Seminar Room B1-2",
    ],
  },
  {
    building: "School of Social Sciences/College of Integrative Studies",
    buildingCode: "SOSS-CIS",
    facilities: [
      "SOSS/CIS Classroom 1-2",
      "SOSS/CIS Classroom 3-2",
      "SOSS/CIS Classroom 3-4",
      "SOSS/CIS Classroom 3-5",
      "SOSS/CIS Meeting Pod B1-1",
      "SOSS/CIS Meeting Pod B1-2",
      "SOSS/CIS Meeting Pod B1-3",
      "SOSS/CIS Meeting Pod B1-4",
      "SOSS/CIS Meeting Pod B1-5",
      "SOSS/CIS Seminar Room 1-1",
      "SOSS/CIS Seminar Room 1-3",
      "SOSS/CIS Seminar Room 2-1",
      "SOSS/CIS Seminar Room 2-2",
      "SOSS/CIS Seminar Room 3-1",
      "SOSS/CIS Seminar Room 3-3",
      "SOSS/CIS Seminar Room B1-1",
    ],
  },
  {
    building: "SMU Connexion",
    buildingCode: "SMUC",
    facilities: [
      "SMUC Active Learning Classroom 3-1",
      "SMUC Active Learning Classroom 3-2",
      "SMUC Active Learning Classroom 3-3",
      "SMUC Active Learning Classroom 4-1",
      "SMUC Active Learning Classroom 4-2",
      "SMUC Chatterbox 3-1",
      "SMUC Chatterbox 3-2",
      "SMUC Chatterbox 3-3",
      "SMUC Chatterbox 3-4",
      "SMUC Chatterbox 3-5",
      "SMUC Chatterbox 3-6",
      "SMUC Jamming Room",
      "SMUC Meeting Lounge 4-1",
      "SMUC Meeting Pod 4-1",
      "SMUC Meeting Pod 4-2",
      "SMUC Meeting Pod 4-3",
      "SMUC Meeting Pod 4-4",
      "SMUC Meeting Pod 4-5",
      "SMUC Meeting Pod 4-6",
      "SMUC Meeting Pod 4-7",
      "SMUC Study Booth 2-1",
      "SMUC Study Booth 2-2",
      "SMUC Study Booth 3-1",
      "SMUC Study Booth 3-2",
      "SMUC Study Booth 3-3",
      "SMUC Study Booth 3-4",
      "SMUC Study Booth 3-5",
      "SMUC Study Booth 3-6",
      "SMUC Study Booth 3-7",
      "SMUC Study Booth 4-1",
      "SMUC Study Booth 4-10",
      "SMUC Study Booth 4-2",
      "SMUC Study Booth 4-3",
      "SMUC Study Booth 4-4",
      "SMUC Study Booth 4-5",
      "SMUC Study Booth 4-6",
      "SMUC Study Booth 4-7",
      "SMUC Study Booth 4-8",
      "SMUC Study Booth 4-9",
    ],
  },
  {
    building: "Yong Pung How School of Law/Kwa Geok Choo Law Library",
    buildingCode: "YPHSL-KGC",
    facilities: [
      "KGC Meeting Pod 3-01",
      "KGC-4.01-PR",
      "KGC-4.02-PR",
      "KGC-4.03-PR",
      "KGC-4.04-PR",
      "KGC-4.05-PR",
      "KGC-4.06-PR",
      "KGC-4.07-PR",
      "KGC-4.08-PR",
      "KGC-4.09-PR",
      "KGC-4.10-PR",
      "KGC-4.11-PR",
      "KGC-4.12-PR",
      "KGC-4.13-PR",
      "YPHSL Classroom 1-02",
      "YPHSL Classroom B1-09",
      "YPHSL Classroom B1-13",
      "YPHSL Classroom B2-03",
      "YPHSL GSR 2-07",
      "YPHSL GSR 2-12",
      "YPHSL GSR 2-13",
      "YPHSL GSR 2-14",
      "YPHSL GSR 3-03",
      "YPHSL GSR 3-04",
      "YPHSL GSR 3-05",
      "YPHSL GSR 3-06",
      "YPHSL GSR 3-07",
      "YPHSL GSR 3-08",
      "YPHSL GSR B1-02",
      "YPHSL GSR B1-03",
      "YPHSL GSR B1-04",
      "YPHSL GSR B1-05",
      "YPHSL GSR B1-06",
      "YPHSL GSR B1-07",
      "YPHSL GSR B1-08",
      "YPHSL GSR B1-10",
      "YPHSL GSR B1-11",
      "YPHSL GSR B1-12",
      "YPHSL Meeting Pod B1-01",
      "YPHSL Seminar Room 2-01",
      "YPHSL Seminar Room 2-02",
      "YPHSL Seminar Room 2-03",
      "YPHSL Seminar Room 2-04",
      "YPHSL Seminar Room 2-05",
      "YPHSL Seminar Room 2-11",
      "YPHSL Seminar Room 2-15",
      "YPHSL Seminar Room 2-16",
      "YPHSL Seminar Room 3-01",
      "YPHSL Seminar Room 3-02",
      "YPHSL Seminar Room 3-09",
      "YPHSL Seminar Room 3-10",
      "YPHSL Seminar Room 3-11",
      "YPHSL Seminar Room 3-12",
      "YPHSL Seminar Room B1-01",
      "YPHSL Seminar Room B2-01",
    ],
  },
];

function getFacilityCatalog() {
  return BUILDINGS;
}

function buildSeedFacilities({ campusLabel = "SMU" } = {}) {
  const items = [];
  const usedIds = new Set();

  for (const b of BUILDINGS) {
    for (const facilityName of b.facilities) {
      const floor = inferFloorFromName(facilityName);
      const rawType = inferTypeFromName(facilityName);
      const type = normalizeCanonicalType(rawType, { name: facilityName, building: b.building, floor });
      const capacity = inferCapacityFromType(type);

      let id = stableIdForFacilityName(facilityName, { buildingCode: b.buildingCode });
      if (usedIds.has(id)) {
        const h = crypto
          .createHash("sha1")
          .update(`${b.buildingCode}:${facilityName}`)
          .digest("hex")
          .slice(0, 6);
        id = `${id}-${h}`;
      }
      usedIds.add(id);

      items.push({
        id,
        name: facilityName,
        campus: campusLabel,
        building: b.building,
        floor,
        capacity,
        type,
      });
    }
  }

  return items;
}

module.exports = {
  getFacilityCatalog,
  buildSeedFacilities,
  inferTypeFromName,
  inferFloorFromName,
  inferCapacityFromType,
};
