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
    return { enabled: true, ok: row?.ok === 1, path: resolveDbPath() }
  } catch (e) {
    return { enabled: true, ok: false, path: resolveDbPath(), error: e?.message || String(e) }
  }
}

module.exports = {
  getDb,
  sqliteHealth,
  resolveDbPath,
}
