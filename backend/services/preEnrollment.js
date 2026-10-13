// Pre-enrollment rules and the approval step that turns a request into real enrollments.
//
// evaluateSelection() is the single judge of "may this student take these classes?". The portal uses it
// to warn while the student is choosing and again on submit; the admin queue uses it to show what is
// wrong with a request right now (seats and grades change after it was submitted); approval uses it
// before touching anything. `problems` block; `warnings` are shown but do not.

const { Student, Term, Offering, Enrollment, Grade, Hold, PreEnrollment } = require('../models');
const { PASSING_GRADE } = require('../models/Grade');
const { offeringsConflict } = require('./schedule');
const { enrollStudent, EnrollmentError } = require('./enrollment');
const RULES = require('../config/enrollmentRules');

const P = (code, message, offeringId) => ({ code, message, ...(offeringId ? { offeringId: String(offeringId) } : {}) });
const label = (o) => `${o.subject.code} (${o.section})`;

// What we need to know about a student to judge any class for them.
async function loadContext(studentId, termId) {
  const [student, passed, running, termRows, holds] = await Promise.all([
    Student.findById(studentId).select('academicStatus'),
    Grade.find({ student: studentId, value: { $lte: PASSING_GRADE } }).distinct('subject'),
    // Subjects being taken right now in another term: a prerequisite that is "in progress".
    Enrollment.find({ student: studentId, status: 'Enrolled', term: { $ne: termId } }).distinct('subject'),
    Enrollment.find({ student: studentId, term: termId, status: { $ne: 'Dropped' } }).populate({ path: 'offering', populate: { path: 'subject', select: 'code units' } }),
    Hold.find({ student: studentId, status: 'Active' }).select('type reason'),
  ]);
  return {
    student,
    passed: new Set(passed.map(String)),
    running: new Set(running.map(String)),
    termSubjects: new Set(termRows.map((e) => String(e.subject))), // already enrolled this term
    termOfferings: termRows.map((e) => e.offering),
    termUnits: termRows.reduce((sum, e) => sum + (e.offering?.subject?.units ?? 0), 0),
    holds,
  };
}

// Problems and warnings for ONE class, ignoring what else the student picked.
function checkOffering(ctx, o) {
  const problems = [];
  const warnings = [];
  if (o.status !== 'Open') problems.push(P('OFFERING_CLOSED', `${label(o)} is ${o.status.toLowerCase()}.`, o._id));
  else if (o.enrolledCount >= o.capacity) problems.push(P('OFFERING_FULL', `${label(o)} is full right now.`, o._id));

  const subjectId = String(o.subject._id);
  if (ctx.termSubjects.has(subjectId)) problems.push(P('ALREADY_ENROLLED', `You are already enrolled in ${o.subject.code} this term.`, o._id));
  if (ctx.passed.has(subjectId)) problems.push(P('ALREADY_PASSED', `You have already passed ${o.subject.code}.`, o._id));

  const missing = [];
  const conditional = [];
  for (const pre of o.subject.prerequisites || []) {
    const id = String(pre._id ?? pre);
    const code = pre.code ?? id;
    if (ctx.passed.has(id)) continue;
    (ctx.running.has(id) ? conditional : missing).push(code);
  }
  if (missing.length) problems.push(P('PREREQUISITE_NOT_MET', `${o.subject.code} needs ${missing.join(', ')}, which you have not passed.`, o._id));
  if (conditional.length) {
    warnings.push(P('PREREQUISITE_CONDITIONAL', `${o.subject.code} needs ${conditional.join(', ')}, which you are taking now. This is conditional on passing it.`, o._id));
  }
  const clash = ctx.termOfferings.find((x) => x && String(x._id) !== String(o._id) && offeringsConflict(x, o));
  if (clash) problems.push(P('SCHEDULE_CONFLICT', `${label(o)} clashes with ${clash.subject.code}, which you already have this term.`, o._id));
  return { problems, warnings };
}

/**
 * Judge a set of offerings for a student.
 * options: requireOpenTerm, blockOnHolds (for the portal); the admin queue turns both off and sees holds as a warning.
 */
