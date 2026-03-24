const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

function resolveDbPath() {
  if (process.env.SQLITE_PATH) return path.resolve(process.env.SQLITE_PATH)
  return path.resolve(__dirname, '..', 'database', 'fbs.sqlite')
}

let db = null

function getDb() {
  const dbPath = resolveDbPath()
  if (!fs.existsSync(dbPath)) return null
  if (db) return db

  db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
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
