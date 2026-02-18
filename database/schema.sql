-- =========================================================
-- Facility Booking System - Schema
-- =========================================================

DROP TABLE IF EXISTS booking_detail;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS facilities;
DROP TABLE IF EXISTS facility_type;
DROP TABLE IF EXISTS users;

-- USERS
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE
);

-- FACILITY TYPE
CREATE TABLE facility_type (
  facility_type_id SERIAL PRIMARY KEY,
  type_name VARCHAR(100) NOT NULL UNIQUE
);

-- FACILITIES
CREATE TABLE facilities (
  facility_id SERIAL PRIMARY KEY,
  facility_name VARCHAR(150) NOT NULL,
  building VARCHAR(100) NOT NULL,
  floor INT,
  capacity INT NOT NULL DEFAULT 1,
  facility_type_id INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (facility_type_id) REFERENCES facility_type(facility_type_id)
);

-- BOOKINGS (header)
CREATE TABLE bookings (
  booking_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'CONFIRMED',
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- BOOKING DETAIL (slots)
CREATE TABLE booking_detail (
  booking_id INT NOT NULL,
  facility_id INT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  PRIMARY KEY (booking_id, facility_id, start_time),
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
  FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE
);