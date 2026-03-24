const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

function resolveDbPath() {
  if (process.env.SQLITE_PATH) return path.resolve(process.env.SQLITE_PATH)
  return path.resolve(__dirname, '..', 'database', 'fbs.sqlite')
}

let db = null

function addColumnIfMissing(database, tableName, columnName, definition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all()
  if (columns.some((column) => column.name === columnName)) return

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

function ensureRuntimeSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS student_credit_balances (
      email TEXT PRIMARY KEY,
      remaining_credits INTEGER NOT NULL DEFAULT 4500,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      user_email TEXT NOT NULL,
      booking_id INTEGER,
      details TEXT,
      timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
    ON audit_logs (timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON audit_logs (action);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email
    ON audit_logs (user_email);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_booking_id
    ON audit_logs (booking_id);

    CREATE INDEX IF NOT EXISTS idx_student_credit_balances_updated_at
    ON student_credit_balances (updated_at DESC);
  `)

  addColumnIfMissing(database, 'bookings', 'booking_role', "TEXT NOT NULL DEFAULT 'student'")
  addColumnIfMissing(database, 'bookings', 'credits_charged', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(database, 'bookings', 'credits_refunded', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(database, 'bookings', 'cost_centre_snapshot', 'TEXT')
}

function getDb() {
  const dbPath = resolveDbPath()
  if (!fs.existsSync(dbPath)) return null
  if (db) return db

  db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  ensureRuntimeSchema(db)
  return db
}

function sqliteHealth() {
  const d = getDb()
  if (!d) return { enabled: false, ok: true }

  try {
    const row = d.prepare('SELECT 1 AS ok').get()
    const res = { enabled: true, ok: row?.ok === 1 }
    if (process.env.NODE_ENV !== 'production') {
      res.path = resolveDbPath()
    }
    return res
  } catch (e) {
    const res = { enabled: true, ok: false, error: e?.message || String(e) }
    if (process.env.NODE_ENV !== 'production') {
      res.path = resolveDbPath()
    }
    return res
  }
}

module.exports = {
  getDb,
  sqliteHealth,
  resolveDbPath,
}
