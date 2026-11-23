import { Client } from "pg";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PG_HOST = process.env.PGHOST || "localhost";
const PG_PORT = parseInt(process.env.PGPORT || "5432", 10);
const PG_USER = process.env.PGUSER || "postgres";
const PG_PASSWORD = process.env.PGPASSWORD || "postgres";

interface StepResult {
  step: number;
  title: string;
  success: boolean;
  details: string;
  data?: unknown;
}

const results: StepResult[] = [];

function recordStep(step: number, title: string, success: boolean, details: string, data?: unknown) {
  results.push({ step, title, success, details, data });
  const statusEmoji = success ? "✅ PASS" : "❌ FAIL";
  console.log(`\n[STEP ${step.toString().padStart(2, "0")}] ${statusEmoji} - ${title}`);
  console.log(`  Details: ${details}`);
  if (!success) {
    throw new Error(`Step ${step} failed: ${details}`);
  }
}

function extractCookie(response: Response, cookieName: string): string | null {
  const setCookies: string[] = typeof (response.headers as any).getSetCookie === "function" 
    ? (response.headers as any).getSetCookie() 
    : [response.headers.get("set-cookie") || ""];
  
  for (const str of setCookies) {
    if (!str) continue;
    const match = str.match(new RegExp(`${cookieName}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

async function runE2E() {
  console.log("================================================================================");
  console.log("LABLINK 2026 - COMPLETE 16-STEP END-TO-END WORKFLOW VERIFICATION");
  console.log("Target Base URL:", BASE_URL);
  console.log("================================================================================\n");

  const pgClient = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: "lablink",
  });
  await pgClient.connect();

  let studentCookie = "";
  let facultyCookie = "";
  let createdRequestId = "";
  let confirmedBookingId = "";
  let confirmedSlotStart = "";
  let confirmedSlotEnd = "";
  let initialStudentQuota = 0;

  try {
    // Read initial student quota from DB
    const quotaRes = await pgClient.query(
      `SELECT used_quota_hours FROM users WHERE id = '11111111-1111-1111-1111-111111111111'`
    );
    initialStudentQuota = parseFloat(quotaRes.rows[0]?.used_quota_hours || "0");
    console.log(`[SETUP] Initial Alex Chen used_quota_hours: ${initialStudentQuota}h\n`);

    // STEP 1: Student login using the Student demo button
    {
      const res = await fetch(`${BASE_URL}/api/v1/auth/sync`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN"
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const cookie = extractCookie(res, "lablink_token");
      if (res.status === 200 && cookie && data.user?.role === "student") {
        studentCookie = cookie;
        recordStep(1, "Student login using Student demo token", true, 
          `Authenticated as ${data.user.fullName} (${data.user.email}), session cookie length: ${cookie.length}`);
      } else {
        recordStep(1, "Student login using Student demo token", false, 
          `Status: ${res.status}, response: ${JSON.stringify(data)}`);
      }
    }

    // STEP 2: Verify redirect / access to Student dashboard context
    {
      const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
        headers: { Cookie: `lablink_token=${studentCookie}` },
      });
      const data = await res.json();
      if (res.status === 200 && data.user?.role === "student" && data.user?.email === "student.demo@lablink.edu") {
        recordStep(2, "Verify student session identity via /api/v1/auth/me", true, 
          `Session resolved student: ${data.user.fullName}, Role: ${data.user.role}, Dept: ${data.user.departmentName}`);
      } else {
        recordStep(2, "Verify student session identity via /api/v1/auth/me", false, 
          `Status: ${res.status}, data: ${JSON.stringify(data)}`);
      }
    }

    // STEP 3: Navigate to Equipment Catalog and select an instrument
    let selectedEquipmentId = "44444444-4444-4444-4444-444444440001";
    {
      const res = await fetch(`${BASE_URL}/api/v1/equipment`, {
        headers: { Cookie: `lablink_token=${studentCookie}` },
      });
      const data = await res.json();
      const equipmentList = data.equipment || data.data || [];
      const item = equipmentList.find((e: { id: string }) => e.id === selectedEquipmentId);
      if (res.status === 200 && Array.isArray(equipmentList) && item) {
        recordStep(3, "Navigate to Equipment Catalog & select instrument", true, 
          `Retrieved ${equipmentList.length} instruments. Selected: "${item.name}" (Status: ${item.status})`);
      } else {
        recordStep(3, "Navigate to Equipment Catalog & select instrument", false, 
          `Status: ${res.status}, item found: ${!!item}`);
      }
    }

    // STEP 4: Open New Request page & check equipment details
    {
      const res = await fetch(`${BASE_URL}/api/v1/equipment/${selectedEquipmentId}`, {
        headers: { Cookie: `lablink_token=${studentCookie}` },
      });
      const data = await res.json();
      if (res.status === 200 && data.equipment?.id === selectedEquipmentId) {
        recordStep(4, "Retrieve instrument details for New Request form", true, 
          `Instrument: ${data.equipment.name}, Lab: ${data.equipment.laboratory_name}, Buffer: ${data.equipment.buffer_minutes}m`);
      } else {
        recordStep(4, "Retrieve instrument details for New Request form", false, 
          `Status: ${res.status}, data: ${JSON.stringify(data)}`);
      }
    }

    // STEP 5: Fill out the request form with valid project details
    const uniqueNonce = Date.now().toString().slice(-4);
    const projectTitle = `GaN Inverter Switching Transient Characterization (E2E Run #${uniqueNonce})`;
    const projectDescription = "Precision pulse-width modulation transient verification for autonomous navigation motor controllers under thermal stress.";
    const requestPayload = {
      equipmentId: selectedEquipmentId,
      projectTitle: projectTitle,
      abstract: projectDescription,
      requestedDurationHours: 2,
      preferredWindowStart: new Date(Date.now() + 86400000 * 2).toISOString(),
      preferredWindowEnd: new Date(Date.now() + 86400000 * 6).toISOString(),
      hazardousMaterialsDeclared: false,
    };
    recordStep(5, "Construct validated project request payload", true, 
      `Title: "${projectTitle}", Duration: 2h, Window: +2d to +6d`);

    // STEP 6: Submit the request
    {
      const res = await fetch(`${BASE_URL}/api/v1/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `lablink_token=${studentCookie}`,
        },
        body: JSON.stringify(requestPayload),
      });
      const data = await res.json();
      if (res.status === 201 && data.request?.id) {
        createdRequestId = data.request.id;
        recordStep(6, "Submit project request via POST /api/v1/requests", true, 
          `Created Request ID: ${createdRequestId}, Status: ${data.request.status}`);
      } else {
        recordStep(6, "Submit project request via POST /api/v1/requests", false, 
          `Status: ${res.status}, response: ${JSON.stringify(data)}`);
      }
    }

    // STEP 7: Verify form submission succeeds and returns valid ID
    {
      const dbCheck = await pgClient.query(
        `SELECT r.id, r.status, r.student_id, p.project_title 
         FROM booking_requests r
         JOIN project_details p ON p.booking_request_id = r.id
         WHERE r.id = $1`,
        [createdRequestId]
      );
      if (dbCheck.rows.length === 1 && dbCheck.rows[0].status === "PENDING_REVIEW") {
        recordStep(7, "Verify request persisted in DB with PENDING_REVIEW status", true, 
          `PostgreSQL booking_requests record confirmed: ID=${dbCheck.rows[0].id}, title="${dbCheck.rows[0].project_title}", status=${dbCheck.rows[0].status}`);
      } else {
        recordStep(7, "Verify request persisted in DB with PENDING_REVIEW status", false, 
          `Rows found: ${dbCheck.rows.length}, status: ${dbCheck.rows[0]?.status}`);
      }
    }

    // STEP 8: Navigate to Student Requests and verify new request appears
    {
      const res = await fetch(`${BASE_URL}/api/v1/requests/me`, {
        headers: { Cookie: `lablink_token=${studentCookie}` },
      });
      const data = await res.json();
      const found = data.requests?.find((r: { id: string }) => r.id === createdRequestId);
      if (res.status === 200 && found && found.status === "PENDING_REVIEW") {
        recordStep(8, "Navigate to Student Requests (/api/v1/requests/me)", true, 
          `Found request ${found.id} on student docket with status PENDING_REVIEW`);
      } else {
        recordStep(8, "Navigate to Student Requests (/api/v1/requests/me)", false, 
          `Status: ${res.status}, found: ${!!found}`);
      }
    }

    // STEP 9: Student Logout
    {
      const res = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Cookie: `lablink_token=${studentCookie}` },
      });
      const data = await res.json();
      if (res.status === 200 && data.success) {
        recordStep(9, "Log out Student session via /api/v1/auth/logout", true, 
          `Student session cleared successfully.`);
      } else {
        recordStep(9, "Log out Student session via /api/v1/auth/logout", false, 
          `Status: ${res.status}, response: ${JSON.stringify(data)}`);
      }
    }

    // STEP 10: Faculty login using Faculty demo button
    {
      const res = await fetch(`${BASE_URL}/api/v1/auth/sync`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: "Bearer DEMO_TOKEN_FACULTY_MARCUS_VANCE"
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const cookie = extractCookie(res, "lablink_token");
      if (res.status === 200 && cookie && data.user?.role === "faculty") {
        facultyCookie = cookie;
        recordStep(10, "Faculty login using Faculty demo token", true, 
          `Authenticated as ${data.user.fullName} (${data.user.email}), session cookie length: ${cookie.length}`);
      } else {
        recordStep(10, "Faculty login using Faculty demo token", false, 
          `Status: ${res.status}, response: ${JSON.stringify(data)}`);
      }
    }

    // STEP 11: Verify redirect to Faculty Review Queue context
    {
      const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
        headers: { Cookie: `lablink_token=${facultyCookie}` },
      });
      const data = await res.json();
      if (res.status === 200 && data.user?.role === "faculty") {
        recordStep(11, "Verify faculty identity and RBAC authorization", true, 
          `Faculty user verified: ${data.user.fullName}, Role: ${data.user.role}`);
      } else {
        recordStep(11, "Verify faculty identity and RBAC authorization", false, 
          `Status: ${res.status}, data: ${JSON.stringify(data)}`);
      }
    }

    // STEP 12: Verify new request appears in the Faculty Review Queue
    {
      const res = await fetch(`${BASE_URL}/api/v1/requests`, {
        headers: { Cookie: `lablink_token=${facultyCookie}` },
      });
      const data = await res.json();
      const queueItem = data.requests?.find((r: { id: string }) => r.id === createdRequestId);
      if (res.status === 200 && queueItem) {
        recordStep(12, "Verify request appears in Faculty Review Queue", true, 
          `Request ${createdRequestId} found in review queue for equipment: ${queueItem.equipment?.name || queueItem.equipment_name || 'Keysight DSOX3024T'}`);
      } else {
        recordStep(12, "Verify request appears in Faculty Review Queue", false, 
          `Status: ${res.status}, items: ${data.requests?.length}, found: ${!!queueItem}`);
      }
    }

    // STEP 13: Select the request and review details
    {
      const res = await fetch(`${BASE_URL}/api/v1/requests/${createdRequestId}`, {
        headers: { Cookie: `lablink_token=${facultyCookie}` },
      });
      const data = await res.json();
      if (res.status === 200 && data.request?.id === createdRequestId) {
        recordStep(13, "Inspect full request details (/api/v1/requests/[id])", true, 
          `Student: ${data.request.student?.name}, Remaining Quota: ${data.request.student?.quotaHours - data.request.student?.usedQuotaHours}h, Project: ${data.request.project?.title}`);
      } else {
        recordStep(13, "Inspect full request details (/api/v1/requests/[id])", false, 
          `Status: ${res.status}, data: ${JSON.stringify(data)}`);
      }
    }

    // STEP 14: Approve the request
    {
      const res = await fetch(`${BASE_URL}/api/v1/requests/${createdRequestId}/review`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `lablink_token=${facultyCookie}`,
        },
        body: JSON.stringify({
          action: "APPROVE",
          notes: "GaN switching characterization approved for RF & Power Lab testing.",
        }),
      });
      const data = await res.json();
      
      const dbCheck = await pgClient.query(
        `SELECT status FROM booking_requests WHERE id = $1`,
        [createdRequestId]
      );
      if (res.status === 200 && dbCheck.rows[0]?.status === "APPROVED") {
        recordStep(14, "Approve request via PATCH /api/v1/requests/[id]/review", true, 
          `Status transitioned to APPROVED in DB and API response`);
      } else {
        recordStep(14, "Approve request via PATCH /api/v1/requests/[id]/review", false, 
          `Status: ${res.status}, db status: ${dbCheck.rows[0]?.status}`);
      }
    }

    // STEP 15: Select candidate time slot and confirm booking
    {
      // Fetch algorithmic recommendations
      const recsRes = await fetch(`${BASE_URL}/api/v1/requests/${createdRequestId}/recommendations`, {
        headers: { Cookie: `lablink_token=${facultyCookie}` },
      });
      const recsData = await recsRes.json();
      const slots = recsData.candidateSlots || recsData.recommendations?.candidateSlots || [];
      if (!slots || slots.length === 0) {
        throw new Error(`No candidate recommendation slots generated: ${JSON.stringify(recsData)}`);
      }
      const topSlot = slots[0];
      confirmedSlotStart = topSlot.startTime || topSlot.start;
      confirmedSlotEnd = topSlot.endTime || topSlot.end;
      console.log(`  Top candidate slot: ${confirmedSlotStart} -> ${confirmedSlotEnd} (Score: ${topSlot.compositeScore ?? topSlot.score})`);

      // Confirm booking
      const confirmRes = await fetch(`${BASE_URL}/api/v1/bookings/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `lablink_token=${facultyCookie}`,
        },
        body: JSON.stringify({
          requestId: createdRequestId,
          equipmentId: selectedEquipmentId,
          startTime: confirmedSlotStart,
          endTime: confirmedSlotEnd,
        }),
      });
      const confirmData = await confirmRes.json();
      if ((confirmRes.status === 200 || confirmRes.status === 201) && confirmData.booking?.id) {
        confirmedBookingId = confirmData.booking.id;
        recordStep(15, "Select candidate slot & confirm booking via POST /api/v1/bookings/confirm", true, 
          `Booking confirmed! ID: ${confirmedBookingId}, Time Range: ${confirmedSlotStart} to ${confirmedSlotEnd}`);
      } else {
        recordStep(15, "Select candidate slot & confirm booking via POST /api/v1/bookings/confirm", false, 
          `Status: ${confirmRes.status}, data: ${JSON.stringify(confirmData)}`);
      }
    }

    // STEP 16: Verify request advances to confirmed, booking in calendar, and student status updated
    {
      // 1. DB Booking record
      const bookingCheck = await pgClient.query(
        `SELECT id, status, time_range, equipment_id, student_id FROM bookings WHERE id = $1`,
        [confirmedBookingId]
      );
      const isBookingConfirmed = bookingCheck.rows.length === 1 && bookingCheck.rows[0].status === "CONFIRMED";

      // 2. DB Request record
      const requestCheck = await pgClient.query(
        `SELECT status FROM booking_requests WHERE id = $1`,
        [createdRequestId]
      );
      const isRequestBooked = requestCheck.rows[0]?.status === "BOOKED";

      // 3. User quota
      const quotaAfter = await pgClient.query(
        `SELECT used_quota_hours FROM users WHERE id = '11111111-1111-1111-1111-111111111111'`
      );
      const finalQuota = parseFloat(quotaAfter.rows[0]?.used_quota_hours || "0");
      const quotaIncreased = finalQuota >= initialStudentQuota + 2.0;

      // 4. Calendar check
      const calRes = await fetch(`${BASE_URL}/api/v1/schedule/calendar?startDate=${confirmedSlotStart.slice(0, 10)}`, {
        headers: { Cookie: `lablink_token=${facultyCookie}` },
      });
      const calData = await calRes.json();
      const inCalendar = calData.instruments?.some((inst: any) => 
        inst.bookings?.some((b: any) => b.id === confirmedBookingId)
      );

      // 5. Student view check
      const studentRes = await fetch(`${BASE_URL}/api/v1/requests/me`, {
        headers: { Cookie: `lablink_token=${studentCookie}` },
      });
      const studentData = await studentRes.json();
      const studentRequest = studentData.requests?.find((r: { id: string }) => r.id === createdRequestId);
      const studentStatusConfirmed = studentRequest?.status === "BOOKED" && studentRequest?.confirmedBooking;

      const allOk = isBookingConfirmed && isRequestBooked && quotaIncreased && inCalendar && studentStatusConfirmed;

      recordStep(16, "Verify comprehensive booking confirmation state across DB, calendar, & student view", allOk, 
        `Booking: ${bookingCheck.rows[0]?.status}, Request: ${requestCheck.rows[0]?.status}, Quota: ${initialStudentQuota}h -> ${finalQuota}h (+2h), Calendar Verified: ${inCalendar}, Student Docket Verified: ${!!studentStatusConfirmed}`);
    }

    console.log("\n================================================================================");
    console.log("✅ ALL 16 STEPS COMPLETED AND EMPIRICALLY VERIFIED WITH ZERO ERRORS!");
    console.log("================================================================================");
  } finally {
    await pgClient.end();
  }
}

runE2E().catch((err) => {
  console.error("\n❌ E2E Execution Failed:", err);
  process.exit(1);
});
