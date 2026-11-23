/**
 * Deterministic Candidate Slot Scoring Engine
 * Phase 2: Candidate Time-Slot Selection Formula
 *
 * S_slot(t, e, r) = 0.60 * S_contiguity(t, e) + 0.40 * S_preference(t, r)
 *
 * Tie-breaking:
 *   1. ROUND(S_slot, 6) DESC
 *   2. start_time ASC
 */

export interface CandidateSlotParams {
  startTime: Date;
  endTime: Date;
  preferredStart?: Date | null;
  preferredEnd?: Date | null;
  equipmentBufferMinutes: number;
  labOpenTime: string; // e.g. "08:00:00"
  labCloseTime: string; // e.g. "20:00:00"
  adjacentBookings: {
    start: Date;
    end: Date;
  }[];
}

export interface ScoredSlot {
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  durationHours: number;
  contiguityScore: number;
  preferenceScore: number;
  compositeScore: number;
  isRecommended: boolean;
  explanation: string;
}

/**
 * Computes contiguity score S_contiguity in [0, 1].
 * Rewards slots that sit directly next to existing bookings or lab operating boundaries,
 * minimizing calendar fragmentation and idle setup power.
 */
export function calculateContiguityScore(
  startTime: Date,
  endTime: Date,
  bufferMinutes: number,
  labOpenTime: string,
  labCloseTime: string,
  adjacentBookings: { start: Date; end: Date }[]
): { score: number; reason: string } {
  const startMs = startTime.getTime();
  const endMs = endTime.getTime();
  const bufferMs = bufferMinutes * 60 * 1000;

  // Check proximity to existing bookings
  let touchesPriorBooking = false;
  let touchesNextBooking = false;
  let minGapHours = 24;

  for (const b of adjacentBookings) {
    const bStartMs = b.start.getTime();
    const bEndMs = b.end.getTime();

    // Directly adjacent with buffer: [b.end + buffer == start]
    if (Math.abs(startMs - (bEndMs + bufferMs)) <= 15 * 60 * 1000) {
      touchesPriorBooking = true;
    }
    // Directly adjacent with buffer: [end + buffer == b.start]
    if (Math.abs(bStartMs - (endMs + bufferMs)) <= 15 * 60 * 1000) {
      touchesNextBooking = true;
    }

    // Gap to prior
    if (startMs >= bEndMs) {
      const gapH = (startMs - bEndMs) / (1000 * 3600);
      if (gapH < minGapHours) minGapHours = gapH;
    }
    // Gap to next
    if (bStartMs >= endMs) {
      const gapH = (bStartMs - endMs) / (1000 * 3600);
      if (gapH < minGapHours) minGapHours = gapH;
    }
  }

  // Check boundary contiguity (opens at 08:00 or closes at 20:00)
  const [openH, openM] = labOpenTime.split(":").map(Number);
  const [closeH, closeM] = labCloseTime.split(":").map(Number);

  const slotStartH = startTime.getUTCHours();
  const slotStartM = startTime.getUTCMinutes();
  const slotEndH = endTime.getUTCHours();
  const slotEndM = endTime.getUTCMinutes();

  const isAtLabOpening = Math.abs((slotStartH * 60 + slotStartM) - (openH * 60 + openM)) <= 15;
  const isAtLabClosing = Math.abs((slotEndH * 60 + slotEndM) - (closeH * 60 + closeM)) <= 15;

  if ((touchesPriorBooking && touchesNextBooking) || (touchesPriorBooking && isAtLabClosing) || (isAtLabOpening && touchesNextBooking)) {
    return {
      score: 1.0,
      reason: "Packs perfectly between confirmed reservations or lab operating bounds (zero idle waste).",
    };
  }

  if (touchesPriorBooking || touchesNextBooking) {
    return {
      score: 0.88,
      reason: "Adjacent to confirmed reservation (conserves thermal/calibration cycle).",
    };
  }

  if (isAtLabOpening || isAtLabClosing) {
    return {
      score: 0.78,
      reason: "Anchored to laboratory boundary shift (e.g. morning opener or evening closure).",
    };
  }

  // If no adjacent bookings, compute score based on gap size (prefer smaller clean blocks)
  const score = Math.max(0.40, Math.min(0.70, 0.70 - minGapHours * 0.04));
  return {
    score: Number(score.toFixed(4)),
    reason: `Standard open slot with ${minGapHours.toFixed(1)}h separation from nearest activity.`,
  };
}