async function evaluateSelection(studentId, offeringIds, { requireOpenTerm = false, blockOnHolds = false } = {}) {
  const problems = [];
  const warnings = [];
  const ids = [...new Set((offeringIds || []).map(String))];
  if (ids.length === 0) return { ok: false, items: [], totalUnits: 0, existingUnits: 0, problems: [P('NO_SUBJECTS', 'Choose at least one subject.')], warnings };

  const offerings = await Offering.find({ _id: { $in: ids } }).populate({ path: 'subject', populate: { path: 'prerequisites', select: 'code' } }).populate('term');
  const found = new Map(offerings.map((o) => [String(o._id), o]));
  for (const id of ids) if (!found.has(id)) problems.push(P('OFFERING_NOT_FOUND', 'A class you chose no longer exists.', id));
  if (offerings.length === 0) return { ok: false, items: [], totalUnits: 0, existingUnits: 0, problems, warnings };

  const termIds = new Set(offerings.map((o) => String(o.term._id)));
  if (termIds.size > 1) problems.push(P('MIXED_TERMS', 'All classes must belong to the same term.'));
  const term = offerings[0].term;
  if (requireOpenTerm && !term.enrollmentOpen) problems.push(P('TERM_CLOSED', `Pre-enrollment for ${term.name} is not open.`));

  const ctx = await loadContext(studentId, term._id);
  if (!ctx.student) problems.push(P('STUDENT_NOT_FOUND', 'Student not found.'));
  else if (ctx.student.academicStatus !== 'Enrolled') problems.push(P('STUDENT_NOT_ACTIVE', `A student whose status is ${ctx.student.academicStatus} cannot pre-enroll.`));
  const blocking = ctx.holds.filter((h) => RULES.BLOCKING_HOLD_TYPES.includes(h.type));
  const advisory = ctx.holds.filter((h) => !RULES.BLOCKING_HOLD_TYPES.includes(h.type));
  if (blocking.length) {
    const text = `Active ${blocking.map((h) => h.type).join(', ')} hold.`;
    (blockOnHolds ? problems : warnings).push(P('HOLD', blockOnHolds ? `${text} Clear it with the office concerned before pre-enrolling.` : text));
  }
  if (advisory.length) warnings.push(P('HOLD_ADVISORY', `Active ${advisory.map((h) => h.type).join(', ')} hold. It does not stop pre-enrollment, but please settle it.`));

  const subjectsSeen = new Map();
  const items = [];
  for (const o of offerings) {
    const checks = checkOffering(ctx, o);
    const dupe = subjectsSeen.get(String(o.subject._id));
    if (dupe) checks.problems.push(P('DUPLICATE_SUBJECT', `${o.subject.code} was chosen twice (sections ${dupe.section} and ${o.section}).`, o._id));
    subjectsSeen.set(String(o.subject._id), o);
    problems.push(...checks.problems);
    warnings.push(...checks.warnings);
    items.push({ offering: o, problems: checks.problems, warnings: checks.warnings });
  }

  // Classes in the selection must not overlap each other.
  for (let i = 0; i < offerings.length; i += 1) {
    for (let j = i + 1; j < offerings.length; j += 1) {
      if (offeringsConflict(offerings[i], offerings[j])) {
        problems.push(P('SCHEDULE_CONFLICT', `${label(offerings[i])} and ${label(offerings[j])} meet at the same time.`, offerings[j]._id));
      }
    }
  }

  const totalUnits = offerings.reduce((sum, o) => sum + o.subject.units, 0);
  if (ctx.termUnits + totalUnits > RULES.MAX_UNITS) {
    problems.push(P('UNIT_LIMIT', `That is ${ctx.termUnits + totalUnits} units for the term. The maximum is ${RULES.MAX_UNITS}.`));
  } else if (ctx.termUnits + totalUnits < RULES.REGULAR_MIN_UNITS) {
    warnings.push(P('UNDER_LOAD', `${ctx.termUnits + totalUnits} units is below the regular load of ${RULES.REGULAR_MIN_UNITS}. You would be a part-time student.`));
  }

  return { ok: problems.length === 0, term, items, totalUnits, existingUnits: ctx.termUnits, problems, warnings };
}

// Create a pending request after checking it. Throws EnrollmentError-shaped errors with the problem list.
async function submitPreEnrollment(studentId, offeringIds) {
  const result = await evaluateSelection(studentId, offeringIds, { requireOpenTerm: true, blockOnHolds: true });
  if (!result.ok) throw Object.assign(new EnrollmentError('PREENROLL_INVALID', result.problems[0].message), { problems: result.problems, warnings: result.warnings });

  try {
    return await PreEnrollment.create({
      student: studentId,
      term: result.term._id,
      items: result.items.map(({ offering }) => ({ offering: offering._id, subject: offering.subject._id, units: offering.subject.units })),
      totalUnits: result.totalUnits,
    });
  } catch (err) {
    if (err.code === 11000) throw new EnrollmentError('ALREADY_PENDING', 'You already have a pending pre-enrollment for this term. Cancel it first to change it.');
    throw err;
  }
}

// Give back what an approval created so far (used if a later class fails).
async function rollback(created) {
  for (const { enrollment, reusedDropped } of created.reverse()) {
    await Offering.updateOne({ _id: enrollment.offering }, { $inc: { enrolledCount: -1 } });
    if (reusedDropped) await Enrollment.updateOne({ _id: enrollment._id }, { $set: { status: 'Dropped', droppedAt: new Date() } });
    else await Enrollment.deleteOne({ _id: enrollment._id });
  }
}

