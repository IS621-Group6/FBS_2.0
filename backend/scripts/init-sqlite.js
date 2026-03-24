/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const { buildSeedFacilities } = require('../facilityCatalog')
const { EQUIPMENT_POOL, computeEquipmentForFacility } = require('../equipment')
const { hashPasswordSync } = require('../authUtils')

const repoRoot = path.resolve(__dirname, '..', '..')

const dbPath = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(repoRoot, 'database', 'fbs.sqlite')

const schemaPath = path.join(repoRoot, 'database', 'sqlite', 'schema.sql')

function readSql(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function execSql(db, sql) {
  // Execute the full SQL script in a single transaction.
  const tx = db.transaction(() => {
    db.exec(sql)
  })
  tx()
}

function seedFacilities(db) {
  const facilities = buildSeedFacilities({ campusLabel: 'SMU' })
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

  const insertType = db.prepare('INSERT OR IGNORE INTO facility_type (type_name) VALUES (?)')
  const getTypeId = db.prepare('SELECT facility_type_id AS id FROM facility_type WHERE type_name = ?')

  for (const t of canonicalTypes) insertType.run(t)
  for (const f of facilities) {
    const typeName = String(f.type || '').trim()
    if (typeName) insertType.run(typeName)
  }

  const typeIdByName = new Map()
  for (const row of db.prepare('SELECT facility_type_id AS id, type_name AS name FROM facility_type').all()) {
    typeIdByName.set(row.name, row.id)
  }

  const insertFacility = db.prepare(
    `INSERT INTO facilities (facility_code, facility_name, building, floor, capacity, facility_type_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  )

  const tx = db.transaction(() => {
    for (const f of facilities) {
      const typeName = String(f.type || '').trim() || 'Classroom'
      const typeId = typeIdByName.get(typeName) || getTypeId.get('Classroom')?.id || null
      insertFacility.run(
        String(f.id),
        String(f.name),
        String(f.building),
        Number.isFinite(f.floor) ? f.floor : null,
        Number(f.capacity) || 1,
        typeId
      )
    }
  })
  tx()

  return { facilitiesCount: facilities.length, typesCount: typeIdByName.size }
}

function seedEquipment(db) {
  const insertEquipment = db.prepare('INSERT OR IGNORE INTO equipment (name) VALUES (?)')
  for (const name of EQUIPMENT_POOL) insertEquipment.run(name)

  const equipmentByName = new Map()
  for (const row of db.prepare('SELECT equipment_id AS id, name FROM equipment').all()) {
    equipmentByName.set(row.name, row.id)
  }

  // Clear any previous links (idempotent seeding).
  db.prepare('DELETE FROM facility_equipment').run()

  const facilityRows = db
    .prepare(
      `SELECT f.facility_id AS id,
              f.facility_code AS code,
              f.facility_name AS name,
              ft.type_name AS type
       FROM facilities f
       LEFT JOIN facility_type ft ON ft.facility_type_id = f.facility_type_id
       WHERE f.is_active = 1`
    )
    .all()

  const insertLink = db.prepare(
    'INSERT OR IGNORE INTO facility_equipment (facility_id, equipment_id) VALUES (?, ?)'
  )

  const tx = db.transaction(() => {
    for (const f of facilityRows) {
      const eqList = computeEquipmentForFacility({ facilityName: f.name, facilityType: f.type })
      for (const eqName of eqList) {
        const eqId = equipmentByName.get(eqName)
        if (!eqId) continue
        insertLink.run(Number(f.id), eqId)
      }
    }
  })
  tx()

  const [{ c: links }] = db.prepare('SELECT COUNT(*) AS c FROM facility_equipment').all()
  return { equipmentCount: equipmentByName.size, links }
}

function seedUsersAndBookings(db) {
  function pad2(n) {
    return String(n).padStart(2, '0')
  }

  function ymdLocal(d) {
    const yyyy = d.getFullYear()
    const mm = pad2(d.getMonth() + 1)
    const dd = pad2(d.getDate())
    return `${yyyy}-${mm}-${dd}`
  }

  function addDaysYmd(baseDate, deltaDays) {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + Number(deltaDays || 0))
    return ymdLocal(d)
  }

  // Keep timestamp encoding consistent with backend/index.js availability logic.
  // Store UTC ISO 8601 strings with a "Z" suffix.
  function toIsoUtcFromDateAndMinutes(dateYmd, minutesFromMidnight) {
    const raw = String(dateYmd || '').trim()
    const m = raw.match(/^\d{4}-\d{2}-\d{2}$/)
    if (!m) return null
    const [yy, mm, dd] = raw.split('-').map((x) => Number(x))
    if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null
    const mins = Number(minutesFromMidnight)
    if (!Number.isFinite(mins)) return null
    const base = Date.UTC(yy, mm - 1, dd, 0, 0, 0)
    const dt = new Date(base + mins * 60 * 1000)
    const Y = dt.getUTCFullYear()
    const M = pad2(dt.getUTCMonth() + 1)
    const D = pad2(dt.getUTCDate())
    const H = pad2(dt.getUTCHours())
    const Min = pad2(dt.getUTCMinutes())
    return `${Y}-${M}-${D}T${H}:${Min}:00Z`
  }

  function isoUtcAt(dateYmd, hhmm) {
    const [h, m] = String(hhmm).split(':').map((x) => Number(x))
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    return toIsoUtcFromDateAndMinutes(dateYmd, h * 60 + m)
  }

  // Users
  const insertUser = db.prepare(
    'INSERT INTO users (first_name, last_name, email, role, password_hash) VALUES (?, ?, ?, ?, ?)'
  )
  const users = [
    ['Alicia', 'Tan', 'alicia.tan.2027@smu.edu.sg', 'student', hashPasswordSync('password')],
    ['Brandon', 'Lee', 'brandon.lee.2026@smu.edu.sg', 'student', hashPasswordSync('password')],
    ['Cheryl', 'Lim', 'cheryl.lim.2025@smu.edu.sg', 'student', hashPasswordSync('password')],
    ['Marcus', 'Goh', 'marcus.goh@smu.edu.sg', 'staff', hashPasswordSync('password')],
    ['Priya', 'Nair', 'priya.nair@smu.edu.sg', 'staff', hashPasswordSync('password')],
    ['Rachel', 'Wong', 'rachel.wong@smu.edu.sg', 'admin', hashPasswordSync('password')],
  ]

  const txUsers = db.transaction(() => {
    for (const u of users) insertUser.run(...u)
  })
  txUsers()

  // Pick a variety of facilities for demo bookings.
  // Prefer spread across buildings (one per building), then fill in with more rooms.
  const byBuilding = db
    .prepare(
      `SELECT MIN(f.facility_id) AS id
       FROM facilities f
       WHERE f.is_active = 1
       GROUP BY f.building
       ORDER BY f.building ASC
       LIMIT 12`
    )
    .all()
    .map((r) => Number(r.id))
    .filter((n) => Number.isFinite(n) && n > 0)

  const filler = db
    .prepare(
      `SELECT facility_id AS id
       FROM facilities
       WHERE is_active = 1
       ORDER BY facility_id ASC
       LIMIT 60`
    )
    .all()
    .map((r) => Number(r.id))
    .filter((n) => Number.isFinite(n) && n > 0)

  const facilityIds = Array.from(new Set([...byBuilding, ...filler])).slice(0, 18)
  const pickFacility = (idx) => facilityIds[idx % facilityIds.length]

  const userIdByEmail = new Map(
    db
      .prepare('SELECT user_id AS id, lower(email) AS email FROM users')
      .all()
      .map((r) => [String(r.email), Number(r.id)])
  )

  const aliciaUserId = userIdByEmail.get('alicia.tan.2027@smu.edu.sg')
  const brandonUserId = userIdByEmail.get('brandon.lee.2026@smu.edu.sg')
  const marcusUserId = userIdByEmail.get('marcus.goh@smu.edu.sg')
  const priyaUserId = userIdByEmail.get('priya.nair@smu.edu.sg')
  const fallbackUserId = aliciaUserId || brandonUserId || 1

  const insertBooking = db.prepare('INSERT INTO bookings (user_id, booking_reason, status) VALUES (?, ?, ?)')
  const insertDetail = db.prepare(
    'INSERT INTO booking_detail (booking_id, facility_id, start_time, end_time) VALUES (?, ?, ?, ?)'
  )

  // Seed bookings around today so demos always show activity, plus two past/inactive examples.
  const todayLocal = new Date()
  const todayYmd = ymdLocal(todayLocal)

  const bookingSpecs = [
    // Two inactive (past) demo bookings for the demo account.
    {
      userId: fallbackUserId,
      reason: 'Demo (past): Completed booking',
      status: 'COMPLETED',
      dateYmd: addDaysYmd(todayLocal, -10),
      facilityIdx: 6,
      start: '09:00',
      end: '10:00',
    },
    {
      userId: fallbackUserId,
      reason: 'Demo (past): Cancelled booking',
      status: 'CANCELLED',
      dateYmd: addDaysYmd(todayLocal, -2),
      facilityIdx: 7,
      start: '14:00',
      end: '15:30',
    },

    // Active bookings for a variety of rooms/times/dates.
    {
      userId: fallbackUserId,
      reason: 'Demo: Morning group study',
      status: 'CONFIRMED',
      dateYmd: todayYmd,
      facilityIdx: 0,
      start: '08:30',
      end: '10:00',
    },
    {
      userId: fallbackUserId,
      reason: 'Demo: Lunch meeting',
      status: 'CONFIRMED',
      dateYmd: todayYmd,
      facilityIdx: 1,
      start: '12:00',
      end: '13:00',
    },
    {
      userId: fallbackUserId,
      reason: 'Demo: Evening project sync',
      status: 'CONFIRMED',
      dateYmd: addDaysYmd(todayLocal, 1),
      facilityIdx: 2,
      start: '18:00',
      end: '19:30',
    },
    {
      userId: fallbackUserId,
      reason: 'Demo: Study block',
      status: 'CONFIRMED',
      dateYmd: addDaysYmd(todayLocal, 3),
      facilityIdx: 3,
      start: '10:00',
      end: '12:30',
    },
    {
      userId: fallbackUserId,
      reason: 'Demo: Late afternoon seminar prep',
      status: 'CONFIRMED',
      dateYmd: addDaysYmd(todayLocal, 8),
      facilityIdx: 4,
      start: '15:00',
      end: '17:00',
    },
    {
      userId: fallbackUserId,
      reason: 'Demo: Next-month planning session',
      status: 'CONFIRMED',
      dateYmd: addDaysYmd(todayLocal, 14),
      facilityIdx: 5,
      start: '09:30',
      end: '11:00',
    },

    // A couple of non-demo-user bookings so the dataset feels real.
    {
      userId: marcusUserId || fallbackUserId,
      reason: 'Guest lecture setup',
      status: 'CONFIRMED',
      dateYmd: addDaysYmd(todayLocal, 1),
      facilityIdx: 8,
      start: '08:00',
      end: '10:30',
    },
    {
      userId: priyaUserId || fallbackUserId,
      reason: 'Team workshop',
      status: 'CONFIRMED',
      dateYmd: addDaysYmd(todayLocal, 2),
      facilityIdx: 9,
      start: '13:30',
      end: '15:00',
    },
  ]

  const txDetails = db.transaction(() => {
    for (const spec of bookingSpecs) {
      const bookingId = insertBooking.run(spec.userId, spec.reason, spec.status).lastInsertRowid
      const facilityId = pickFacility(spec.facilityIdx)
      insertDetail.run(
        bookingId,
        facilityId,
        isoUtcAt(spec.dateYmd, spec.start),
        isoUtcAt(spec.dateYmd, spec.end)
      )
    }
  })
  txDetails()
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

const db = new Database(dbPath)
try {
  db.pragma('foreign_keys = ON')

  console.log('Initializing SQLite schema...')
  execSql(db, readSql(schemaPath))

  console.log('Seeding facility catalog into SQLite...')
  const seeded = seedFacilities(db)

  console.log('Seeding equipment into SQLite...')
  const eqSeeded = seedEquipment(db)

  console.log('Seeding demo users/bookings...')
  seedUsersAndBookings(db)

  const [{ c: facilityTypes }] = db.prepare('SELECT COUNT(*) AS c FROM facility_type').all()
  const [{ c: facilities }] = db.prepare('SELECT COUNT(*) AS c FROM facilities').all()
  const [{ c: equipment }] = db.prepare('SELECT COUNT(*) AS c FROM equipment').all()
  const [{ c: facilityEquipment }] = db.prepare('SELECT COUNT(*) AS c FROM facility_equipment').all()
  const [{ c: users }] = db.prepare('SELECT COUNT(*) AS c FROM users').all()
  const [{ c: bookings }] = db.prepare('SELECT COUNT(*) AS c FROM bookings').all()
  const [{ c: bookingSlots }] = db.prepare('SELECT COUNT(*) AS c FROM booking_detail').all()

  console.log(`SQLite DB created: ${dbPath}`)
  console.log(
    `Seeded: ${facilityTypes} facility types, ${facilities} facilities, ${equipment} equipment, ${facilityEquipment} facility-equipment links, ${users} users, ${bookings} bookings, ${bookingSlots} booking slots.`
  )
  console.log(`Catalog seed source: ${seeded.facilitiesCount} facilities (inferred)`)
  console.log(`Equipment seed source: ${eqSeeded.equipmentCount} equipment, ${eqSeeded.links} links`)
} catch (err) {
  console.error('Failed to create or seed SQLite DB:', err)
  process.exitCode = 1
} finally {
  db.close()
}