/**
 * Computes preference score S_preference in [0, 1].
 * Evaluates temporal distance to student requested preference window.
 */
export function calculatePreferenceScore(
  startTime: Date,
  endTime: Date,
  preferredStart?: Date | null,
  preferredEnd?: Date | null
): { score: number; reason: string } {
  if (!preferredStart || !preferredEnd) {
    return { score: 0.80, reason: "No student time preference specified; standard neutral weighting." };
  }

  const prefStartMs = new Date(preferredStart).getTime();
  const prefEndMs = new Date(preferredEnd).getTime();
  const startMs = startTime.getTime();
  const endMs = endTime.getTime();

  // Exactly inside preferred window
  if (startMs >= prefStartMs && endMs <= prefEndMs) {
    return { score: 1.0, reason: "Fully inside student's requested operating window." };
  }

  // Partially overlapping
  if (startMs < prefEndMs && endMs > prefStartMs) {
    const overlapMs = Math.min(endMs, prefEndMs) - Math.max(startMs, prefStartMs);
    const durationMs = endMs - startMs;
    const ratio = overlapMs / durationMs;
    const score = 0.80 + ratio * 0.15;
    return {
      score: Number(score.toFixed(4)),
      reason: `Partially overlaps student's requested window (${Math.round(ratio * 100)}% match).`,
    };
  }

  // Outside: measure distance in hours to closest boundary
  const distMs = startMs < prefStartMs ? prefStartMs - endMs : startMs - prefEndMs;
  const distHours = distMs / (1000 * 3600);

  // Decay 0.03 per hour distance, minimum floor 0.20
  const score = Math.max(0.20, 0.80 - distHours * 0.03);
  return {
    score: Number(score.toFixed(4)),
    reason: `Shifted by ${distHours.toFixed(1)}h from student's target window.`,
  };
}

/**
 * Scores and deterministic tie-breaking for candidate slots
 */
export function scoreCandidateSlot(params: CandidateSlotParams): ScoredSlot {
  const { score: contiguityScore, reason: contiguityReason } = calculateContiguityScore(
    params.startTime,
    params.endTime,
    params.equipmentBufferMinutes,
    params.labOpenTime,
    params.labCloseTime,
    params.adjacentBookings
  );

  const { score: preferenceScore, reason: preferenceReason } = calculatePreferenceScore(
    params.startTime,
    params.endTime,
    params.preferredStart,
    params.preferredEnd
  );

  // Exact specification weights: 0.60 Contiguity + 0.40 Preference
  const compositeScore = Number(
    (0.60 * contiguityScore + 0.40 * preferenceScore).toFixed(6)
  );

  const durationHours = Number(
    ((params.endTime.getTime() - params.startTime.getTime()) / (1000 * 3600)).toFixed(2)
  );

  return {
    startTime: params.startTime.toISOString(),
    endTime: params.endTime.toISOString(),
    durationHours,
    contiguityScore,
    preferenceScore,
    compositeScore,
    isRecommended: false,
    explanation: `${contiguityReason} ${preferenceReason}`,
  };
}

/**
 * Deterministic tie-breaking sort:
 * 1. ROUND(compositeScore, 6) DESC
 * 2. startTime ASC
 */
export function rankSlots(slots: ScoredSlot[]): ScoredSlot[] {
  const sorted = [...slots].sort((a, b) => {
    const diff = b.compositeScore - a.compositeScore;
    if (Math.abs(diff) > 0.000001) {
      return diff;
    }
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  if (sorted.length > 0) {
    sorted[0].isRecommended = true;
  }

  return sorted;
}
