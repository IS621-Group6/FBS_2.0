const { CANONICAL_EQUIPMENT, computeEquipmentForFacility } = require('./equipmentRules')

// Back-compat export name. In DB mode, equipment is read from SQLite; in
// in-memory mode we use authoritative rules based on name/type.
function equipmentForFacilityCode(code) {
  void code
  return []
}

module.exports = {
  EQUIPMENT_POOL: CANONICAL_EQUIPMENT,
  equipmentForFacilityCode,
  computeEquipmentForFacility,
};
