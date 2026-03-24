const { buildSeedFacilities } = require("./facilityCatalog");
const { computeEquipmentForFacility } = require("./equipment");

const SINGLE_CAMPUS_LABEL = "SMU";

function facilityTypeForCapacity(capacity) {
  const c = Number(capacity) || 0;
  if (c <= 1) return "Phone Booth";
  if (c <= 2) return "Study Booth";
  if (c <= 4) return "Meeting Pod";
  if (c <= 8) return "Group Study Room";
  if (c <= 16) return "Seminar Room";
  return "Classroom";
}

function makeFacilities() {
  const base = buildSeedFacilities({ campusLabel: SINGLE_CAMPUS_LABEL });
  return base.map((facility) => ({
    ...facility,
    equipment: computeEquipmentForFacility({
      facilityName: facility.name,
      facilityType: facility.type,
    }),
  }));
}

const FACILITIES = makeFacilities();

module.exports = {
  FACILITIES,
  SINGLE_CAMPUS_LABEL,
  facilityTypeForCapacity,
};