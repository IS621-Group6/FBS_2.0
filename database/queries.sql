-- =========================================================
-- Example Queries
-- =========================================================

-- Search facilities
SELECT f.facility_id, f.facility_name, ft.type_name, f.building, f.floor, f.capacity
FROM facilities f
LEFT JOIN facility_type ft ON ft.facility_type_id = f.facility_type_id
WHERE f.is_active = TRUE
  AND (f.facility_name LIKE '%SR%' OR f.building LIKE '%SIS%');

-- Check if a slot is full (overlap check)
SELECT *
FROM booking_detail
WHERE facility_id = 1
  AND start_time < '2026-02-19 10:30:00'
  AND end_time   > '2026-02-19 10:00:00';

-- List booked slots for a facility
SELECT bd.start_time, bd.end_time, b.booking_id
FROM booking_detail bd
JOIN bookings b ON b.booking_id = bd.booking_id
WHERE bd.facility_id = 1
ORDER BY bd.start_time;