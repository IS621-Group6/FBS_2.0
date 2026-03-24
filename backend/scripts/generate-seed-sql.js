/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')

const { buildSeedFacilities } = require('../facilityCatalog')
const { EQUIPMENT_POOL, computeEquipmentForFacility } = require('../equipment')
const { hashPasswordSync } = require('../authUtils')

const repoRoot = path.resolve(__dirname, '..', '..')
const outPath = path.join(repoRoot, 'database', 'sqlite', 'seed.sql')

function sqlEscape(value) {
  return String(value).replace(/'/g, "''")
}

function sqlString(value) {
  return `'${sqlEscape(value)}'`
}

function sqlIntOrNull(value) {
  if (value === null || value === undefined) return 'NULL'
  const n = Number(value)
  if (!Number.isFinite(n)) return 'NULL'
  return String(Math.trunc(n))
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => String(a).localeCompare(String(b)))
}

function buildSeedSql() {
  const facilities = buildSeedFacilities({ campusLabel: 'SMU' })
  facilities.sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)))

  const canonicalTypes = [
    'Catering Area',
    'Chatterbox',
    'Classroom',
    'Group Study Room',
    'Hostel Facilities',
    'Meeting Pod',
    'MPH / Sports Hall',
    'Phone Booth',
    'Project Room',
    'Project Room (Level 5)',
    'Seminar Room',
    'SMUC Facilities',
    'Study Booth',
  ]

  const typeNames = uniqSorted([
    ...canonicalTypes,
    ...facilities.map((f) => String(f.type || '').trim()).filter(Boolean),
  ])

  const now = new Date()
  const generatedAt = now.toISOString()

  const lines = []
  lines.push('-- =========================================================')
  lines.push('-- Seed Data (Generated)')
  lines.push('-- =========================================================')
  lines.push(`-- Generated at: ${generatedAt}`)
  lines.push('-- Source of truth: backend/facilityCatalog + backend/equipment rules')
  lines.push('-- Notes:')
  lines.push('-- - Run schema.sql first (this file does not CREATE TABLEs).')
  lines.push('-- - This seed is idempotent (it deletes then re-inserts data).')
  lines.push('')
  lines.push('PRAGMA foreign_keys = ON;')
  lines.push('BEGIN;')
  lines.push('')
  lines.push('-- Clear existing data (order matters for FK constraints)')
  lines.push('DELETE FROM booking_detail;')
  lines.push('DELETE FROM bookings;')
  lines.push('DELETE FROM facility_equipment;')
  lines.push('DELETE FROM equipment;')
  lines.push('DELETE FROM facilities;')
  lines.push('DELETE FROM facility_type;')
  lines.push('DELETE FROM users;')
  lines.push('')

  lines.push('-- Facility types')
  lines.push('INSERT OR IGNORE INTO facility_type (type_name) VALUES')
  for (let i = 0; i < typeNames.length; i++) {
    const suffix = i === typeNames.length - 1 ? ';' : ','
    lines.push(`  (${sqlString(typeNames[i])})${suffix}`)
  }
  lines.push('')

  lines.push('-- Facilities (stable string key is facility_code)')
  lines.push('WITH rows(facility_code, facility_name, building, floor, capacity, type_name) AS (')
  lines.push('  VALUES')
  for (let i = 0; i < facilities.length; i++) {
    const f = facilities[i]
    const typeName = String(f.type || '').trim() || 'Classroom'
    const tuple = [
      sqlString(String(f.id)),
      sqlString(String(f.name)),
      sqlString(String(f.building)),
      sqlIntOrNull(f.floor),
      sqlIntOrNull(Number(f.capacity) || 1),
      sqlString(typeName),
    ].join(', ')
    const suffix = i === facilities.length - 1 ? '' : ','
    lines.push(`    (${tuple})${suffix}`)
  }
  lines.push(')')
  lines.push('INSERT INTO facilities (facility_code, facility_name, building, floor, capacity, facility_type_id, is_active)')
  lines.push('SELECT')
  lines.push('  r.facility_code,')
  lines.push('  r.facility_name,')
  lines.push('  r.building,')
  lines.push('  r.floor,')
  lines.push('  r.capacity,')
  lines.push('  (SELECT ft.facility_type_id FROM facility_type ft WHERE ft.type_name = r.type_name),')
  lines.push('  1')
  lines.push('FROM rows r;')
  lines.push('')

  const equipmentNames = uniqSorted(EQUIPMENT_POOL)
  lines.push('-- Equipment')
  lines.push('INSERT OR IGNORE INTO equipment (name) VALUES')
  for (let i = 0; i < equipmentNames.length; i++) {
    const suffix = i === equipmentNames.length - 1 ? ';' : ','
    lines.push(`  (${sqlString(equipmentNames[i])})${suffix}`)
  }
  lines.push('')

  // Build facility<->equipment links.
  const links = []
  for (const f of facilities) {
    const typeName = String(f.type || '').trim() || 'Classroom'
    const eqList = computeEquipmentForFacility({ facilityName: f.name, facilityType: typeName })
    for (const eqName of eqList) {
      links.push([String(f.id), String(eqName)])
    }
  }

  links.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))

  lines.push('-- Facility ↔ equipment links')
  lines.push('WITH links(facility_code, equipment_name) AS (')
  lines.push('  VALUES')
  for (let i = 0; i < links.length; i++) {
    const [facilityCode, equipmentName] = links[i]
    const tuple = `${sqlString(facilityCode)}, ${sqlString(equipmentName)}`
    const suffix = i === links.length - 1 ? '' : ','
    lines.push(`    (${tuple})${suffix}`)
  }
  lines.push(')')
  lines.push('INSERT OR IGNORE INTO facility_equipment (facility_id, equipment_id)')
  lines.push('SELECT f.facility_id, e.equipment_id')
  lines.push('FROM links l')
  lines.push('JOIN facilities f ON f.facility_code = l.facility_code')
  lines.push('JOIN equipment e ON e.name = l.equipment_name;')
  lines.push('')

  // Demo users/bookings (kept small, deterministic).
  lines.push('-- Demo users')
  lines.push("INSERT OR IGNORE INTO users (user_id, first_name, last_name, email, role, password_hash) VALUES")
  lines.push(`  (1, 'Alicia', 'Tan', 'alicia.tan.2027@smu.edu.sg', 'student', ${sqlString(hashPasswordSync('password'))}),`)
  lines.push(`  (2, 'Brandon', 'Lee', 'brandon.lee.2026@smu.edu.sg', 'student', ${sqlString(hashPasswordSync('password'))}),`)
  lines.push(`  (3, 'Cheryl', 'Lim', 'cheryl.lim.2025@smu.edu.sg', 'student', ${sqlString(hashPasswordSync('password'))}),`)
  lines.push(`  (4, 'Marcus', 'Goh', 'marcus.goh@smu.edu.sg', 'staff', ${sqlString(hashPasswordSync('password'))}),`)
  lines.push(`  (5, 'Priya', 'Nair', 'priya.nair@smu.edu.sg', 'staff', ${sqlString(hashPasswordSync('password'))}),`)
  lines.push(`  (6, 'Rachel', 'Wong', 'rachel.wong@smu.edu.sg', 'admin', ${sqlString(hashPasswordSync('password'))});`)
  lines.push('')

  // Choose 6 deterministic facilities for booking examples (by facility_name).
  const bookingFacilities = facilities.slice(0, 6).map((f) => String(f.id))
  while (bookingFacilities.length < 6) bookingFacilities.push(bookingFacilities[0] || 'UNKNOWN')

  lines.push('-- Demo bookings (explicit booking_id for deterministic seed)')
  lines.push('INSERT OR IGNORE INTO bookings (booking_id, user_id, booking_reason) VALUES')
  lines.push("  (1, 1, 'Group study session'),")
  lines.push("  (2, 2, 'Weekly seminar prep'),")
  lines.push("  (3, 4, 'Guest lecture setup'),")
  lines.push("  (4, 5, 'Project meeting'),")
  lines.push("  (5, 1, 'Workshop');")
  lines.push('')

  lines.push('-- Demo booking slots')
  lines.push('INSERT OR IGNORE INTO booking_detail (booking_id, facility_id, start_time, end_time) VALUES')
  lines.push(
    `  (1, (SELECT facility_id FROM facilities WHERE facility_code = ${sqlString(
      bookingFacilities[0]
    )}), '2026-03-10T09:00:00Z', '2026-03-10T10:30:00Z'),`
  )
  lines.push(
    `  (2, (SELECT facility_id FROM facilities WHERE facility_code = ${sqlString(
      bookingFacilities[1]
    )}), '2026-03-10T11:00:00Z', '2026-03-10T12:00:00Z'),`
  )
  lines.push(
    `  (2, (SELECT facility_id FROM facilities WHERE facility_code = ${sqlString(
      bookingFacilities[1]
    )}), '2026-03-10T12:00:00Z', '2026-03-10T13:00:00Z'),`
  )
  lines.push(
    `  (3, (SELECT facility_id FROM facilities WHERE facility_code = ${sqlString(
      bookingFacilities[2]
    )}), '2026-03-11T08:00:00Z', '2026-03-11T11:00:00Z'),`
  )
  lines.push(
    `  (4, (SELECT facility_id FROM facilities WHERE facility_code = ${sqlString(
      bookingFacilities[3]
    )}), '2026-03-12T17:00:00Z', '2026-03-12T18:30:00Z'),`
  )
  lines.push(
    `  (4, (SELECT facility_id FROM facilities WHERE facility_code = ${sqlString(
      bookingFacilities[4]
    )}), '2026-03-12T18:30:00Z', '2026-03-12T19:30:00Z'),`
  )
  lines.push(
    `  (5, (SELECT facility_id FROM facilities WHERE facility_code = ${sqlString(
      bookingFacilities[5]
    )}), '2026-03-14T10:00:00Z', '2026-03-14T13:00:00Z');`
  )
  lines.push('')

  lines.push('COMMIT;')
  lines.push('')

  return lines.join('\n')
}

const sql = buildSeedSql()
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, sql, 'utf8')

console.log(`Wrote seed SQL: ${outPath}`)