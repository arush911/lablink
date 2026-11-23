import { describe, it, expect } from "vitest";
import { GET as getRecommendations } from "../app/api/v1/requests/[id]/recommendations/route";
import { PATCH as reviewRequest } from "../app/api/v1/requests/[id]/review/route";
import { POST as confirmBooking } from "../app/api/v1/bookings/confirm/route";
import { POST as postRequest } from "../app/api/v1/requests/route";
import { query } from "../lib/db/pool";

describe("Stage 5: Faculty Review Console & Slot Confirmation", () => {
  const TEST_EQUIPMENT_ID = "44444444-4444-4444-4444-444444440001"; // Keysight Oscilloscope
  const STUDENT_DEMO_TOKEN = "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN";
  const FACULTY_DEMO_TOKEN = "Bearer DEMO_TOKEN_FACULTY_MARCUS_VANCE";

  it("AC-SCHED-01: GET /recommendations generates candidate slots with contiguity and preference scoring", async () => {
    // 1. Create a fresh student request docket
    const createReq = new Request("http://localhost:3000/api/v1/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: STUDENT_DEMO_TOKEN,
      },
      body: JSON.stringify({
        equipmentId: TEST_EQUIPMENT_ID,
        projectTitle: "Cryogenic Phase Transition Measurement",
        abstract: "Characterizing micro-crack propagation and lattice resonance using high-frequency acquisition.",
        requestedDurationHours: 2.0,
        projectDeadline: "2026-12-15",
        preferredWindowStart: "2026-12-10T14:00:00Z",
        preferredWindowEnd: "2026-12-10T18:00:00Z",
        hazardousMaterialsDeclared: false,
      }),
    });

    const createRes = await postRequest(createReq);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const requestId = createData.request.id;

    // 2. Fetch candidate slot recommendations as faculty
    const recReq = new Request(
      `http://localhost:3000/api/v1/requests/${requestId}/recommendations`,
      {
        method: "GET",
        headers: {
          Authorization: FACULTY_DEMO_TOKEN,
        },
      }
    );

    const recRes = await getRecommendations(recReq, {
      params: Promise.resolve({ id: requestId }),
    });

    expect(recRes.status).toBe(200);
    const recData = await recRes.json();

    expect(recData.success).toBe(true);
    expect(recData.equipment.name).toContain("Oscilloscope");
    expect(recData.candidateSlots.length).toBeGreaterThan(0);

    const topSlot = recData.candidateSlots[0];
    expect(topSlot).toHaveProperty("startTime");
    expect(topSlot).toHaveProperty("endTime");
    expect(topSlot).toHaveProperty("compositeScore");
    expect(topSlot).toHaveProperty("contiguityScore");
    expect(topSlot).toHaveProperty("preferenceScore");
    expect(topSlot.isRecommended).toBe(true);

    // Verify composite score formula: S_slot = 0.60 * S_contiguity + 0.40 * S_pref
    const expectedScore = Number(
      (0.60 * topSlot.contiguityScore + 0.40 * topSlot.preferenceScore).toFixed(6)
    );
    expect(topSlot.compositeScore).toBeCloseTo(expectedScore, 4);
  });

  it("AC-AUTH-03: Student cannot perform faculty review (RBAC defense)", async () => {
    // Attempt review as student
    const reviewReq = new Request("http://localhost:3000/api/v1/requests/dummy-id/review", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: STUDENT_DEMO_TOKEN,
      },
      body: JSON.stringify({
        action: "APPROVE",
        notes: "Student trying to self-approve",
      }),
    });

    const res = await reviewRequest(reviewReq, {
      params: Promise.resolve({ id: "dummy-id" }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("ROLE_FORBIDDEN");
  });

  it("AC-REV-01: Faculty can approve a pending request docket", async () => {
    // 1. Create a request docket
    const createReq = new Request("http://localhost:3000/api/v1/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: STUDENT_DEMO_TOKEN,
      },
      body: JSON.stringify({
        equipmentId: TEST_EQUIPMENT_ID,
        projectTitle: "Superconductor Microwave Cavity Ringdown",
        abstract: "Measuring Q-factor resonance in niobium-coated cavity under vacuum.",
        requestedDurationHours: 1.5,
        projectDeadline: "2026-12-20",
        hazardousMaterialsDeclared: false,
      }),
    });

    const createRes = await postRequest(createReq);
    const createData = await createRes.json();
    const requestId = createData.request.id;

    // 2. Faculty reviews and approves
    const reviewReq = new Request(
      `http://localhost:3000/api/v1/requests/${requestId}/review`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: FACULTY_DEMO_TOKEN,
        },
        body: JSON.stringify({
          action: "APPROVE",
          notes: "Approved for cavity measurement. Adhere to vacuum interlock protocol.",
        }),
      }
    );

    const reviewRes = await reviewRequest(reviewReq, {
      params: Promise.resolve({ id: requestId }),
    });

    expect(reviewRes.status).toBe(200);
    const reviewData = await reviewRes.json();
    expect(reviewData.success).toBe(true);
    expect(reviewData.newStatus).toBe("APPROVED");

    // Verify in database
    const dbCheck = await query(
      "SELECT status FROM booking_requests WHERE id = $1",
      [requestId]
    );
    expect(dbCheck.rows[0].status).toBe("APPROVED");
  });

  it("AC-REV-02: Faculty can reject a request with mandatory justification", async () => {
    // 1. Create request
    const createReq = new Request("http://localhost:3000/api/v1/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: STUDENT_DEMO_TOKEN,
      },
      body: JSON.stringify({
        equipmentId: TEST_EQUIPMENT_ID,
        projectTitle: "High Power Radiofrequency Laser Blasting",
        abstract: "Overpowering laser without optical attenuation filter.",
        requestedDurationHours: 4.0,
        hazardousMaterialsDeclared: true,
        safetyNotes: "No secondary beam trap available.",
      }),
    });

    const createRes = await postRequest(createReq);
    const createData = await createRes.json();
    const requestId = createData.request.id;

    // 2. Reject without reason -> 400
    const invalidRejectReq = new Request(
      `http://localhost:3000/api/v1/requests/${requestId}/review`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: FACULTY_DEMO_TOKEN,
        },
        body: JSON.stringify({
          action: "REJECT",
        }),
      }
    );

    const invRes = await reviewRequest(invalidRejectReq, {
      params: Promise.resolve({ id: requestId }),
    });
    expect(invRes.status).toBe(400);

    // 3. Reject with valid reason -> 200
    const validRejectReq = new Request(
      `http://localhost:3000/api/v1/requests/${requestId}/review`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: FACULTY_DEMO_TOKEN,
        },
        body: JSON.stringify({
          action: "REJECT",
          rejectionReason: "Safety protocol incomplete: Missing certified optical beam enclosure.",
        }),
      }
    );

    const validRes = await reviewRequest(validRejectReq, {
      params: Promise.resolve({ id: requestId }),
    });
    expect(validRes.status).toBe(200);

    const dbCheck = await query(
      "SELECT status, rejection_reason FROM booking_requests WHERE id = $1",
      [requestId]
    );
    expect(dbCheck.rows[0].status).toBe("REJECTED");
    expect(dbCheck.rows[0].rejection_reason).toContain("Missing certified optical beam enclosure");
  });

  it("AC-BOOK-01: Transactional slot confirmation creates booking and updates quota", async () => {
    // 1. Create request
    const createReq = new Request("http://localhost:3000/api/v1/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: STUDENT_DEMO_TOKEN,
      },
      body: JSON.stringify({
        equipmentId: TEST_EQUIPMENT_ID,
        projectTitle: "Precision Timing Synchronization Test",
        abstract: "Phase noise measurements across sub-nanosecond delay lines.",
        requestedDurationHours: 2.0,
        projectDeadline: "2026-12-30",
        hazardousMaterialsDeclared: false,
      }),
    });

    const createRes = await postRequest(createReq);
    const createData = await createRes.json();
    const requestId = createData.request.id;

    // 2. Approve request
    const reviewReq = new Request(
      `http://localhost:3000/api/v1/requests/${requestId}/review`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: FACULTY_DEMO_TOKEN,
        },
        body: JSON.stringify({
          action: "APPROVE",
          notes: "Approved for precision timing.",
        }),
      }
    );
    await reviewRequest(reviewReq, { params: Promise.resolve({ id: requestId }) });

    // 3. Confirm slot (with dynamically distinct window to avoid colliding with previous test runs)
    await query("UPDATE users SET used_quota_hours = 0.0 WHERE email = 'student.demo@lablink.edu'");
    const randomOffsetMs = Math.floor(Math.random() * 50000000);
    const baseDate = new Date("2026-12-01T08:00:00.000Z").getTime() + randomOffsetMs;
    const slotStart = new Date(baseDate).toISOString();
    const slotEnd = new Date(baseDate + 2 * 3600 * 1000).toISOString();

    const confirmReq = new Request("http://localhost:3000/api/v1/bookings/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: FACULTY_DEMO_TOKEN,
      },
      body: JSON.stringify({
        requestId,
        startTime: slotStart,
        endTime: slotEnd,
      }),
    });

    const confirmRes = await confirmBooking(confirmReq);
    expect(confirmRes.status).toBe(200);
    const confirmData = await confirmRes.json();

    expect(confirmData.success).toBe(true);
    expect(confirmData.booking.status).toBe("CONFIRMED");
    expect(confirmData.booking.referenceId).toMatch(/^BKG-\d{8}-\d{4}$/);
    expect(confirmData.quota.usedHours).toBeGreaterThanOrEqual(2.0);

    // 4. Duplicate confirmation attempt must be rejected with 409
    const dupReq = new Request("http://localhost:3000/api/v1/bookings/confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: FACULTY_DEMO_TOKEN,
      },
      body: JSON.stringify({
        requestId,
        startTime: "2026-12-28T14:00:00.000Z",
        endTime: "2026-12-28T16:00:00.000Z",
      }),
    });

    const dupRes = await confirmBooking(dupReq);
    expect(dupRes.status).toBe(409);
    const dupData = await dupRes.json();
    expect(dupData.code).toBe("REQUEST_ALREADY_PROCESSED");
  });
});
