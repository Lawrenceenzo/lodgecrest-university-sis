// Standing computations on the Philippine grading scale: 1.00 is excellent, 3.00 is the passing
// mark, 5.00 is a fail. Pure functions: give them records, get numbers back.
const PASSING_GRADE = 3;

// Round half-up to 2 decimals (1.555 -> 1.56; plain toFixed can land on the wrong side).
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * records: one entry per GRADED enrollment:
 *   { subjectId, units, countsToGwa, value, mark }
 *   value = numeric grade (or null), mark = 'INC' | 'DRP' | 'W' (or null)
 *
 * GWA = sum(grade x units) / sum(units), over numeric grades of subjects that count to GWA.
 * INC, DRP, W and non-GWA subjects (e.g. NSTP) are left out. Every numeric attempt counts, so a
 * failed subject keeps pulling the GWA down even after a successful retake.
 *
 * unitsEarned counts the units of each PASSED subject once (a retake of the same subject doesn't double it).
 */
function computeStanding(records, { unitsRequired = null } = {}) {
  let weightedSum = 0;
  let gwaUnits = 0;
  const passedUnits = new Map(); // subjectId -> units (once per subject)
  const failed = new Set();
  const incomplete = new Set();

  for (const r of records) {
    const numeric = r.value !== null && r.value !== undefined;
    if (!numeric) {
      if (r.mark === 'INC') incomplete.add(String(r.subjectId));
      continue; // DRP / W earn nothing and count nowhere
    }
    if (r.countsToGwa !== false) {
      weightedSum += r.value * r.units;
      gwaUnits += r.units;
    }
    if (r.value <= PASSING_GRADE) passedUnits.set(String(r.subjectId), r.units);
    else failed.add(String(r.subjectId));
  }

  // A subject failed once but passed later is no longer outstanding.
  const outstandingFailures = [...failed].filter((id) => !passedUnits.has(id));
  const unitsEarned = [...passedUnits.values()].reduce((a, b) => a + b, 0);

  return {
    gwa: gwaUnits > 0 ? round2(weightedSum / gwaUnits) : null,
    unitsEarned,
    unitsRequired,
    unitsRemaining: unitsRequired === null ? null : Math.max(unitsRequired - unitsEarned, 0),
    outstandingFailures,
    incomplete: [...incomplete],
  };
}

module.exports = { PASSING_GRADE, round2, computeStanding };
