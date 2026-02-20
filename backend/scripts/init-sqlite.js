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
  // Simple splitter that works for our files (no semicolons inside strings).
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const tx = db.transaction(() => {
    for (const stmt of statements) db.exec(stmt + ';')
  })
  tx()
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

const db = new Database(dbPath)
try {
  db.pragma('foreign_keys = ON')
  execSql(db, readSql(schemaPath))
  execSql(db, readSql(seedPath))

  const { c: facilities } = db.prepare('SELECT COUNT(*) AS c FROM facilities').get()
  const { c: bookings } = db.prepare('SELECT COUNT(*) AS c FROM bookings').get()

  console.log(`SQLite DB created: ${dbPath}`)
  console.log(`Seeded facilities: ${facilities}, bookings: ${bookings}`)
} finally {
  db.close()
}
