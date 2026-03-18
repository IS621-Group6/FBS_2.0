-- =========================================================
-- Seed Data
-- =========================================================

PRAGMA foreign_keys = ON;

-- Facility types
INSERT INTO facility_type (type_name)
VALUES
  ('Study Room'),
  ('Seminar Room'),
  ('Lecture Theatre'),
  ('Computer Lab'),
  ('Sports Hall'),
  ('Meeting Room');

-- Facilities
-- NOTE: the app expects a stable string key (`facility_code`) that can be safely used in URLs.
-- We also provide realistic locations, capacities, and a mix of room types.
INSERT INTO facilities (facility_code, facility_name, building, floor, capacity, facility_type_id)
VALUES
  ('STUDY-01', 'Study Room 1', 'Library', 2, 6, 1),
  ('STUDY-02', 'Study Room 2', 'Library', 2, 8, 1),
  ('SEMINAR-01', 'Seminar Room 1', 'SOE', 3, 30, 2),
  ('SEMINAR-02', 'Seminar Room 2', 'SOE', 4, 28, 2),
  ('LECT-01', 'Lecture Theatre 1', 'SIS', 1, 120, 3),
  ('LAB-01', 'Computer Lab 1', 'Tech Hub', 1, 40, 4),
  ('LAB-02', 'Computer Lab 2', 'Tech Hub', 2, 32, 4),
  ('SPORTS-HALL', 'Sports Hall', 'Sports Complex', 1, 200, 5),
  ('COURT-A', 'Badminton Court A', 'Sports Complex', 1, 4, 5),
  ('COURT-B', 'Badminton Court B', 'Sports Complex', 1, 4, 5),
  ('MEET-01', 'Meeting Room A', 'Business School', 3, 12, 6),
  ('MEET-02', 'Meeting Room B', 'Business School', 3, 10, 6);

-- Users (students/staff/guest) to reflect different booking scenarios.
INSERT INTO users (first_name, last_name, email)
VALUES
  ('Alvin', 'C', 'alvin@example.com'),
  ('Ben', 'Tan', 'ben@example.com'),
  ('Claire', 'Lim', 'claire@smu.edu.sg'),
  ('Devon', 'Lee', 'devon@smu.edu.sg'),
  ('Guest', 'User', 'guest@smu.edu.sg');

-- Booking records with realistic date/time patterns.
-- Booking dates span a few days and include overlapping slots, multi-hour bookings, and different users.
INSERT INTO bookings (user_id, booking_reason)
VALUES
  (1, 'Group study session'),
  (2, 'Weekly seminar prep'),
  (3, 'Guest lecture setup'),
  (4, 'Project meeting'),
  (1, 'Lab workshop');

INSERT INTO booking_detail (booking_id, facility_id, start_time, end_time)
VALUES
  -- Alvin: 90-minute study room block on a weekday
  (1, 1, '2026-03-10T09:00:00Z', '2026-03-10T10:30:00Z'),

  -- Ben: back-to-back seminar sessions on same day
  (2, 3, '2026-03-10T11:00:00Z', '2026-03-10T12:00:00Z'),
  (2, 3, '2026-03-10T12:00:00Z', '2026-03-10T13:00:00Z'),

  -- Claire: lecture theatre all morning
  (3, 5, '2026-03-11T08:00:00Z', '2026-03-11T11:00:00Z'),

  -- Devon: evening meeting across two rooms (simulating multi-room booking)
  (4, 11, '2026-03-12T17:00:00Z', '2026-03-12T18:30:00Z'),
  (4, 12, '2026-03-12T18:30:00Z', '2026-03-12T19:30:00Z'),

  -- Alvin: weekend lab workshop
  (5, 6, '2026-03-14T10:00:00Z', '2026-03-14T13:00:00Z');
