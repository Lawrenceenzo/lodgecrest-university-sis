const Student = require('../models/Student');
const Offering = require('../models/Offering');
const Subject = require('../models/Subject');
const Enrollment = require('../models/Enrollment');
const Grade = require('../models/Grade');
const { PASSING_GRADE } = require('../models/Grade');
const { offeringsConflict } = require('./schedule');

// A rule was broken. `code` is stable and meant for the client; `status` is the HTTP status to use.
class EnrollmentError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.name = 'EnrollmentError';
    this.code = code;
    this.status = status;
  }
}

// Only students who are actively studying may take classes (not LOA, transferred, graduated, archived).
const CAN_ENROLL = ['Enrolled'];

/**
 * Put a student into an offering. Checks, in order: student, offering, duplicate, prerequisites,
 * schedule conflicts, then takes a seat ATOMICALLY (one conditional update), so two students can
 * never share the last seat even when they click at the same instant.
 */
async function enrollStudent(studentId, offeringId, { skipPrerequisites = false } = {}) {
  const student = await Student.findById(studentId).select('academicStatus');
  if (!student) throw new EnrollmentError('STUDENT_NOT_FOUND', 'Student not found', 404);
  if (!CAN_ENROLL.includes(student.academicStatus)) {
    throw new EnrollmentError('STUDENT_NOT_ACTIVE', `A student whose status is ${student.academicStatus} cannot enroll in classes`);
  }

  const offering = await Offering.findById(offeringId);
  if (!offering) throw new EnrollmentError('OFFERING_NOT_FOUND', 'Offering not found', 404);
  if (offering.status !== 'Open') throw new EnrollmentError('OFFERING_CLOSED', `This class is ${offering.status.toLowerCase()}`);

  // Same subject, same term (any section)?
  const existing = await Enrollment.findOne({ student: studentId, term: offering.term, subject: offering.subject });
  if (existing && existing.status !== 'Dropped') {
    throw new EnrollmentError('DUPLICATE_ENROLLMENT', 'The student is already enrolled in this subject for this term');
  }

  if (!skipPrerequisites) {
    const subject = await Subject.findById(offering.subject).select('prerequisites');
    if (subject.prerequisites.length) {
      const passed = await Grade.find({ student: studentId, subject: { $in: subject.prerequisites }, value: { $lte: PASSING_GRADE } }).distinct('subject');
      const passedIds = new Set(passed.map(String));
      const missing = subject.prerequisites.filter((id) => !passedIds.has(String(id)));
      if (missing.length) {
        const titles = (await Subject.find({ _id: { $in: missing } }).select('code')).map((s) => s.code).join(', ');
        throw new EnrollmentError('PREREQUISITE_NOT_MET', `Prerequisite not passed: ${titles}`);
      }
    }
  }

  // Overlap with what the student already takes this term?
  const current = await Enrollment.find({ student: studentId, term: offering.term, status: 'Enrolled' }).select('offering');
  if (current.length) {
    const others = await Offering.find({ _id: { $in: current.map((e) => e.offering) } }).populate('subject', 'code');
    const clash = others.find((o) => offeringsConflict(o, offering));
    if (clash) throw new EnrollmentError('SCHEDULE_CONFLICT', `Clashes with ${clash.subject.code} (${clash.section})`);
  }

  // Take a seat: succeeds only while seats remain and the class is open.
  const seat = await Offering.findOneAndUpdate(
    { _id: offering._id, status: 'Open', $expr: { $lt: ['$enrolledCount', '$capacity'] } },
    { $inc: { enrolledCount: 1 } },
  );
  if (!seat) throw new EnrollmentError('OFFERING_FULL', 'This class is full');

  try {
    if (existing) {
      // Re-taking a class that was dropped earlier this term: reuse the row (keeps the unique rule).
      existing.offering = offering._id;
      existing.status = 'Enrolled';
      existing.enrolledAt = new Date();
      existing.droppedAt = undefined;
      return await existing.save();
    }
    return await Enrollment.create({ student: studentId, offering: offering._id });
  } catch (err) {
    await Offering.updateOne({ _id: offering._id }, { $inc: { enrolledCount: -1 } }); // give the seat back
    if (err.code === 11000) throw new EnrollmentError('DUPLICATE_ENROLLMENT', 'The student is already enrolled in this subject for this term');
    throw err;
  }
}

// Drop a class: marks it Dropped and frees the seat. Only an active (Enrolled) record can be dropped.
async function dropEnrollment(enrollmentId) {
  const dropped = await Enrollment.findOneAndUpdate(
    { _id: enrollmentId, status: 'Enrolled' },
    { $set: { status: 'Dropped', droppedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!dropped) {
    const exists = await Enrollment.exists({ _id: enrollmentId });
    if (!exists) throw new EnrollmentError('ENROLLMENT_NOT_FOUND', 'Enrollment not found', 404);
    throw new EnrollmentError('NOT_ACTIVE', 'Only a current enrollment can be dropped');
  }
  await Offering.updateOne({ _id: dropped.offering }, { $inc: { enrolledCount: -1 } });
  return dropped;
}

module.exports = { EnrollmentError, enrollStudent, dropEnrollment };
