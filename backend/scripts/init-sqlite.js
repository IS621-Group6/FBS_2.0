/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const repoRoot = path.resolve(__dirname, '..', '..')

const dbPath = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(repoRoot, 'database', 'fbs.sqlite')

const schemaPath = path.join(repoRoot, 'database', 'sqlite', 'schema.sql')
const seedPath = path.join(repoRoot, 'database', 'sqlite', 'seed.sql')

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

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

const db = new Database(dbPath)
try {
  db.pragma('foreign_keys = ON')

  console.log('Initializing SQLite schema...')
  execSql(db, readSql(schemaPath))

  console.log('Seeding demo data...')
  execSql(db, readSql(seedPath))

  const [{ c: facilityTypes }] = db.prepare('SELECT COUNT(*) AS c FROM facility_type').all()
  const [{ c: facilities }] = db.prepare('SELECT COUNT(*) AS c FROM facilities').all()
  const [{ c: users }] = db.prepare('SELECT COUNT(*) AS c FROM users').all()
  const [{ c: bookings }] = db.prepare('SELECT COUNT(*) AS c FROM bookings').all()
  const [{ c: bookingSlots }] = db.prepare('SELECT COUNT(*) AS c FROM booking_detail').all()

  console.log(`SQLite DB created: ${dbPath}`)
  console.log(`Seeded: ${facilityTypes} facility types, ${facilities} facilities, ${users} users, ${bookings} bookings, ${bookingSlots} booking slots.`)
} catch (err) {
  console.error('Failed to create or seed SQLite DB:', err)
  process.exitCode = 1
} finally {
  db.close()
}
