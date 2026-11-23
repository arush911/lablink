import { query } from "@/lib/db/pool";
import {
  CandidateSlotParams,
  ScoredSlot,
  scoreCandidateSlot,
  rankSlots,
} from "./slot-scoring";

export interface CandidateGenerationRequest {
  requestId?: string;
  equipmentId: string;
  requestedDurationHours: number;
  preferredStart?: Date | string | null;
  preferredEnd?: Date | string | null;
  projectDeadline?: Date | string | null;
  horizonDays?: number;
}

export interface CandidateRecommendationResult {
  equipment: {
    id: string;
    name: string;
    model: string;
    manufacturer: string;
    assetTag: string;
    bufferMinutes: number;
    labName: string;
  };
  requestedDurationHours: number;
  candidateSlots: ScoredSlot[];
  generatedAt: string;
}

export async function generateCandidateSlots(
  req: CandidateGenerationRequest
): Promise<CandidateRecommendationResult> {
  const {
    equipmentId,
    requestedDurationHours,
    preferredStart,
    preferredEnd,
    projectDeadline,
    horizonDays = 7,
  } = req;

  // 1. Fetch Equipment and Laboratory Metadata
  const eqRes = await query(
    `SELECT e.id, e.name, e.model, e.manufacturer, e.asset_tag, e.buffer_minutes, e.status,
            l.id as lab_id, l.name as lab_name
     FROM equipment e
     JOIN laboratories l ON e.laboratory_id = l.id
     WHERE e.id = $1`,
    [equipmentId]
  );

  if (eqRes.rows.length === 0) {
    throw new Error(`Equipment with ID ${equipmentId} not found.`);
  }

  const eq = eqRes.rows[0];
  const bufferMinutes = Number(eq.buffer_minutes) || 15;
  const durationMs = requestedDurationHours * 3600 * 1000;
  const bufferMs = bufferMinutes * 60 * 1000;

  // 2. Fetch Laboratory Operating Hours (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const hoursRes = await query(
    `SELECT day_of_week, open_time, close_time, is_closed
     FROM laboratory_operating_hours
     WHERE laboratory_id = $1`,
    [eq.lab_id]
  );

  const hoursByDay: Record<number, { open: string; close: string; isClosed: boolean }> = {};
  for (const h of hoursRes.rows) {
    hoursByDay[h.day_of_week] = {
      open: h.open_time,
      close: h.close_time,
      isClosed: h.is_closed,
    };
  }

  // 3. Determine Horizon Window
  const now = new Date();
  const maxHorizonDate = new Date(now.getTime() + horizonDays * 24 * 3600 * 1000);
  let effectiveDeadline = maxHorizonDate;

  if (projectDeadline) {
    const dlDate = new Date(projectDeadline);
    // End of deadline day (23:59:59)
    dlDate.setUTCHours(23, 59, 59, 999);
    if (dlDate < effectiveDeadline) {
      effectiveDeadline = dlDate;
    }
  }

  // 4. Fetch Existing Confirmed Bookings in this Window
  const bookingsRes = await query(
    `SELECT start_time, end_time
     FROM bookings
     WHERE equipment_id = $1
       AND status = 'CONFIRMED'
       AND end_time > $2
       AND start_time < $3
     ORDER BY start_time ASC`,
    [equipmentId, now.toISOString(), effectiveDeadline.toISOString()]
  );

  const existingBookings = bookingsRes.rows.map((r: any) => ({
    start: new Date(r.start_time),
    end: new Date(r.end_time),
  }));

  // 5. Generate Candidate Feasible Slots
  const candidateSlots: ScoredSlot[] = [];
  const candidateStart = new Date(now);
  // Start from tomorrow 08:00 if current time is late, or 1 hour ahead
  candidateStart.setMinutes(0, 0, 0);
  candidateStart.setHours(candidateStart.getHours() + 1);

  // Scan day by day up to effectiveDeadline
  const currentDay = new Date(candidateStart);
  currentDay.setHours(0, 0, 0, 0);

  while (currentDay <= effectiveDeadline) {
    const dayOfWeek = currentDay.getDay();
    const labHours = hoursByDay[dayOfWeek] || { open: "08:00:00", close: "20:00:00", isClosed: false };

    if (!labHours.isClosed) {
      const [openH, openM] = labHours.open.split(":").map(Number);
      const [closeH, closeM] = labHours.close.split(":").map(Number);

      const dayOpen = new Date(currentDay);
      dayOpen.setHours(openH, openM, 0, 0);

      const dayClose = new Date(currentDay);
      dayClose.setHours(closeH, closeM, 0, 0);

      // Iterate in 30-minute steps
      let slotStart = new Date(dayOpen);
      while (slotStart.getTime() + durationMs <= dayClose.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        // Slot must be at least 1 hour from now
        if (slotStart.getTime() > now.getTime() + 3600 * 1000) {
          // Check collision with existing confirmed bookings, considering buffer on both sides
          let hasConflict = false;
          for (const b of existingBookings) {
            // b occupied interval with equipment buffer: [b.start - buffer, b.end + buffer]
            const bPaddedStart = b.start.getTime() - bufferMs;
            const bPaddedEnd = b.end.getTime() + bufferMs;

            // Conflict if intervals overlap: max(start, bStart) < min(end, bEnd)
            if (Math.max(slotStart.getTime(), bPaddedStart) < Math.min(slotEnd.getTime(), bPaddedEnd)) {
              hasConflict = true;
              break;
            }
          }

          if (!hasConflict) {
            const params: CandidateSlotParams = {
              startTime: slotStart,
              endTime: slotEnd,
              preferredStart: preferredStart ? new Date(preferredStart) : null,
              preferredEnd: preferredEnd ? new Date(preferredEnd) : null,
              equipmentBufferMinutes: bufferMinutes,
              labOpenTime: labHours.open,
              labCloseTime: labHours.close,
              adjacentBookings: existingBookings,
            };

            const scored = scoreCandidateSlot(params);
            candidateSlots.push(scored);
          }
        }

        // Step by 30 minutes
        slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
      }
    }

    // Advance to next day
    currentDay.setDate(currentDay.getDate() + 1);
  }

  // 6. Deterministic Rank and Top Candidate Selection
  const ranked = rankSlots(candidateSlots);

  // Return top 6 distinct slots
  const topSlots = ranked.slice(0, 6);

  return {
    equipment: {
      id: eq.id,
      name: eq.name,
      model: eq.model,
      manufacturer: eq.manufacturer,
      assetTag: eq.asset_tag,
      bufferMinutes,
      labName: eq.lab_name,
    },
    requestedDurationHours,
    candidateSlots: topSlots,
    generatedAt: new Date().toISOString(),
  };
}
