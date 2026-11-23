import { describe, it, expect } from "vitest";
import { query } from "../lib/db/pool";

describe("AC-CONCUR-01: PostgreSQL GiST Exclusion Constraint Concurrency Defense", () => {
  const TEST_EQUIPMENT_ID = "44444444-4444-4444-4444-444444440001"; // Keysight Oscilloscope
  const TEST_STUDENT_ID = "11111111-1111-1111-1111-111111111111"; // Alex Chen
  const TEST_FACULTY_ID = "22222222-2222-2222-2222-222222222222"; // Marcus Vance

  it("must allow exactly 1 confirmed booking and reject 50 concurrent overlapping attempts with SQLSTATE 23P01", async () => {
    // 1. Create a dummy parent request first
    const reqRes = await query(`
      INSERT INTO booking_requests (
        docket_number, student_id, equipment_id, faculty_id, status, requested_duration_hours
      ) VALUES (
        'TEST-DOCKET-GIST-01', $1, $2, $3, 'APPROVED', 2.0
      ) RETURNING id;
    `, [TEST_STUDENT_ID, TEST_EQUIPMENT_ID, TEST_FACULTY_ID]);
    const requestId = reqRes.rows[0].id;

    // 2. Commit the initial confirmed booking
    const start = "2026-12-10 10:00:00+00";
    const end = "2026-12-10 12:00:00+00";

    const initialBooking = await query(`
      INSERT INTO bookings (
        reference_id, equipment_id, student_id, confirmed_by_faculty_id, booking_request_id,
        start_time, end_time, status
      ) VALUES (
        'RES-GIST-SEED', $1, $2, $3, $4, $5, $6, 'CONFIRMED'
      ) RETURNING id, time_range;
    `, [TEST_EQUIPMENT_ID, TEST_STUDENT_ID, TEST_FACULTY_ID, requestId, start, end]);

    expect(initialBooking.rows.length).toBe(1);
    expect(initialBooking.rows[0].time_range).toBeDefined();

    // 3. Fire 50 concurrent overlapping booking attempts
    const concurrentAttempts = 50;
    const promises = Array.from({ length: concurrentAttempts }, (_, i) => {
      // Overlapping intervals: e.g. 10:30 to 12:30 or 11:00 to 13:00
      const overlapStart = "2026-12-10 10:30:00+00";
      const overlapEnd = "2026-12-10 12:30:00+00";
      const refId = `RES-GIST-ATTEMPT-${i}`;

      return query(`
        INSERT INTO bookings (
          reference_id, equipment_id, student_id, confirmed_by_faculty_id, booking_request_id,
          start_time, end_time, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'CONFIRMED'
        );
      `, [refId, TEST_EQUIPMENT_ID, TEST_STUDENT_ID, TEST_FACULTY_ID, requestId, overlapStart, overlapEnd])
        .then(() => ({ success: true, code: null }))
        .catch((err) => ({ success: false, code: err.code }));
    });

    const results = await Promise.all(promises);

    const successCount = results.filter((r) => r.success).length;
    const conflictCount = results.filter((r) => !r.success && r.code === "23P01").length;

    // Exactly 0 overlapping bookings should succeed, all 50 should fail with 23P01 (exclusion_violation)
    expect(successCount).toBe(0);
    expect(conflictCount).toBe(concurrentAttempts);

    // Clean up test records
    await query("DELETE FROM bookings WHERE booking_request_id = $1;", [requestId]);
    await query("DELETE FROM booking_requests WHERE id = $1;", [requestId]);
  });
});
