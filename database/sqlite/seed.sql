-- =========================================================
-- Seed Data
-- =========================================================

PRAGMA foreign_keys = ON;

-- Facility types
INSERT INTO facility_type (type_name)
VALUES ('Study Room'), ('Seminar Room'), ('Badminton Court');

-- Facilities
-- Note: current app/backend expects a stable string key (`facility_code`) for URLs.
-- We keep your original names, and use a code-friendly version for `facility_code`.
INSERT INTO facilities (facility_code, facility_name, building, floor, capacity, facility_type_id)
VALUES
('SR-01', 'SR-01', 'SIS', 2, 6, 1),
('SR-02', 'SR-02', 'SIS', 2, 8, 1),
('SEMINAR-3A', 'Seminar-3A', 'SOE', 3, 30, 2),
('COURT-A', 'Court A', 'Sports Hall', 1, 4, 3),
('COURT-B', 'Court B', 'Sports Hall', 1, 4, 3);

-- Users
INSERT INTO users (first_name, last_name, email)
VALUES
('Alvin', 'C', 'alvin@example.com'),
('Ben', 'Tan', 'ben@example.com');

-- Booking headers
INSERT INTO bookings (user_id)
VALUES (1), (2);

-- Booking slots
INSERT INTO booking_detail (booking_id, facility_id, start_time, end_time)
VALUES
(1, 1, '2026-02-19 10:00:00', '2026-02-19 10:30:00'),
(1, 1, '2026-02-19 10:30:00', '2026-02-19 11:00:00'),
(2, 4, '2026-02-19 14:00:00', '2026-02-19 15:00:00');
