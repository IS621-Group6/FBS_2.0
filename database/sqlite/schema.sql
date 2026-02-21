-- SQLite schema for Facility Booking System
-- Note: This is a SQLite-compatible equivalent of database/schema.sql

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS booking_detail;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS facilities;
DROP TABLE IF EXISTS facility_type;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  lockout_until TEXT
);

-- Server-managed sessions (opaque token stored hashed).
-- last_activity is used to implement idle timeout.
CREATE TABLE sessions (
  session_token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  last_activity TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
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

-- NOTE ON TIMEZONES:
-- All timestamps in this schema are stored in UTC, encoded as ISO 8601 strings.
-- booking_date uses an explicit UTC "Z" suffix (e.g. 2026-02-20T10:00:00Z).
CREATE TABLE bookings (
  booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  booking_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  status TEXT DEFAULT 'CONFIRMED',
  booking_reason TEXT,
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
