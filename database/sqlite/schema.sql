-- SQLite schema for Facility Booking System
-- Note: This is a SQLite-compatible equivalent of database/schema.sql

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS student_credit_balances;
DROP TABLE IF EXISTS booking_detail;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS facility_equipment;
DROP TABLE IF EXISTS equipment;
DROP TABLE IF EXISTS facilities;
DROP TABLE IF EXISTS facility_type;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'student',
  password_hash TEXT NOT NULL
);

CREATE TABLE facility_type (
  facility_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type_name TEXT NOT NULL UNIQUE
);

CREATE TABLE facilities (
  facility_id INTEGER PRIMARY KEY AUTOINCREMENT,
  facility_code TEXT NOT NULL UNIQUE,
  facility_name TEXT NOT NULL,
  building TEXT NOT NULL,
  floor INTEGER,
  capacity INTEGER NOT NULL DEFAULT 1,
  facility_type_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (facility_type_id) REFERENCES facility_type(facility_type_id)
);

CREATE TABLE equipment (
  equipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE facility_equipment (
  facility_id INTEGER NOT NULL,
  equipment_id INTEGER NOT NULL,
  PRIMARY KEY (facility_id, equipment_id),
  FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE,
  FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE CASCADE
);

-- NOTE ON TIMEZONES:
-- All timestamps in this schema are stored in UTC, encoded as ISO 8601 strings.
-- booking_date uses an explicit UTC "Z" suffix (e.g. 2026-02-20T10:00:00Z).
CREATE TABLE bookings (
  booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  booking_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  status TEXT DEFAULT 'CONFIRMED',
  booking_role TEXT NOT NULL DEFAULT 'student',
  booking_reason TEXT,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  credits_refunded INTEGER NOT NULL DEFAULT 0,
  cost_centre_snapshot TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- start_time and end_time are also expected to be UTC ISO 8601 strings.
CREATE TABLE booking_detail (
  booking_id INTEGER NOT NULL,
  facility_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  CHECK (end_time > start_time),
  PRIMARY KEY (booking_id, facility_id, start_time),
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE
);

CREATE INDEX idx_booking_detail_facility_time
  ON booking_detail (facility_id, start_time, end_time);
  
CREATE INDEX IF NOT EXISTS idx_facility_name
ON facilities (facility_name);

CREATE INDEX IF NOT EXISTS idx_facility_building
ON facilities (building);

CREATE INDEX IF NOT EXISTS idx_facility_capacity
ON facilities (capacity);

CREATE INDEX IF NOT EXISTS idx_facility_equipment_equipment
ON facility_equipment (equipment_id);

CREATE INDEX IF NOT EXISTS idx_facility_equipment_facility
ON facility_equipment (facility_id);

CREATE TABLE student_credit_balances (
  email TEXT PRIMARY KEY,
  remaining_credits INTEGER NOT NULL DEFAULT 4500,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_student_credit_balances_updated_at
ON student_credit_balances (updated_at DESC);

CREATE TABLE audit_logs (
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