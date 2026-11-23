import { describe, it, expect } from "vitest";
import { GET as getEquipment } from "../app/api/v1/equipment/route";
import { GET as getEquipmentById } from "../app/api/v1/equipment/[id]/route";
import { POST as postRequest } from "../app/api/v1/requests/route";
import { GET as getMyRequests } from "../app/api/v1/requests/me/route";
import { POST as cancelRequest } from "../app/api/v1/requests/[id]/cancel/route";
import { query } from "../lib/db/pool";

describe("Stage 4: Equipment Discovery & Student Request Pipeline", () => {
  const TEST_EQUIPMENT_ID = "44444444-4444-4444-4444-444444440001"; // Keysight Oscilloscope
  let createdRequestId: string;

  // A. Equipment Discovery Tests
  it("GET /api/v1/equipment returns 10 seeded instruments with status and specifications", async () => {
    const req = new Request("http://localhost:3000/api/v1/equipment");
    const res = await getEquipment(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.equipment).toBeDefined();
    expect(data.equipment.length).toBe(10);
    expect(data.departments.length).toBe(3);

    // Verify properties
    const item = data.equipment[0];
    expect(item.id).toBeDefined();
    expect(item.name).toBeDefined();
    expect(item.assetTag).toBeDefined();
    expect(item.status).toBe("AVAILABLE");
    expect(item.laboratory.roomLocation).toBeDefined();
  });

  it("GET /api/v1/equipment filters instruments by search term", async () => {
    const req = new Request("http://localhost:3000/api/v1/equipment?search=Keysight");
    const res = await getEquipment(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.equipment.length).toBe(1);
    expect(data.equipment[0].name).toContain("Keysight");
  });

  it("GET /api/v1/equipment filters instruments by department", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/equipment?departmentId=00000000-0000-0000-0000-000000000001"
    );
    const res = await getEquipment(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.equipment.length).toBeGreaterThan(0);
    data.equipment.forEach((item: any) => {
      expect(item.department.id).toBe("00000000-0000-0000-0000-000000000001");
    });
  });

  it("GET /api/v1/equipment/:id returns full instrument details and operating hours", async () => {
    const req = new Request(`http://localhost:3000/api/v1/equipment/${TEST_EQUIPMENT_ID}`);
    const res = await getEquipmentById(req, { params: Promise.resolve({ id: TEST_EQUIPMENT_ID }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.equipment.id).toBe(TEST_EQUIPMENT_ID);
    expect(data.equipment.technicalSpecifications).toBeDefined();
    expect(data.equipment.laboratory.operatingHours).toBeDefined();
    expect(data.equipment.laboratory.operatingHours.length).toBe(7);
  });

  // B. Student Request Submission Tests
  it("POST /api/v1/requests creates project docket with PENDING_REVIEW status", async () => {
    const payload = {
      equipmentId: TEST_EQUIPMENT_ID,
      projectTitle: "Autonomous Drone Flight Motor Telemetry Analysis",
      abstract: "High-frequency signal sampling of brushless motor ESC telemetry under fluctuating battery loads.",
      requestedDurationHours: 2.5,
      projectDeadline: "2026-12-15",
      courseCode: "ECE-402",
      grantCode: "NSF-ROBO-2026",
      hazardousMaterialsDeclared: false,
    };

    const req = new Request("http://localhost:3000/api/v1/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN",
      },
      body: JSON.stringify(payload),
    });

    const res = await postRequest(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.request.docketNumber).toMatch(/^DOCK-2026-\d{4}$/);
    expect(data.request.status).toBe("PENDING_REVIEW");
    expect(data.request.requestedDurationHours).toBe("2.50");

    createdRequestId = data.request.id;

    // Verify PostgreSQL persistence
    const dbCheck = await query(
      "SELECT id, status, requested_duration_hours FROM booking_requests WHERE id = $1;",
      [createdRequestId]
    );
    expect(dbCheck.rows.length).toBe(1);
    expect(dbCheck.rows[0].status).toBe("PENDING_REVIEW");
  });

  it("POST /api/v1/requests rejects invalid duration (< 0.5h or > 12h) with HTTP 422", async () => {
    const invalidPayload = {
      equipmentId: TEST_EQUIPMENT_ID,
      projectTitle: "Invalid Duration Experiment",
      abstract: "Testing rejection bounds for negative or excessive duration.",
      requestedDurationHours: 15.0, // Exceeds 12.0h max
    };

    const req = new Request("http://localhost:3000/api/v1/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN",
      },
      body: JSON.stringify(invalidPayload),
    });

    const res = await postRequest(req);
    expect(res.status).toBe(422);

    const data = await res.json();
    expect(data.error).toBe("VALIDATION_FAILED");
    expect(data.issues.some((i: any) => i.field === "requestedDurationHours")).toBe(true);
  });

  // C. Student Request Tracking & Ownership Isolation
  it("GET /api/v1/requests/me returns only the authenticated student's dockets", async () => {
    const req = new Request("http://localhost:3000/api/v1/requests/me", {
      headers: {
        Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN",
      },
    });

    const res = await getMyRequests(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.student.email).toBe("student.demo@lablink.edu");
    expect(data.requests.length).toBeGreaterThan(0);
    expect(data.requests.some((r: any) => r.id === createdRequestId)).toBe(true);
  });

  // D. Cancellation Policy
  it("POST /api/v1/requests/:id/cancel cancels pending request docket", async () => {
    const req = new Request(`http://localhost:3000/api/v1/requests/${createdRequestId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer DEMO_TOKEN_STUDENT_ALEX_CHEN",
      },
      body: JSON.stringify({ reason: "Experiment parameters redesigned" }),
    });

    const res = await cancelRequest(req, { params: Promise.resolve({ id: createdRequestId }) });
    expect(res.status).toBe(200);

    // Verify database state is CANCELLED
    const dbCheck = await query(
      "SELECT status FROM booking_requests WHERE id = $1;",
      [createdRequestId]
    );
    expect(dbCheck.rows[0].status).toBe("CANCELLED");
  });
});