/**
 * Approve a pending request: re-check everything with today's seats and grades, then enroll the student
 * in every class. All or nothing: if anything fails, the classes already added are taken back.
 * `allowConditional`: accept classes whose prerequisite is still in progress.
 */
async function approvePreEnrollment(requestId, adminId, { allowConditional = false } = {}) {
  const request = await PreEnrollment.findById(requestId);
  if (!request) throw new EnrollmentError('REQUEST_NOT_FOUND', 'Pre-enrollment request not found', 404);
  if (request.status !== 'Pending') throw new EnrollmentError('NOT_PENDING', `This request is already ${request.status.toLowerCase()}.`);

  const check = await evaluateSelection(request.student, request.items.map((i) => i.offering));
  if (!check.ok) throw Object.assign(new EnrollmentError('PREENROLL_INVALID', check.problems[0].message), { problems: check.problems, warnings: check.warnings });
  const conditional = check.warnings.filter((w) => w.code === 'PREREQUISITE_CONDITIONAL');
  if (conditional.length && !allowConditional) {
    throw Object.assign(new EnrollmentError('CONDITIONAL_PREREQUISITES', 'Some classes need a prerequisite the student is still taking. Confirm to approve them conditionally.'), { problems: [], warnings: conditional });
  }
  const conditionalOfferings = new Set(conditional.map((w) => w.offeringId));

  const created = [];
  try {
    for (const item of request.items) {
      const reusedDropped = Boolean(await Enrollment.exists({ student: request.student, term: request.term, subject: item.subject, status: 'Dropped' }));
      const enrollment = await enrollStudent(request.student, item.offering, { skipPrerequisites: conditionalOfferings.has(String(item.offering)) });
      created.push({ enrollment, reusedDropped });
    }
  } catch (err) {
    await rollback(created);
    if (err instanceof EnrollmentError) {
      throw Object.assign(new EnrollmentError(err.code, `${err.message} Nothing was enrolled.`, err.status), { problems: [P(err.code, err.message)], warnings: [] });
    }
    throw err;
  }

  request.status = 'Approved';
  request.decidedAt = new Date();
  request.decidedBy = adminId;
  request.enrollments = created.map((c) => c.enrollment._id);
  await request.save();
  return request;
}

async function rejectPreEnrollment(requestId, adminId, note) {
  const request = await PreEnrollment.findOneAndUpdate(
    { _id: requestId, status: 'Pending' },
    { $set: { status: 'Rejected', decidedAt: new Date(), decidedBy: adminId, note } },
    { returnDocument: 'after', runValidators: true },
  );
  if (request) return request;
  const exists = await PreEnrollment.findById(requestId).select('status');
  if (!exists) throw new EnrollmentError('REQUEST_NOT_FOUND', 'Pre-enrollment request not found', 404);
  throw new EnrollmentError('NOT_PENDING', `This request is already ${exists.status.toLowerCase()}.`);
}

// The student withdraws their own pending request.
async function cancelPreEnrollment(requestId, studentId) {
  const request = await PreEnrollment.findOneAndUpdate(
    { _id: requestId, student: studentId, status: 'Pending' },
    { $set: { status: 'Cancelled', decidedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (request) return request;
  const own = await PreEnrollment.findOne({ _id: requestId, student: studentId }).select('status');
  if (!own) throw new EnrollmentError('REQUEST_NOT_FOUND', 'Pre-enrollment request not found', 404);
  throw new EnrollmentError('NOT_PENDING', `This request is already ${own.status.toLowerCase()}.`);
}

// The term students are currently pre-enrolling for (the earliest one that is open).
const openTerm = () => Term.findOne({ enrollmentOpen: true }).sort({ startDate: 1 });

module.exports = { evaluateSelection, loadContext, checkOffering, submitPreEnrollment, approvePreEnrollment, rejectPreEnrollment, cancelPreEnrollment, openTerm, RULES };

// ---- Presenting requests ---------------------------------------------------------------------
const POPULATE = [
  { path: 'term' },
  { path: 'items.offering', select: 'section professor meetings' },
  { path: 'items.subject', select: 'code title units' },
];

const meetingJson = (m) => ({ day: m.day, start: m.start, end: m.end, room: m.room });

// A populated request as the client sees it.
function requestJson(r) {
  return {
    id: String(r._id),
    status: r.status,
    term: { id: String(r.term._id), name: r.term.name },
    submittedAt: r.submittedAt,
    decidedAt: r.decidedAt,
    note: r.note,
    totalUnits: r.totalUnits,
    items: r.items.map((i) => ({
      offeringId: String(i.offering._id),
      code: i.subject.code,
      title: i.subject.title,
      units: i.units,
      section: i.offering.section,
      professor: i.offering.professor,
      meetings: i.offering.meetings.map(meetingJson),
    })),
  };
}

module.exports.POPULATE = POPULATE;
module.exports.requestJson = requestJson;
